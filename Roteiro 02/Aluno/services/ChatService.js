const grpc = require('@grpc/grpc-js');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

/**
 * Serviço de Chat com Streaming Bidirecional
 * 
 * Implementa chat em tempo real usando gRPC streaming bidirecional:
 * - Permite comunicação simultânea entre cliente e servidor
 * - Mantém conexões persistentes para baixa latência
 * - Suporte a múltiplas salas de chat
 * - Sistema de presença de usuários
 * - Histórico de mensagens
 */
class ChatService {
    constructor() {
        // Armazenar conexões ativas por sala
        this.rooms = new Map(); // roomId -> Set de streams
        this.userSessions = new Map(); // userId -> { stream, roomId, username, lastSeen }
        this.chatHistory = new Map(); // roomId -> Array de mensagens
        this.activeUsers = new Map(); // roomId -> Map(userId -> userData)
        
        this.JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-aqui';
        
        // Limpeza periódica de sessões inativas
        setInterval(() => this.cleanupInactiveSessions(), 30000); // 30 segundos
    }

    /**
     * Streaming bidirecional para chat em tempo real
     * Cada cliente pode enviar e receber mensagens simultaneamente
     */
    streamChat(call) {
        console.log('🔄 Nova conexão de streaming bidirecional estabelecida');
        
        let currentUser = null;
        let currentRoom = null;
        
        // Configurar handlers para mensagens recebidas do cliente
        call.on('data', async (chatMessage) => {
            try {
                await this.handleIncomingMessage(chatMessage, call, currentUser, currentRoom);
                
                // Atualizar contexto do usuário
                if (chatMessage.token && !currentUser) {
                    const userData = await this.validateToken(chatMessage.token);
                    if (userData) {
                        currentUser = userData;
                        currentRoom = chatMessage.room_id;
                        this.registerUserSession(userData.id, call, chatMessage.room_id, userData.username);
                    }
                }
            } catch (error) {
                console.error('❌ Erro ao processar mensagem:', error);
                this.sendErrorToClient(call, 'Erro ao processar mensagem');
            }
        });

        // Handler para fim de conexão
        call.on('end', () => {
            console.log('🔚 Conexão de streaming encerrada pelo cliente');
            if (currentUser && currentRoom) {
                this.handleUserDisconnect(currentUser.id, currentRoom);
            }
            call.end();
        });

        // Handler para erros
        call.on('error', (error) => {
            console.error('❌ Erro na conexão de streaming:', error);
            if (currentUser && currentRoom) {
                this.handleUserDisconnect(currentUser.id, currentRoom);
            }
        });

        // Enviar mensagem de boas-vindas
        call.write({
            id: uuidv4(),
            user_id: 'system',
            username: 'Sistema',
            room_id: 'system',
            content: 'Conexão estabelecida! Envie uma mensagem com token para começar.',
            type: 1, // SYSTEM
            timestamp: Date.now()
        });
    }

    /**
     * Processar mensagem recebida do cliente
     */
    async handleIncomingMessage(chatMessage, senderCall, currentUser, currentRoom) {
        // Validar token se fornecido
        if (chatMessage.token && !currentUser) {
            const userData = await this.validateToken(chatMessage.token);
            if (!userData) {
                this.sendErrorToClient(senderCall, 'Token inválido');
                return;
            }
            currentUser = userData;
        }

        // Processar diferentes tipos de mensagem
        switch (Number(chatMessage.type)) {
            case 0: // TEXT
                await this.handleTextMessage(chatMessage, senderCall, currentUser);
                break;
            case 2: // USER_JOINED
                await this.handleUserJoined(chatMessage, senderCall, currentUser);
                break;
            case 3: // USER_LEFT
                await this.handleUserLeft(chatMessage, senderCall, currentUser);
                break;
            case 4: // TYPING
                await this.handleTypingIndicator(chatMessage, senderCall, currentUser);
                break;
            case 5: // HEARTBEAT
                await this.handleHeartbeat(chatMessage, currentUser);
                break;
            default:
                console.warn('⚠️ Tipo de mensagem desconhecido:', chatMessage.type);
        }
    }

    /**
     * Processar mensagem de texto
     */
    async handleTextMessage(chatMessage, senderCall, currentUser) {
        if (!currentUser || !chatMessage.content.trim()) {
            return;
        }

        const message = {
            id: uuidv4(),
            user_id: currentUser.id,
            username: currentUser.username,
            room_id: chatMessage.room_id,
            content: chatMessage.content,
            type: 0, // TEXT
            timestamp: Date.now()
        };

        // Salvar no histórico
        this.addToHistory(chatMessage.room_id, message);

        // Broadcast para todos os usuários na sala
        this.broadcastToRoom(chatMessage.room_id, message, senderCall);
    }

