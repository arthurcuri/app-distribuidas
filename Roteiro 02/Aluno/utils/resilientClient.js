const grpc = require('@grpc/grpc-js');
const { GrpcErrorCodes } = require('../utils/errorHandler');

/**
 * Cliente gRPC com Tratamento Robusto de Erros
 * 
 * Implementa:
 * - Retry automático para erros temporários
 * - Circuit breaker pattern
 * - Logging estruturado de erros
 * - Fallback strategies
 * - Timeout configurável
 */
class ResilientGrpcClient {
    constructor(options = {}) {
        this.retryOptions = {
            maxRetries: options.maxRetries || 3,
            initialDelay: options.initialDelay || 1000,
            maxDelay: options.maxDelay || 10000,
            backoffMultiplier: options.backoffMultiplier || 2,
            retryableErrors: options.retryableErrors || [
                GrpcErrorCodes.UNAVAILABLE,
                GrpcErrorCodes.DEADLINE_EXCEEDED,
                GrpcErrorCodes.RESOURCE_EXHAUSTED,
                GrpcErrorCodes.ABORTED
            ]
        };

        this.circuitBreaker = {
            enabled: options.circuitBreaker !== false,
            failureThreshold: options.failureThreshold || 5,
            resetTimeout: options.resetTimeout || 30000,
            state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
            failures: 0,
            lastFailureTime: null
        };

        this.timeoutMs = options.timeoutMs || 30000;
        this.enableLogging = options.enableLogging !== false;
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            retriedRequests: 0,
            circuitBreakerTrips: 0
        };
    }

    /**
     * Executar chamada gRPC com tratamento de erro
     */
    async call(client, method, request, options = {}) {
        this.metrics.totalRequests++;

        // Verificar circuit breaker
        if (this.circuitBreaker.enabled && this.isCircuitOpen()) {
            const error = new Error('Circuit breaker is OPEN');
            error.code = GrpcErrorCodes.UNAVAILABLE;
            throw error;
        }

        const callOptions = {
            deadline: Date.now() + (options.timeout || this.timeoutMs),
            ...options
        };

        let lastError;
        let attempt = 0;

        while (attempt <= this.retryOptions.maxRetries) {
            try {
                if (attempt > 0) {
                    this.metrics.retriedRequests++;
                    await this.delay(this.calculateDelay(attempt));
                }

                const result = await this.executeCall(client, method, request, callOptions);
                
                // Sucesso - resetar circuit breaker
                this.onCallSuccess();
                return result;

            } catch (error) {
                lastError = error;
                attempt++;

                if (this.enableLogging) {
                    this.logError(error, method, attempt);
                }

                // Verificar se deve fazer retry
                if (attempt <= this.retryOptions.maxRetries && this.shouldRetry(error)) {
                    continue;
                }

                // Falha final
                this.onCallFailure(error);
                break;
            }
        }

        throw lastError;
    }

    /**
     * Executar chamada gRPC individual
     */
    async executeCall(client, method, request, options) {
        return new Promise((resolve, reject) => {
            const call = client[method](request, options, (error, response) => {
                if (error) {
                    return reject(this.enhanceError(error));
                }
                resolve(response);
            });

            // Adicionar timeout adicional se necessário
            if (options.timeout) {
                setTimeout(() => {
                    call.cancel();
                    reject(this.createTimeoutError());
                }, options.timeout);
            }
        });
    }

    /**
     * Executar streaming call com tratamento de erro
     */
    async streamCall(client, method, request, options = {}) {
        this.metrics.totalRequests++;

        // Verificar circuit breaker
        if (this.circuitBreaker.enabled && this.isCircuitOpen()) {
            throw new Error('Circuit breaker is OPEN - streaming call rejected');
        }

        const callOptions = {
            deadline: Date.now() + (options.timeout || this.timeoutMs),
            ...options
        };

        try {
            const stream = client[method](request, callOptions);
            
            // Adicionar handlers de erro
            stream.on('error', (error) => {
                this.onCallFailure(this.enhanceError(error));
            });

            stream.on('end', () => {
                this.onCallSuccess();
            });

            return stream;

        } catch (error) {
            this.onCallFailure(this.enhanceError(error));
            throw error;
        }
    }

    /**
     * Verificar se deve fazer retry
     */
    shouldRetry(error) {
        return this.retryOptions.retryableErrors.includes(error.code);
    }

    /**
     * Calcular delay para retry
     */
    calculateDelay(attempt) {
        const delay = Math.min(
            this.retryOptions.initialDelay * Math.pow(this.retryOptions.backoffMultiplier, attempt - 1),
            this.retryOptions.maxDelay
        );
        
        // Adicionar jitter para evitar thundering herd
        return delay + Math.random() * 1000;
    }

    /**
     * Delay assíncrono
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Verificar se circuit breaker está aberto
     */
    isCircuitOpen() {
        if (this.circuitBreaker.state === 'OPEN') {
            const now = Date.now();
            if (now - this.circuitBreaker.lastFailureTime >= this.circuitBreaker.resetTimeout) {
                this.circuitBreaker.state = 'HALF_OPEN';
                return false;
            }
            return true;
        }
        return false;
    }

    /**
     * Callback para sucesso da chamada
     */
    onCallSuccess() {
        this.metrics.successfulRequests++;
        
        if (this.circuitBreaker.enabled) {
            this.circuitBreaker.failures = 0;
            if (this.circuitBreaker.state === 'HALF_OPEN') {
                this.circuitBreaker.state = 'CLOSED';
                if (this.enableLogging) {
                    console.log('🔄 Circuit breaker CLOSED - service recovered');
                }
            }
        }
    }

    /**
     * Callback para falha da chamada
     */
    onCallFailure(error) {
        this.metrics.failedRequests++;

        if (this.circuitBreaker.enabled) {
            this.circuitBreaker.failures++;
            this.circuitBreaker.lastFailureTime = Date.now();

            if (this.circuitBreaker.failures >= this.circuitBreaker.failureThreshold) {
                this.circuitBreaker.state = 'OPEN';
                this.metrics.circuitBreakerTrips++;
                
                if (this.enableLogging) {
                    console.log(`⚡ Circuit breaker OPEN - ${this.circuitBreaker.failures} failures detected`);
                }
            }
        }
    }

    /**
     * Melhorar informações do erro
     */
    enhanceError(error) {
        // Adicionar informações úteis ao erro
        error.timestamp = new Date().toISOString();
        error.retryable = this.shouldRetry(error);
        error.circuitBreakerState = this.circuitBreaker.state;

        // Extrair metadata se disponível
        if (error.metadata && typeof error.metadata.getMap === 'function') {
            try {
                const metadata = {};
                for (const [key, values] of error.metadata.getMap()) {
                    metadata[key] = values[0]; // Pegar primeiro valor
                }
                error.grpcMetadata = metadata;
            } catch (metadataError) {
                // Ignorar erro de metadata
                error.grpcMetadata = { error: 'Failed to parse metadata' };
            }
        } else if (error.metadata && typeof error.metadata.get === 'function') {
            // Tentar método alternativo
            try {
                const metadata = {};
                const keys = ['error-type', 'error-timestamp', 'error-details', 'method', 'service', 'user-id'];
                for (const key of keys) {
                    const value = error.metadata.get(key);
                    if (value && value.length > 0) {
                        metadata[key] = value[0];
                    }
                }
                error.grpcMetadata = metadata;
            } catch (metadataError) {
                error.grpcMetadata = { error: 'Failed to parse metadata (alt)' };
            }
        }

        return error;
    }

    /**
     * Criar erro de timeout
     */
    createTimeoutError() {
        const error = new Error('Request timeout exceeded');
        error.code = GrpcErrorCodes.DEADLINE_EXCEEDED;
        error.timestamp = new Date().toISOString();
        error.retryable = true;
        return error;
    }

    /**
     * Log estruturado de erro
     */
    logError(error, method, attempt) {
        const logData = {
            level: 'error',
            method: method,
            attempt: attempt,
            maxRetries: this.retryOptions.maxRetries,
            error: {
                code: error.code,
                message: error.message,
                retryable: this.shouldRetry(error)
            },
            circuitBreaker: {
                state: this.circuitBreaker.state,
                failures: this.circuitBreaker.failures
            },
            timestamp: new Date().toISOString()
        };

        if (error.grpcMetadata) {
            logData.metadata = error.grpcMetadata;
        }

        console.error('🚨 gRPC Error:', JSON.stringify(logData, null, 2));
    }

    /**
     * Obter métricas do cliente
     */
    getMetrics() {
        return {
            ...this.metrics,
            circuitBreaker: {
                state: this.circuitBreaker.state,
                failures: this.circuitBreaker.failures,
                lastFailureTime: this.circuitBreaker.lastFailureTime
            },
            successRate: this.metrics.totalRequests > 0 
                ? (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * Resetar métricas
     */
    resetMetrics() {
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            retriedRequests: 0,
            circuitBreakerTrips: 0
        };
    }

    /**
     * Resetar circuit breaker manualmente
     */
    resetCircuitBreaker() {
        this.circuitBreaker.state = 'CLOSED';
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.lastFailureTime = null;
        
        if (this.enableLogging) {
            console.log('🔄 Circuit breaker manually reset');
        }
    }

    /**
     * Relatório de status
     */
    getStatusReport() {
        const metrics = this.getMetrics();
        
        console.log('\n📊 ===== STATUS DO CLIENTE gRPC =====');
        console.log(`📈 Total de requisições: ${metrics.totalRequests}`);
        console.log(`✅ Sucessos: ${metrics.successfulRequests}`);
        console.log(`❌ Falhas: ${metrics.failedRequests}`);
        console.log(`🔄 Retries: ${metrics.retriedRequests}`);
        console.log(`⚡ Circuit breaker trips: ${metrics.circuitBreakerTrips}`);
        console.log(`📊 Taxa de sucesso: ${metrics.successRate}`);
        console.log(`🔌 Circuit breaker: ${metrics.circuitBreaker.state}`);
        
        if (metrics.circuitBreaker.failures > 0) {
            console.log(`💥 Falhas consecutivas: ${metrics.circuitBreaker.failures}`);
        }
        
        console.log('=====================================\n');
        
        return metrics;
    }
}

module.exports = ResilientGrpcClient;
