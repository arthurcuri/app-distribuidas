const grpc = require('@grpc/grpc-js');
const ProtoLoader = require('../utils/protoLoader');

/**
 * Testes para Streaming Bidirecional de Chat
 */
describe('Streaming Bidirecional - Chat Service', () => {
    let chatClient;
    let authClient;
    let protoLoader;
    let token;

    beforeAll(async () => {
        protoLoader = new ProtoLoader();
        
        // Carregar protobuf
        const chatProto = protoLoader.loadProto('chat_service.proto', 'chat');
        const authProto = protoLoader.loadProto('auth_service.proto', 'auth');
        
        // Criar clientes
        chatClient = new chatProto.ChatService('localhost:50051', grpc.credentials.createInsecure());
        authClient = new authProto.AuthService('localhost:50051', grpc.credentials.createInsecure());
        
        // Criar usuário de teste
        try {
            const registerResponse = await new Promise((resolve, reject) => {
                authClient.Register({
                    email: 'chat-test@example.com',
                    username: 'chat_test_user',
                    password: 'test123',
                    first_name: 'Chat',
                    last_name: 'Test'
                }, (error, response) => {
                    if (error) return reject(error);
                    resolve(response);
                });
            });
            
            if (registerResponse.success) {
                token = registerResponse.token;
            }
        } catch (error) {
            // Se usuário já existe, fazer login
            const loginResponse = await new Promise((resolve, reject) => {
                authClient.Login({
                    identifier: 'chat_test_user',
                    password: 'test123'
                }, (error, response) => {
                    if (error) return reject(error);
                    resolve(response);
                });
            });
            
            if (loginResponse.success) {
                token = loginResponse.token;
            }
        }
    });

    test('Deve estabelecer conexão de streaming bidirecional', (done) => {
        const chatStream = chatClient.StreamChat();
        let messageReceived = false;

        // Handler para mensagens recebidas
        chatStream.on('data', (message) => {
            expect(message).toHaveProperty('id');
            expect(message).toHaveProperty('content');
            expect(message).toHaveProperty('timestamp');
            messageReceived = true;
        });

        // Handler para fim da conexão
        chatStream.on('end', () => {
            expect(messageReceived).toBe(true);
            done();
        });

        // Handler para erros
        chatStream.on('error', (error) => {
            done(error);
        });

        // Enviar mensagem de teste
        setTimeout(() => {
            chatStream.write({
                user_id: 'test',
                username: 'test_user',
                room_id: 'test_room',
                content: 'Mensagem de teste',
                type: 0, // TEXT
                timestamp: Date.now(),
                token: token
            });
        }, 100);

        // Encerrar stream após 2 segundos
        setTimeout(() => {
            chatStream.end();
        }, 2000);
    }, 10000);

    test('Deve processar diferentes tipos de mensagem', (done) => {
        const chatStream = chatClient.StreamChat();
        const messagesReceived = [];
        let expectedMessages = 3;

        chatStream.on('data', (message) => {
            messagesReceived.push(message);
            
            if (messagesReceived.length >= expectedMessages) {
                // Verificar se recebeu mensagens de diferentes tipos
                const messageTypes = messagesReceived.map(msg => msg.type);
                expect(messageTypes).toContain(1); // SYSTEM (boas-vindas)
                
                chatStream.end();
            }
        });

        chatStream.on('end', () => {
            expect(messagesReceived.length).toBeGreaterThanOrEqual(1);
            done();
        });

        chatStream.on('error', (error) => {
            done(error);
        });

        // Enviar diferentes tipos de mensagem
        setTimeout(() => {
            // Entrada na sala
            chatStream.write({
                user_id: 'test',
                username: 'test_user',
                room_id: 'test_room',
                content: '',
                type: 2, // USER_JOINED
                timestamp: Date.now(),
                token: token
            });

            // Mensagem de texto
            chatStream.write({
                user_id: 'test',
                username: 'test_user',
                room_id: 'test_room',
                content: 'Teste de mensagem',
                type: 0, // TEXT
                timestamp: Date.now(),
                token: token
            });

            // Indicador de digitação
            chatStream.write({
                user_id: 'test',
                username: 'test_user',
                room_id: 'test_room',
                content: '',
                type: 4, // TYPING
                timestamp: Date.now(),
                token: token
            });
        }, 100);

        // Timeout de segurança
        setTimeout(() => {
            chatStream.end();
        }, 5000);
    }, 10000);

    test('Deve entrar e sair de salas', (done) => {
        chatClient.JoinRoom({
            token: token,
            room_id: 'test_room',
            username: 'test_user'
        }, (error, response) => {
            if (error) return done(error);

            expect(response.success).toBe(true);
            expect(response.room_id).toBe('test_room');

            // Teste de saída da sala
            chatClient.LeaveRoom({
                token: token,
                room_id: 'test_room',
                user_id: 'test'
            }, (error, leaveResponse) => {
                if (error) return done(error);

                expect(leaveResponse.success).toBe(true);
                done();
            });
        });
    });

    test('Deve obter histórico de chat', (done) => {
        chatClient.GetChatHistory({
            token: token,
            room_id: 'test_room',
            limit: 10
        }, (error, response) => {
            if (error) return done(error);

            expect(response.success).toBe(true);
            expect(Array.isArray(response.messages)).toBe(true);
            done();
        });
    });

    test('Deve obter usuários ativos', (done) => {
        chatClient.GetActiveUsers({
            token: token,
            room_id: 'test_room'
        }, (error, response) => {
            if (error) return done(error);

            expect(response.success).toBe(true);
            expect(Array.isArray(response.users)).toBe(true);
            done();
        });
    });

    test('Deve rejeitar token inválido', (done) => {
        const chatStream = chatClient.StreamChat();
        let errorMessageReceived = false;

        chatStream.on('data', (message) => {
            if (message.user_id === 'system' && message.content.includes('Token inválido')) {
                errorMessageReceived = true;
                chatStream.end();
            }
        });

        chatStream.on('end', () => {
            expect(errorMessageReceived).toBe(true);
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
                token: 'token_invalido'
            });
        }, 100);

        // Timeout de segurança
        setTimeout(() => {
            if (!errorMessageReceived) {
                chatStream.end();
            }
        }, 3000);
    });
});