    /**
     * Processar entrada de usuário na sala
     */
    async handleUserJoined(chatMessage, senderCall, currentUser) {
        if (!currentUser) return;

        this.registerUserSession(currentUser.id, senderCall, chatMessage.room_id, currentUser.username);

        const message = {
            id: uuidv4(),
            user_id: 'system',
            username: 'Sistema',
            room_id: chatMessage.room_id,
            content: `${currentUser.username} entrou na sala`,
            type: 2, // USER_JOINED
            timestamp: Date.now()
        };

        this.addToHistory(chatMessage.room_id, message);
        this.broadcastToRoom(chatMessage.room_id, message);
    }

    /**
     * Processar saída de usuário da sala
     */
    async handleUserLeft(chatMessage, senderCall, currentUser) {
        if (!currentUser) return;

        this.handleUserDisconnect(currentUser.id, chatMessage.room_id);

        const message = {
            id: uuidv4(),
            user_id: 'system',
            username: 'Sistema',
            room_id: chatMessage.room_id,
            content: `${currentUser.username} saiu da sala`,
            type: 3, // USER_LEFT
            timestamp: Date.now()
        };

        this.addToHistory(chatMessage.room_id, message);
        this.broadcastToRoom(chatMessage.room_id, message);
    }

    /**
     * Processar indicador de digitação
     */
    async handleTypingIndicator(chatMessage, senderCall, currentUser) {
        if (!currentUser) return;

        // Broadcast apenas para outros usuários (não para o remetente)
        const message = {
            id: uuidv4(),
            user_id: currentUser.id,
            username: currentUser.username,
            room_id: chatMessage.room_id,
            content: 'está digitando...',
            type: 4, // TYPING
            timestamp: Date.now()
        };

        this.broadcastToRoom(chatMessage.room_id, message, senderCall);
    }

    /**
     * Processar heartbeat para manter conexão ativa
     */
    async handleHeartbeat(chatMessage, currentUser) {
        if (!currentUser) return;

        // Atualizar timestamp da última atividade
        const session = this.userSessions.get(currentUser.id);
        if (session) {
            session.lastSeen = Date.now();
        }
    }

    /**
     * Registrar sessão de usuário
     */
    registerUserSession(userId, stream, roomId, username) {
        // Registrar sessão do usuário
        this.userSessions.set(userId, {
            stream,
            roomId,
            username,
            lastSeen: Date.now()
        });

        // Adicionar stream à sala
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
        }
        this.rooms.get(roomId).add(stream);

        // Registrar usuário ativo na sala
        if (!this.activeUsers.has(roomId)) {
            this.activeUsers.set(roomId, new Map());
        }
        this.activeUsers.get(roomId).set(userId, {
            user_id: userId,
            username,
            last_seen: Date.now(),
            is_typing: false
        });

