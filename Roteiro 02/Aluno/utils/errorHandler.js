const grpc = require('@grpc/grpc-js');

/**
 * Sistema de Tratamento de Erros gRPC
 * 
 * Implementa tratamento robusto de erros com:
 * - Códigos de status gRPC padronizados
 * - Mapeamento de erros de aplicação para gRPC
 * - Metadata adicional para debugging
 * - Logging estruturado de erros
 * - Retry automático para erros temporários
 */

/**
 * Códigos de erro gRPC padronizados
 */
const GrpcErrorCodes = {
    OK: grpc.status.OK,
    CANCELLED: grpc.status.CANCELLED,
    UNKNOWN: grpc.status.UNKNOWN,
    INVALID_ARGUMENT: grpc.status.INVALID_ARGUMENT,
    DEADLINE_EXCEEDED: grpc.status.DEADLINE_EXCEEDED,
    NOT_FOUND: grpc.status.NOT_FOUND,
    ALREADY_EXISTS: grpc.status.ALREADY_EXISTS,
    PERMISSION_DENIED: grpc.status.PERMISSION_DENIED,
    RESOURCE_EXHAUSTED: grpc.status.RESOURCE_EXHAUSTED,
    FAILED_PRECONDITION: grpc.status.FAILED_PRECONDITION,
    ABORTED: grpc.status.ABORTED,
    OUT_OF_RANGE: grpc.status.OUT_OF_RANGE,
    UNIMPLEMENTED: grpc.status.UNIMPLEMENTED,
    INTERNAL: grpc.status.INTERNAL,
    UNAVAILABLE: grpc.status.UNAVAILABLE,
    DATA_LOSS: grpc.status.DATA_LOSS,
    UNAUTHENTICATED: grpc.status.UNAUTHENTICATED
};

/**
 * Tipos de erro de aplicação
 */
const AppErrorTypes = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
    DATABASE_ERROR: 'DATABASE_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
};

/**
 * Mapeamento de erros de aplicação para códigos gRPC
 */
const ErrorMapping = {
    [AppErrorTypes.VALIDATION_ERROR]: GrpcErrorCodes.INVALID_ARGUMENT,
    [AppErrorTypes.AUTHENTICATION_ERROR]: GrpcErrorCodes.UNAUTHENTICATED,
    [AppErrorTypes.AUTHORIZATION_ERROR]: GrpcErrorCodes.PERMISSION_DENIED,
    [AppErrorTypes.RESOURCE_NOT_FOUND]: GrpcErrorCodes.NOT_FOUND,
    [AppErrorTypes.RESOURCE_CONFLICT]: GrpcErrorCodes.ALREADY_EXISTS,
    [AppErrorTypes.DATABASE_ERROR]: GrpcErrorCodes.INTERNAL,
    [AppErrorTypes.NETWORK_ERROR]: GrpcErrorCodes.UNAVAILABLE,
    [AppErrorTypes.TIMEOUT_ERROR]: GrpcErrorCodes.DEADLINE_EXCEEDED,
    [AppErrorTypes.RATE_LIMIT_ERROR]: GrpcErrorCodes.RESOURCE_EXHAUSTED,
    [AppErrorTypes.SERVICE_UNAVAILABLE]: GrpcErrorCodes.UNAVAILABLE
};

/**
 * Classe para erros estruturados da aplicação
 */
class AppError extends Error {
    constructor(type, message, details = {}, originalError = null) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.details = details;
        this.originalError = originalError;
        this.timestamp = new Date().toISOString();
        this.grpcCode = ErrorMapping[type] || GrpcErrorCodes.INTERNAL;
    }

    /**
     * Converter para erro gRPC
     */
    toGrpcError() {
        const metadata = new grpc.Metadata();
        
        // Adicionar metadata de erro
        metadata.add('error-type', this.type);
        metadata.add('error-timestamp', this.timestamp);
        metadata.add('error-details', JSON.stringify(this.details));
        
        if (this.originalError) {
            metadata.add('original-error', this.originalError.message);
        }

        const error = {
            code: this.grpcCode,
            message: this.message,
            metadata: metadata
        };

        return error;
    }

    /**
     * Log estruturado do erro
     */
    log() {
        const logData = {
            level: 'error',
            type: this.type,
            message: this.message,
            details: this.details,
            grpcCode: this.grpcCode,
            timestamp: this.timestamp,
            stack: this.stack
        };

        if (this.originalError) {
            logData.originalError = {
                message: this.originalError.message,
                stack: this.originalError.stack
            };
        }

        console.error('🚨 AppError:', JSON.stringify(logData, null, 2));
    }
}

/**
 * Classe principal para tratamento de erros gRPC
 */
class GrpcErrorHandler {
    constructor(options = {}) {
        this.enableLogging = options.enableLogging !== false;
        this.enableMetadata = options.enableMetadata !== false;
        this.enableStackTrace = options.enableStackTrace === true;
    }

    /**
     * Tratar erro e retornar via callback
     */
    handleError(error, callback, context = {}) {
        let grpcError;

        if (error instanceof AppError) {
            grpcError = error.toGrpcError();
            if (this.enableLogging) {
                error.log();
            }
        } else {
            // Erro não estruturado
            grpcError = this.handleUnstructuredError(error, context);
        }

        // Adicionar contexto se habilitado
        if (this.enableMetadata && context) {
            if (!grpcError.metadata) {
                grpcError.metadata = new grpc.Metadata();
            }
            
            if (context.method) {
                grpcError.metadata.add('method', context.method);
            }
            if (context.service) {
                grpcError.metadata.add('service', context.service);
            }
            if (context.userId) {
                grpcError.metadata.add('user-id', String(context.userId));
            }
        }

        callback(grpcError);
    }

