const grpc = require('@grpc/grpc-js');
const jwt = require('jsonwebtoken');

/**
 * Middleware de Autenticação para gRPC
 * 
 * Implementa validação de JWT em chamadas gRPC com:
 * - Interceptação automática de metadados
 * - Validação de tokens em streaming bidirecional
 * - Sistema de roles e permissões
 * - Cache de autenticação para performance
 */
class GrpcAuthMiddleware {
    constructor(options = {}) {
        this.jwtSecret = options.jwtSecret || process.env.JWT_SECRET || 'sua-chave-secreta-aqui';
        this.excludedMethods = options.excludedMethods || [
            '/auth.AuthService/Register',
            '/auth.AuthService/Login'
        ];
        this.tokenCache = new Map();
        this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutos
        
        console.log('🔐 Middleware de autenticação gRPC inicializado');
    }

    /**
     * Validar token JWT
     */
    validateToken(token) {
        if (!token) {
            return { valid: false, error: 'Token não fornecido' };
        }

        // Verificar cache
        const cacheKey = `token:${token}`;
        const cached = this.tokenCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return { valid: true, user: cached.user };
        }

        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            
            // Armazenar no cache
            this.tokenCache.set(cacheKey, {
                user: decoded,
                timestamp: Date.now()
            });

            return { valid: true, user: decoded };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Extrair token dos metadados ou request
     */
    extractToken(call) {
        // Primeiro, tentar metadados
        if (call.metadata) {
            const auth = call.metadata.get('authorization');
            if (auth && auth.length > 0) {
                const authValue = auth[0];
                if (authValue.startsWith('Bearer ')) {
                    return authValue.substring(7);
                }
                return authValue;
            }
        }

        // Fallback: extrair do request se disponível
        if (call.request && call.request.token) {
            return call.request.token;
        }

        return null;
    }

    /**
     * Interceptador para métodos unários
     */
    interceptUnary(methodName) {
        return (call, callback, next) => {
            // Verificar se método está excluído
            if (this.excludedMethods.includes(methodName)) {
                console.log(`🔓 [${methodName}] Método não requer autenticação`);
                return next();
            }

            // Extrair e validar token
            const token = this.extractToken(call);
            const validation = this.validateToken(token);

            if (!validation.valid) {
                console.log(`❌ [${methodName}] Falha na autenticação: ${validation.error}`);
                const error = {
                    code: grpc.status.UNAUTHENTICATED,
                    message: `Falha na autenticação: ${validation.error}`
                };
                return callback(error);
            }

            // Adicionar usuário ao contexto
            call.user = validation.user;
            console.log(`✅ [${methodName}] Autenticação bem-sucedida: ${validation.user.username || validation.user.email}`);
            
            next();
        };
    }

    /**
     * Interceptador para streaming
     */
    interceptStreaming(methodName) {
        return (call) => {
            // Verificar se método está excluído
            if (this.excludedMethods.includes(methodName)) {
                console.log(`🔓 [${methodName}] Streaming não requer autenticação`);
                return call;
            }

            let authenticated = false;

            // Interceptar dados recebidos
            const originalOn = call.on.bind(call);
            call.on = (event, listener) => {
                if (event === 'data') {
                    const wrappedListener = (data) => {
                        // Autenticar na primeira mensagem
                        if (!authenticated) {
                            let token = this.extractToken(call);
                            
                            // Se não encontrou token nos metadados, tentar no data
                            if (!token && data && data.token) {
                                token = data.token;
                            }

                            const validation = this.validateToken(token);
                            if (!validation.valid) {
                                console.log(`❌ [${methodName}] Falha na autenticação do streaming: ${validation.error}`);
                                const error = new Error(`Falha na autenticação: ${validation.error}`);
                                error.code = grpc.status.UNAUTHENTICATED;
                                call.emit('error', error);
                                return;
                            }

                            authenticated = true;
                            call.user = validation.user;
                            console.log(`✅ [${methodName}] Streaming autenticado: ${validation.user.username || validation.user.email}`);
                        }

                        listener(data);
                    };
                    return originalOn('data', wrappedListener);
                }
                return originalOn(event, listener);
            };

            return call;
        };
    }

    /**
     * Aplicar middleware em um serviço
     */
    applyToService(service) {
        const protectedService = {};
        
        for (const [methodName, method] of Object.entries(service)) {
            if (typeof method !== 'function') {
                protectedService[methodName] = method;
                continue;
            }

            const fullMethodName = `/service/${methodName}`;

            // Verificar se é método de streaming
            if (methodName.toLowerCase().includes('stream')) {
                protectedService[methodName] = (call) => {
                    const interceptedCall = this.interceptStreaming(fullMethodName)(call);
                    return method.call(service, interceptedCall);
                };
            } else {
                // Método unário
                protectedService[methodName] = (call, callback) => {
                    const interceptor = this.interceptUnary(fullMethodName);
                    interceptor(call, callback, () => {
                        method.call(service, call, callback);
                    });
                };
            }
        }

        return protectedService;
    }

    /**
     * Limpar cache
     */
    clearCache() {
        this.tokenCache.clear();
        console.log('🧹 Cache de autenticação limpo');
    }

    /**
     * Estatísticas do cache
     */
    getCacheStats() {
        let valid = 0;
        let expired = 0;
        const now = Date.now();

        for (const [, entry] of this.tokenCache) {
            if (now - entry.timestamp < this.cacheTTL) {
                valid++;
            } else {
                expired++;
            }
        }

        return {
            total: this.tokenCache.size,
            valid,
            expired
        };
    }
}

/**
 * Criar middleware de autenticação pré-configurado
 */
function createAuthMiddleware(options = {}) {
    return new GrpcAuthMiddleware(options);
}

/**
 * Decorador para métodos que requerem autenticação
 */
function requireAuth(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(call, callback) {
        const token = extractTokenFromCall(call);
        const validation = validateToken(token);
        
        if (!validation.valid) {
            const error = {
                code: grpc.status.UNAUTHENTICATED,
                message: `Autenticação requerida: ${validation.error}`
            };
            return callback(error);
        }
        
        call.user = validation.user;
        return originalMethod.call(this, call, callback);
    };
    
    return descriptor;
}

/**
 * Funções utilitárias
 */
function extractTokenFromCall(call) {
    if (call.metadata) {
        const auth = call.metadata.get('authorization');
        if (auth && auth.length > 0) {
            const authValue = auth[0];
            return authValue.startsWith('Bearer ') ? authValue.substring(7) : authValue;
        }
    }
    
    if (call.request && call.request.token) {
        return call.request.token;
    }
    
    return null;
}

function validateToken(token) {
    if (!token) return { valid: false, error: 'Token não fornecido' };
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sua-chave-secreta-aqui');
        return { valid: true, user: decoded };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

module.exports = {
    GrpcAuthMiddleware,
    createAuthMiddleware,
    requireAuth,
    extractTokenFromCall,
    validateToken
};
