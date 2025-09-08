const { GrpcErrorHandler, ErrorFactory } = require('../utils/errorHandler');

/**
 * Interceptador de Erros gRPC
 * 
 * Middleware que intercepta todos os erros dos serviços gRPC
 * e aplica tratamento consistente
 */
class GrpcErrorInterceptor {
    constructor(options = {}) {
        this.errorHandler = new GrpcErrorHandler({
            enableLogging: options.enableLogging !== false,
            enableMetadata: options.enableMetadata !== false,
            enableStackTrace: options.enableStackTrace === true
        });
        
        this.metrics = {
            totalErrors: 0,
            errorsByType: new Map(),
            errorsByService: new Map(),
            errorsByCode: new Map()
        };

        console.log('🛡️ Interceptador de erros gRPC inicializado');
    }

    /**
     * Interceptar métodos unários
     */
    interceptUnary(call, originalMethod, serviceInstance, methodName, serviceName) {
        return new Promise((resolve, reject) => {
            const wrappedCallback = (error, response) => {
                if (error) {
                    this.trackError(error, serviceName, methodName);
                    this.errorHandler.handleError(error, (grpcError) => {
                        reject(grpcError);
                    }, {
                        service: serviceName,
                        method: methodName,
                        userId: call.user?.id || call.user?.userId
                    });
                } else {
                    resolve(response);
                }
            };

            try {
                originalMethod.call(serviceInstance, call, wrappedCallback);
            } catch (error) {
                this.trackError(error, serviceName, methodName);
                this.errorHandler.handleError(error, (grpcError) => {
                    reject(grpcError);
                }, {
                    service: serviceName,
                    method: methodName,
                    userId: call.user?.id || call.user?.userId
                });
            }
        });
    }

    /**
     * Interceptar métodos de streaming
     */
    interceptStreaming(call, originalMethod, serviceInstance, methodName, serviceName) {
        try {
            // Interceptar erros emitidos pelo stream
            const originalEmit = call.emit.bind(call);
            call.emit = (event, ...args) => {
                if (event === 'error') {
                    const error = args[0];
                    this.trackError(error, serviceName, methodName);
                    this.errorHandler.handleStreamError(error, call, {
                        service: serviceName,
                        method: methodName,
                        userId: call.user?.id || call.user?.userId
                    });
                    return;
                }
                return originalEmit(event, ...args);
            };

            // Interceptar erros síncronos
            const result = originalMethod.call(serviceInstance, call);
            
            // Se retornar uma Promise, interceptar erros assíncronos
            if (result && typeof result.catch === 'function') {
                result.catch(error => {
                    this.trackError(error, serviceName, methodName);
                    this.errorHandler.handleStreamError(error, call, {
                        service: serviceName,
                        method: methodName,
                        userId: call.user?.id || call.user?.userId
                    });
                });
            }

            return result;
        } catch (error) {
            this.trackError(error, serviceName, methodName);
            this.errorHandler.handleStreamError(error, call, {
                service: serviceName,
                method: methodName,
                userId: call.user?.id || call.user?.userId
            });
        }
    }

    /**
     * Rastrear métricas de erro
     */
    trackError(error, serviceName, methodName) {
        this.metrics.totalErrors++;

        // Por tipo de erro
        const errorType = error.type || 'UNKNOWN';
        this.metrics.errorsByType.set(errorType, (this.metrics.errorsByType.get(errorType) || 0) + 1);

        // Por serviço
        this.metrics.errorsByService.set(serviceName, (this.metrics.errorsByService.get(serviceName) || 0) + 1);

        // Por código gRPC
        const grpcCode = error.grpcCode || error.code || 'UNKNOWN';
        this.metrics.errorsByCode.set(grpcCode, (this.metrics.errorsByCode.get(grpcCode) || 0) + 1);
    }

    /**
     * Obter métricas de erro
     */
    getMetrics() {
        return {
            totalErrors: this.metrics.totalErrors,
            errorsByType: Object.fromEntries(this.metrics.errorsByType),
            errorsByService: Object.fromEntries(this.metrics.errorsByService),
            errorsByCode: Object.fromEntries(this.metrics.errorsByCode)
        };
    }

    /**
     * Resetar métricas
     */
    resetMetrics() {
        this.metrics.totalErrors = 0;
        this.metrics.errorsByType.clear();
        this.metrics.errorsByService.clear();
        this.metrics.errorsByCode.clear();
    }

    /**
     * Relatório de erros
     */
    getErrorReport() {
        const metrics = this.getMetrics();
        
        console.log('\n📊 ===== RELATÓRIO DE ERROS gRPC =====');
        console.log(`📈 Total de erros: ${metrics.totalErrors}`);
        
        if (Object.keys(metrics.errorsByType).length > 0) {
            console.log('\n🏷️ Erros por tipo:');
            Object.entries(metrics.errorsByType).forEach(([type, count]) => {
                console.log(`   ${type}: ${count}`);
            });
        }
        
        if (Object.keys(metrics.errorsByService).length > 0) {
            console.log('\n🏛️ Erros por serviço:');
            Object.entries(metrics.errorsByService).forEach(([service, count]) => {
                console.log(`   ${service}: ${count}`);
            });
        }
        
        if (Object.keys(metrics.errorsByCode).length > 0) {
            console.log('\n🔢 Erros por código gRPC:');
            Object.entries(metrics.errorsByCode).forEach(([code, count]) => {
                console.log(`   ${code}: ${count}`);
            });
        }
        
        console.log('=====================================\n');
        
        return metrics;
    }
}

module.exports = GrpcErrorInterceptor;
