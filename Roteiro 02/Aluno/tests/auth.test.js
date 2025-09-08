const grpc = require('@grpc/grpc-js');
const ProtoLoader = require('../utils/protoLoader');
const { validateToken, TokenUtils } = require('../jwtInterceptor');

/**
 * Testes para Interceptadores de Autenticação JWT
 */
describe('Interceptadores de Autenticação gRPC', () => {
    let authClient, taskClient, chatClient;
    let protoLoader;
    let validToken, invalidToken;
    let testUser;

    beforeAll(async () => {
        protoLoader = new ProtoLoader();
        
        // Carregar protobuf
        const authProto = protoLoader.loadProto('auth_service.proto', 'auth');
        const taskProto = protoLoader.loadProto('task_service.proto', 'tasks');
        const chatProto = protoLoader.loadProto('chat_service.proto', 'chat');
        
        // Criar clientes
        authClient = new authProto.AuthService('localhost:50051', grpc.credentials.createInsecure());
        taskClient = new taskProto.TaskService('localhost:50051', grpc.credentials.createInsecure());
        chatClient = new chatProto.ChatService('localhost:50051', grpc.credentials.createInsecure());
        
        // Criar usuário de teste e obter token válido
        try {
            const registerResponse = await new Promise((resolve, reject) => {
                authClient.Register({
                    email: 'auth-test@example.com',
                    username: 'auth_test_user',
                    password: 'test123',
                    first_name: 'Auth',
                    last_name: 'Test'
                }, (error, response) => {
                    if (error) return reject(error);
                    resolve(response);
                });
            });
            
            if (registerResponse.success) {
                validToken = registerResponse.token;
                testUser = registerResponse.user;
            }
        } catch (error) {
            // Se usuário já existe, fazer login
            const loginResponse = await new Promise((resolve, reject) => {
                authClient.Login({
                    identifier: 'auth_test_user',
                    password: 'test123'
                }, (error, response) => {
                    if (error) return reject(error);
                    resolve(response);
                });
            });
            
            if (loginResponse.success) {
                validToken = loginResponse.token;
                testUser = loginResponse.user;
            }
        }

        // Token inválido para testes
        invalidToken = 'invalid.token.here';
    });

    describe('Validação de Token', () => {
        test('Deve validar token válido', () => {
            const result = validateToken(validToken);
            expect(result.valid).toBe(true);
            expect(result.user).toBeDefined();
            expect(result.user.userId || result.user.id).toBe(testUser.id);
        });

        test('Deve rejeitar token inválido', () => {
            const result = validateToken(invalidToken);
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('Deve rejeitar token vazio', () => {
            const result = validateToken('');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Token não fornecido');
        });

        test('Deve rejeitar token null', () => {
            const result = validateToken(null);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Token não fornecido');
        });
    });

    describe('Interceptação em Métodos Unários', () => {
        test('Deve permitir acesso com token válido nos metadados', (done) => {
            // Criar metadados com token válido
            const metadata = new grpc.Metadata();
            metadata.set('authorization', `Bearer ${validToken}`);

            taskClient.GetTasks({
                page: 1,
                limit: 5
            }, metadata, (error, response) => {
                if (error) {
                    // Se erro não for de autenticação, token foi aceito
                    expect(error.code).not.toBe(grpc.status.UNAUTHENTICATED);
                } else {
                    // Sucesso significa que token foi aceito
                    expect(response).toBeDefined();
                }
                done();
            });
        });

        test('Deve rejeitar acesso sem token', (done) => {
            taskClient.GetTasks({
                page: 1,
                limit: 5
            }, (error, response) => {
                expect(error).toBeDefined();
                expect(error.code).toBe(grpc.status.UNAUTHENTICATED);
                expect(error.details).toContain('Autenticação requerida');
                done();
            });
        });

        test('Deve rejeitar acesso com token inválido nos metadados', (done) => {
            const metadata = new grpc.Metadata();
            metadata.set('authorization', `Bearer ${invalidToken}`);

            taskClient.GetTasks({
                page: 1,
                limit: 5
            }, metadata, (error, response) => {
                expect(error).toBeDefined();
                expect(error.code).toBe(grpc.status.UNAUTHENTICATED);
                done();
            });
        });

        test('Deve aceitar token no payload como fallback', (done) => {
            taskClient.GetTasks({
                token: validToken,
                page: 1,
                limit: 5
            }, (error, response) => {
                if (error) {
                    // Se erro não for de autenticação, token foi aceito
                    expect(error.code).not.toBe(grpc.status.UNAUTHENTICATED);
                } else {
                    expect(response).toBeDefined();
                }
                done();
            });
        });
    });

    describe('Interceptação em Streaming Bidirecional', () => {
        test('Deve autenticar streaming com token válido', (done) => {
            const chatStream = chatClient.StreamChat();
            let messageReceived = false;
            let authErrorOccurred = false;

            // Handler para mensagens recebidas
            chatStream.on('data', (message) => {
                messageReceived = true;
                // Se recebeu mensagem, autenticação foi bem-sucedida
                expect(message).toBeDefined();
            });

            // Handler para erros
            chatStream.on('error', (error) => {
                if (error.code === grpc.status.UNAUTHENTICATED) {
                    authErrorOccurred = true;
                }
            });

            // Handler para fim da conexão
            chatStream.on('end', () => {
                expect(authErrorOccurred).toBe(false);
                done();
            });

            // Enviar mensagem com token válido
            setTimeout(() => {
                chatStream.write({
                    user_id: 'test',
                    username: 'test_user',
                    room_id: 'test_room',
                    content: 'Teste com token válido',
                    type: 0, // TEXT
                    timestamp: Date.now(),
                    token: validToken
                });
            }, 100);

            // Encerrar stream após 2 segundos
            setTimeout(() => {
                chatStream.end();
            }, 2000);
        }, 5000);

        test('Deve rejeitar streaming com token inválido', (done) => {
            const chatStream = chatClient.StreamChat();
            let authErrorOccurred = false;

            // Handler para erros
            chatStream.on('error', (error) => {
                if (error.code === grpc.status.UNAUTHENTICATED) {
                    authErrorOccurred = true;
                    expect(error.message).toContain('Autenticação requerida');
                    chatStream.end();
                }
            });

            // Handler para fim da conexão
            chatStream.on('end', () => {
                expect(authErrorOccurred).toBe(true);
                done();
            });

            // Enviar mensagem com token inválido
            setTimeout(() => {
                chatStream.write({
                    user_id: 'test',
                    username: 'test_user',
                    room_id: 'test_room',
                    content: 'Teste com token inválido',
                    type: 0, // TEXT
                    timestamp: Date.now(),
                    token: invalidToken
                });
            }, 100);

            // Timeout de segurança
            setTimeout(() => {
                if (!authErrorOccurred) {
                    chatStream.end();
                    done(new Error('Erro de autenticação esperado não ocorreu'));
                }
            }, 3000);
        }, 5000);

        test('Deve rejeitar streaming sem token', (done) => {
            const chatStream = chatClient.StreamChat();
            let authErrorOccurred = false;

            // Handler para erros
            chatStream.on('error', (error) => {
                if (error.code === grpc.status.UNAUTHENTICATED) {
                    authErrorOccurred = true;
                    expect(error.message).toContain('Token não fornecido');
                    chatStream.end();
                }
            });

            // Handler para fim da conexão
            chatStream.on('end', () => {
                expect(authErrorOccurred).toBe(true);
                done();
            });

            // Enviar mensagem sem token
            setTimeout(() => {
                chatStream.write({
                    user_id: 'test',
                    username: 'test_user',
                    room_id: 'test_room',
                    content: 'Teste sem token',
                    type: 0, // TEXT
                    timestamp: Date.now()
                    // Sem token
                });
            }, 100);

            // Timeout de segurança
            setTimeout(() => {
                if (!authErrorOccurred) {
                    chatStream.end();
                    done(new Error('Erro de autenticação esperado não ocorreu'));
                }
            }, 3000);
        }, 5000);
    });

    describe('Métodos Excluídos de Autenticação', () => {
        test('Deve permitir registro sem token', (done) => {
            authClient.Register({
                email: 'test-no-auth@example.com',
                username: 'test_no_auth',
                password: 'test123',
                first_name: 'Test',
                last_name: 'NoAuth'
            }, (error, response) => {
                // Não deve ser erro de autenticação
                if (error) {
                    expect(error.code).not.toBe(grpc.status.UNAUTHENTICATED);
                } else {
                    expect(response).toBeDefined();
                }
                done();
            });
        });

        test('Deve permitir login sem token', (done) => {
            authClient.Login({
                identifier: 'auth_test_user',
                password: 'test123'
            }, (error, response) => {
                // Não deve ser erro de autenticação
                if (error) {
                    expect(error.code).not.toBe(grpc.status.UNAUTHENTICATED);
                } else {
                    expect(response).toBeDefined();
                    expect(response.success).toBe(true);
                }
                done();
            });
        });

        test('Deve permitir validação de token sem metadados de auth', (done) => {
            authClient.ValidateToken({
                token: validToken
            }, (error, response) => {
                // Não deve ser erro de autenticação
                if (error) {
                    expect(error.code).not.toBe(grpc.status.UNAUTHENTICATED);
                } else {
                    expect(response).toBeDefined();
                    expect(response.valid).toBe(true);
                }
                done();
            });
        });
    });

    describe('Utilitários de Token', () => {
        test('Deve gerar token válido', () => {
            const payload = {
                userId: 'test123',
                username: 'testuser',
                email: 'test@example.com'
            };

            const token = TokenUtils.generateToken(payload);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3); // JWT structure
        });

        test('Deve decodificar token', () => {
            const payload = {
                userId: 'test123',
                username: 'testuser'
            };

            const token = TokenUtils.generateToken(payload);
            const decoded = TokenUtils.decodeToken(token);
            
            expect(decoded).toBeDefined();
            expect(decoded.payload.userId).toBe('test123');
            expect(decoded.payload.username).toBe('testuser');
        });

        test('Deve verificar se token está expirado', () => {
            // Token que expira em 1 segundo
            const shortLivedToken = TokenUtils.generateToken(
                { userId: 'test' },
                { expiresIn: '1s' }
            );

            // Imediatamente não deve estar expirado
            expect(TokenUtils.isTokenExpired(shortLivedToken)).toBe(false);

            // Após aguardar, deve estar expirado
            return new Promise((resolve) => {
                setTimeout(() => {
                    expect(TokenUtils.isTokenExpired(shortLivedToken)).toBe(true);
                    resolve();
                }, 1100);
            });
        });

        test('Deve renovar token', () => {
            const originalPayload = {
                userId: 'test123',
                username: 'testuser'
            };

            const originalToken = TokenUtils.generateToken(originalPayload);
            const newToken = TokenUtils.refreshToken(originalToken, { role: 'admin' });
            
            expect(newToken).toBeDefined();
            expect(newToken).not.toBe(originalToken);
            
            const decoded = TokenUtils.decodeToken(newToken);
            expect(decoded.payload.userId).toBe('test123');
            expect(decoded.payload.role).toBe('admin');
        });
    });

    afterAll(() => {
        // Limpar recursos
        if (authClient) authClient.close();
        if (taskClient) taskClient.close();
        if (chatClient) chatClient.close();
    });
});