describe('Múltiplas Conexões Simultâneas', () => {
    let chatClient1, chatClient2;
    let authClient;
    let protoLoader;
    let token1, token2;

    beforeAll(async () => {
        protoLoader = new ProtoLoader();
        
        const chatProto = protoLoader.loadProto('chat_service.proto', 'chat');
        const authProto = protoLoader.loadProto('auth_service.proto', 'auth');
        
        chatClient1 = new chatProto.ChatService('localhost:50051', grpc.credentials.createInsecure());
        chatClient2 = new chatProto.ChatService('localhost:50051', grpc.credentials.createInsecure());
        authClient = new authProto.AuthService('localhost:50051', grpc.credentials.createInsecure());

        // Criar dois usuários de teste
        try {
            // Usuário 1
            const user1Response = await new Promise((resolve, reject) => {
                authClient.Register({
                    email: 'user1@chat-test.com',
                    username: 'chat_user1',
                    password: 'test123',
                    first_name: 'User',
                    last_name: 'One'
                }, (error, response) => {
                    if (error) return reject(error);
                    resolve(response);
                });
            });
            token1 = user1Response.success ? user1Response.token : null;
        } catch (error) {
            const loginResponse = await new Promise((resolve) => {
                authClient.Login({
                    identifier: 'chat_user1',
                    password: 'test123'
                }, (error, response) => resolve(response));
            });
            token1 = loginResponse.success ? loginResponse.token : null;
        }

        try {
            // Usuário 2
            const user2Response = await new Promise((resolve, reject) => {
                authClient.Register({
                    email: 'user2@chat-test.com',
                    username: 'chat_user2',
                    password: 'test123',
                    first_name: 'User',
                    last_name: 'Two'
                }, (error, response) => {
                    if (error) return reject(error);
                    resolve(response);
                });
            });
            token2 = user2Response.success ? user2Response.token : null;
        } catch (error) {
            const loginResponse = await new Promise((resolve) => {
                authClient.Login({
                    identifier: 'chat_user2',
                    password: 'test123'
                }, (error, response) => resolve(response));
            });
            token2 = loginResponse.success ? loginResponse.token : null;
        }
    });

    test('Deve permitir múltiplos usuários na mesma sala', (done) => {
        if (!token1 || !token2) {
            return done(new Error('Falha na criação dos usuários de teste'));
        }

        const stream1 = chatClient1.StreamChat();
        const stream2 = chatClient2.StreamChat();
        
        let user1Messages = [];
        let user2Messages = [];
        let testComplete = false;

        stream1.on('data', (message) => {
            user1Messages.push(message);
            checkTestCompletion();
        });

        stream2.on('data', (message) => {
            user2Messages.push(message);
            checkTestCompletion();
        });

        function checkTestCompletion() {
            if (testComplete) return;
            
            // Verificar se ambos os usuários receberam mensagens
            if (user1Messages.length >= 2 && user2Messages.length >= 2) {
                testComplete = true;
                
                // Verificar se houve comunicação cruzada
                const user1ReceivedFromUser2 = user1Messages.some(msg => 
                    msg.username === 'chat_user2' && msg.type === 0
                );
                const user2ReceivedFromUser1 = user2Messages.some(msg => 
                    msg.username === 'chat_user1' && msg.type === 0
                );

                expect(user1ReceivedFromUser2).toBe(true);
                expect(user2ReceivedFromUser1).toBe(true);

                stream1.end();
                stream2.end();
                done();
            }
        }

        // Simular conversa
        setTimeout(() => {
            // User1 entra na sala
            stream1.write({
                user_id: 'user1',
                username: 'chat_user1',
                room_id: 'multi_test',
                content: '',
                type: 2, // USER_JOINED
                timestamp: Date.now(),
                token: token1
            });

            // User2 entra na sala
            stream2.write({
                user_id: 'user2',
                username: 'chat_user2',
                room_id: 'multi_test',
                content: '',
                type: 2, // USER_JOINED
                timestamp: Date.now(),
                token: token2
            });
        }, 100);

        setTimeout(() => {
            // User1 envia mensagem
            stream1.write({
                user_id: 'user1',
                username: 'chat_user1',
                room_id: 'multi_test',
                content: 'Olá do User1!',
                type: 0, // TEXT
                timestamp: Date.now(),
                token: token1
            });
        }, 500);

        setTimeout(() => {
            // User2 responde
            stream2.write({
                user_id: 'user2',
                username: 'chat_user2',
                room_id: 'multi_test',
                content: 'Oi User1, tudo bem?',
                type: 0, // TEXT
                timestamp: Date.now(),
                token: token2
            });
        }, 1000);

        // Timeout de segurança
        setTimeout(() => {
            if (!testComplete) {
                stream1.end();
                stream2.end();
                done(new Error('Teste não completou no tempo esperado'));
            }
        }, 5000);
    }, 10000);
});