        console.log(`✅ Usuário ${username} (${userId}) entrou na sala ${roomId}`);
    }

    /**
     * Lidar com desconexão de usuário
     */
    handleUserDisconnect(userId, roomId) {
        const session = this.userSessions.get(userId);
        if (session) {
            // Remover stream da sala
            if (this.rooms.has(roomId)) {
                this.rooms.get(roomId).delete(session.stream);
                if (this.rooms.get(roomId).size === 0) {
                    this.rooms.delete(roomId);
                }
            }

            // Remover usuário ativo
            if (this.activeUsers.has(roomId)) {
                this.activeUsers.get(roomId).delete(userId);
                if (this.activeUsers.get(roomId).size === 0) {
                    this.activeUsers.delete(roomId);
                }
            }

            // Remover sessão
            this.userSessions.delete(userId);
            console.log(`🔌 Usuário ${session.username} (${userId}) desconectado da sala ${roomId}`);
        }
    }

    /**
     * Broadcast mensagem para todos os usuários de uma sala
     */
    broadcastToRoom(roomId, message, excludeStream = null) {
        const roomStreams = this.rooms.get(roomId);
        if (!roomStreams) return;

        let successCount = 0;
        let errorCount = 0;

        roomStreams.forEach(stream => {
            if (stream === excludeStream) return; // Não enviar para o remetente

            try {
                stream.write(message);
                successCount++;
            } catch (error) {
                console.error('❌ Erro ao enviar mensagem para stream:', error);
                roomStreams.delete(stream); // Remove stream inválido
                errorCount++;
            }
        });

        console.log(`📤 Mensagem broadcast para sala ${roomId}: ${successCount} sucessos, ${errorCount} erros`);
    }

    /**
     * Adicionar mensagem ao histórico
     */
    addToHistory(roomId, message) {
        if (!this.chatHistory.has(roomId)) {
            this.chatHistory.set(roomId, []);
        }
        
        const history = this.chatHistory.get(roomId);
        history.push(message);
        
        // Manter apenas as últimas 1000 mensagens
        if (history.length > 1000) {
            history.splice(0, history.length - 1000);
        }
    }

    /**
     * Enviar erro para cliente específico
     */
    sendErrorToClient(stream, errorMessage) {
        try {
            stream.write({
                id: uuidv4(),
                user_id: 'system',
                username: 'Sistema',
                room_id: 'error',
                content: errorMessage,
                type: 1, // SYSTEM
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('❌ Erro ao enviar mensagem de erro:', error);
        }
    }

    /**
     * Validar token JWT
     */
    async validateToken(token) {
        try {
            const decoded = jwt.verify(token, this.JWT_SECRET);
            return {
                id: decoded.userId,
                username: decoded.username,
                email: decoded.email
            };
        } catch (error) {
            console.error('❌ Token inválido:', error);
            return null;
        }
    }

    /**
     * Limpeza de sessões inativas
     */
    cleanupInactiveSessions() {
        const now = Date.now();
        const TIMEOUT = 5 * 60 * 1000; // 5 minutos

        for (const [userId, session] of this.userSessions.entries()) {
            if (now - session.lastSeen > TIMEOUT) {
                console.log(`🧹 Limpando sessão inativa: ${session.username} (${userId})`);
                this.handleUserDisconnect(userId, session.roomId);
            }
        }
    }

    /**
     * Entrar em uma sala de chat
     */
    async joinRoom(call, callback) {
        try {
            const { room_id, username } = call.request;
            
            const userData = call.user;
            if (!userData) {
                return callback(null, {
                    success: false,
                    message: 'Usuário não autenticado'
                });
            }

            // Obter usuários ativos na sala
            const activeUsers = this.activeUsers.get(room_id);
            const userList = activeUsers ? Array.from(activeUsers.values()).map(u => u.username) : [];

            callback(null, {
                success: true,
                message: 'Entrada na sala realizada com sucesso',
                room_id,
                active_users: userList
            });
        } catch (error) {
            console.error('❌ Erro ao entrar na sala:', error);
            callback(null, {
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    /**
     * Sair de uma sala de chat
     */
    async leaveRoom(call, callback) {
        try {
            const { room_id, user_id } = call.request;
            
            const userData = call.user;
            if (!userData) {
                return callback(null, {
                    success: false,
                    message: 'Usuário não autenticado'
                });
            }

            this.handleUserDisconnect(user_id, room_id);

            callback(null, {
                success: true,
                message: 'Saída da sala realizada com sucesso'
            });
        } catch (error) {
            console.error('❌ Erro ao sair da sala:', error);
            callback(null, {
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    /**
     * Obter histórico de chat
     */
    async getChatHistory(call, callback) {
        try {
            const { room_id, limit = 50, before_timestamp } = call.request;
            
            const userData = call.user;
            if (!userData) {
                return callback(null, {
                    success: false,
                    message: 'Usuário não autenticado'
                });
            }

            let messages = this.chatHistory.get(room_id) || [];
            
            // Filtrar por timestamp se fornecido
            if (before_timestamp > 0) {
                messages = messages.filter(msg => msg.timestamp < before_timestamp);
            }

            // Aplicar limite
            messages = messages.slice(-limit);

            callback(null, {
                success: true,
                messages,
                message: 'Histórico obtido com sucesso'
            });
        } catch (error) {
            console.error('❌ Erro ao obter histórico:', error);
            callback(null, {
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    /**
     * Obter usuários ativos
     */
    async getActiveUsers(call, callback) {
        try {
            const { room_id } = call.request;
            
            const userData = call.user;
            if (!userData) {
                return callback(null, {
                    success: false,
                    message: 'Usuário não autenticado'
                });
            }

            const activeUsers = this.activeUsers.get(room_id);
            const users = activeUsers ? Array.from(activeUsers.values()) : [];

            callback(null, {
                success: true,
                users,
                message: 'Usuários ativos obtidos com sucesso'
            });
        } catch (error) {
            console.error('❌ Erro ao obter usuários ativos:', error);
            callback(null, {
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = ChatService;