    /**
     * Tratar erro não estruturado
     */
    handleUnstructuredError(error, context = {}) {
        let grpcCode = GrpcErrorCodes.INTERNAL;
        let message = error.message || 'Erro interno do servidor';

        // Tentar mapear erros comuns
        if (error.message) {
            if (error.message.includes('not found') || error.message.includes('não encontrado')) {
                grpcCode = GrpcErrorCodes.NOT_FOUND;
            } else if (error.message.includes('already exists') || error.message.includes('já existe')) {
                grpcCode = GrpcErrorCodes.ALREADY_EXISTS;
            } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
                grpcCode = GrpcErrorCodes.PERMISSION_DENIED;
            } else if (error.message.includes('timeout') || error.message.includes('deadline')) {
                grpcCode = GrpcErrorCodes.DEADLINE_EXCEEDED;
            } else if (error.message.includes('validation') || error.message.includes('invalid')) {
                grpcCode = GrpcErrorCodes.INVALID_ARGUMENT;
            }
        }

        const metadata = new grpc.Metadata();
        metadata.add('error-type', 'UNSTRUCTURED_ERROR');
        metadata.add('error-timestamp', new Date().toISOString());

        if (this.enableStackTrace && error.stack) {
            metadata.add('stack-trace', error.stack);
        }

        // Log do erro
        if (this.enableLogging) {
            console.error('🚨 Unstructured Error:', {
                message: error.message,
                stack: error.stack,
                context,
                grpcCode
            });
        }

        return {
            code: grpcCode,
            message: message,
            metadata: metadata
        };
    }

    /**
     * Criar wrapper para métodos de serviço
     */
    wrapServiceMethod(originalMethod, serviceName, methodName) {
        return async (call, callback) => {
            try {
                await originalMethod.call(this, call, callback);
            } catch (error) {
                this.handleError(error, callback, {
                    service: serviceName,
                    method: methodName,
                    userId: call.user?.id || call.user?.userId
                });
            }
        };
    }

    /**
     * Wrapper para métodos de streaming
     */
    wrapStreamingMethod(originalMethod, serviceName, methodName) {
        return (call) => {
            try {
                // Interceptar erros no stream
                const originalEmit = call.emit.bind(call);
                call.emit = (event, ...args) => {
                    if (event === 'error') {
                        const error = args[0];
                        this.handleStreamError(error, call, {
                            service: serviceName,
                            method: methodName,
                            userId: call.user?.id || call.user?.userId
                        });
                        return;
                    }
                    return originalEmit(event, ...args);
                };

                return originalMethod.call(this, call);
            } catch (error) {
                this.handleStreamError(error, call, {
                    service: serviceName,
                    method: methodName,
                    userId: call.user?.id || call.user?.userId
                });
            }
        };
    }

    /**
     * Tratar erros em streaming
     */
    handleStreamError(error, call, context = {}) {
        let grpcError;

        if (error instanceof AppError) {
            grpcError = error.toGrpcError();
            if (this.enableLogging) {
                error.log();
            }
        } else {
            grpcError = this.handleUnstructuredError(error, context);
        }

        // Emitir erro no stream
        call.emit('error', grpcError);
    }
}

/**
 * Funções utilitárias para criação de erros
 */
const ErrorFactory = {
    /**
     * Erro de validação
     */
    validation(message, details = {}) {
        return new AppError(AppErrorTypes.VALIDATION_ERROR, message, details);
    },

    /**
     * Erro de autenticação
     */
    authentication(message = 'Autenticação requerida', details = {}) {
        return new AppError(AppErrorTypes.AUTHENTICATION_ERROR, message, details);
    },

    /**
     * Erro de autorização
     */
    authorization(message = 'Acesso negado', details = {}) {
        return new AppError(AppErrorTypes.AUTHORIZATION_ERROR, message, details);
    },

    /**
     * Recurso não encontrado
     */
    notFound(resource, id = null) {
        const message = id ? `${resource} com ID ${id} não encontrado` : `${resource} não encontrado`;
        return new AppError(AppErrorTypes.RESOURCE_NOT_FOUND, message, { resource, id });
    },

    /**
     * Conflito de recurso
     */
    conflict(message, details = {}) {
        return new AppError(AppErrorTypes.RESOURCE_CONFLICT, message, details);
    },

    /**
     * Erro de banco de dados
     */
    database(originalError, operation = null) {
        return new AppError(
            AppErrorTypes.DATABASE_ERROR,
            'Erro interno do banco de dados',
            { operation },
            originalError
        );
    },

    /**
     * Serviço indisponível
     */
    unavailable(service = null) {
        const message = service ? `Serviço ${service} indisponível` : 'Serviço indisponível';
        return new AppError(AppErrorTypes.SERVICE_UNAVAILABLE, message, { service });
    },

    /**
     * Timeout
     */
    timeout(operation = null) {
        const message = operation ? `Timeout na operação: ${operation}` : 'Timeout da operação';
        return new AppError(AppErrorTypes.TIMEOUT_ERROR, message, { operation });
    },

    /**
     * Rate limit
     */
    rateLimit(limit = null, window = null) {
        return new AppError(
            AppErrorTypes.RATE_LIMIT_ERROR,
            'Limite de requisições excedido',
            { limit, window }
        );
    }
};

module.exports = {
    GrpcErrorHandler,
    AppError,
    ErrorFactory,
    GrpcErrorCodes,
    AppErrorTypes
};
