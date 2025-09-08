const grpc = require('@grpc/grpc-js');
const { GrpcLoadBalancer, LoadBalancingStrategies } = require('./loadBalancer');
const { ResilientGrpcClient } = require('./resilientClient');

/**
 * Cliente gRPC com Load Balancing
 * 
 * Integra load balancer com cliente resiliente para
 * distribuir requisições entre múltiplos servidores backend
 */

class LoadBalancedGrpcClient {
    constructor(serviceDefinition, options = {}) {
        this.serviceDefinition = serviceDefinition;
        this.loadBalancer = new GrpcLoadBalancer({
            strategy: options.strategy || LoadBalancingStrategies.ROUND_ROBIN,
            healthCheckInterval: options.healthCheckInterval || 30000,
            healthCheckTimeout: options.healthCheckTimeout || 5000,
            enableHealthChecks: options.enableHealthChecks !== false,
            stickySession: options.stickySession || false
        });
        
        // Pool de clientes reutilizáveis
        this.clientPool = new Map();
        this.maxClientsPerServer = options.maxClientsPerServer || 5;
        
        // Configurações do cliente resiliente
        this.resilientOptions = {
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 1000,
            retryBackoffFactor: options.retryBackoffFactor || 2,
            timeout: options.timeout || 10000,
            circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
            circuitBreakerTimeout: options.circuitBreakerTimeout || 60000
        };
        
        // Métricas de requisições
        this.requestMetrics = {
            total: 0,
            successful: 0,
            failed: 0,
            byServer: new Map()
        };
        
        console.log(`🔄 Load Balanced gRPC Client iniciado - Estratégia: ${this.loadBalancer.strategy}`);
        
        // Event listeners do load balancer
        this.setupLoadBalancerListeners();
    }

    /**
     * Configurar listeners do load balancer
     */
    setupLoadBalancerListeners() {
        this.loadBalancer.on('serverSelected', (server, strategy) => {
            console.log(`🎯 Servidor selecionado: ${server.id} (estratégia: ${strategy})`);
        });

        this.loadBalancer.on('serverUnhealthy', (server, error) => {
            console.log(`❌ Servidor não saudável: ${server.id} - ${error.message}`);
            // Remover clientes do pool para este servidor
            this.removeServerFromPool(server.id);
        });

        this.loadBalancer.on('serverHealthy', (server) => {
            console.log(`✅ Servidor saudável: ${server.id}`);
        });
    }

    /**
     * Adicionar servidor backend
     */
    addServer(host, port, options = {}) {
        return this.loadBalancer.addServer(host, port, options);
    }

    /**
     * Remover servidor backend
     */
    removeServer(serverId) {
        this.removeServerFromPool(serverId);
        this.loadBalancer.removeServer(serverId);
    }

    /**
     * Obter ou criar cliente para servidor específico
     */
    getClientForServer(server) {
        const serverClients = this.clientPool.get(server.id) || [];
        
        // Procurar cliente disponível (não em uso)
        let availableClient = serverClients.find(clientInfo => !clientInfo.inUse);
        
        if (!availableClient && serverClients.length < this.maxClientsPerServer) {
            // Criar novo cliente
            const address = `${server.host}:${server.port}`;
            const grpcClient = new this.serviceDefinition(
                address,
                grpc.credentials.createInsecure()
            );
            
            const resilientClient = new ResilientGrpcClient(
                grpcClient,
                this.resilientOptions
            );
            
            availableClient = {
                resilientClient,
                grpcClient,
                serverId: server.id,
                address,
                inUse: false,
                createdAt: Date.now(),
                lastUsed: Date.now()
            };
            
            serverClients.push(availableClient);
            this.clientPool.set(server.id, serverClients);
            
            console.log(`🔧 Novo cliente criado para ${server.id} (pool: ${serverClients.length}/${this.maxClientsPerServer})`);
        }
        
        if (availableClient) {
            availableClient.inUse = true;
            availableClient.lastUsed = Date.now();
        }
        
        return availableClient;
    }

    /**
     * Liberar cliente após uso
     */
    releaseClient(clientInfo) {
        if (clientInfo) {
            clientInfo.inUse = false;
        }
    }

    /**
     * Remover servidor do pool de clientes
     */
    removeServerFromPool(serverId) {
        const serverClients = this.clientPool.get(serverId);
        if (serverClients) {
            // Fechar todas as conexões
            serverClients.forEach(clientInfo => {
                try {
                    clientInfo.grpcClient.close();
                } catch (error) {
                    console.log(`⚠️ Erro ao fechar cliente ${serverId}: ${error.message}`);
                }
            });
            
            this.clientPool.delete(serverId);
            console.log(`🗑️ Pool de clientes removido para ${serverId}`);
        }
    }

    /**
     * Executar chamada gRPC com load balancing
     */
    async call(methodName, request, metadata = {}, clientInfo = {}) {
        const startTime = Date.now();
        this.requestMetrics.total++;
        
        // Adicionar informações do cliente para load balancing
        const extendedClientInfo = {
            sessionId: metadata.sessionId || clientInfo.sessionId,
            clientIp: metadata.clientIp || clientInfo.clientIp || '127.0.0.1',
            userId: metadata.userId || clientInfo.userId,
            ...clientInfo
        };
        
        let selectedServer;
        let clientWrapper;
        
        try {
            // Selecionar servidor usando load balancer
            selectedServer = this.loadBalancer.selectServer(extendedClientInfo);
            console.log(`🎯 Servidor selecionado para ${methodName}: ${selectedServer.id}`);
            
            // Obter cliente para o servidor selecionado
            clientWrapper = this.getClientForServer(selectedServer);
            
            if (!clientWrapper) {
                throw new Error(`Não foi possível obter cliente para servidor ${selectedServer.id}`);
            }
            
            // Adicionar metadata do servidor
            const enrichedMetadata = {
                ...metadata,
                'x-server-id': selectedServer.id,
                'x-load-balancer-strategy': this.loadBalancer.strategy,
                'x-request-id': this.generateRequestId()
            };
            
            // Executar chamada usando cliente resiliente
            const result = await clientWrapper.resilientClient.call(
                methodName,
                request,
                enrichedMetadata
            );
            
            // Registrar sucesso
            const responseTime = Date.now() - startTime;
            this.recordSuccess(selectedServer.id, responseTime);
            this.loadBalancer.onRequestCompleted(selectedServer.id, true, responseTime);
            
            console.log(`✅ Chamada ${methodName} concluída com sucesso em ${responseTime}ms via ${selectedServer.id}`);
            
            return result;
            
        } catch (error) {
            // Registrar falha
            const responseTime = Date.now() - startTime;
            const serverId = selectedServer ? selectedServer.id : 'unknown';
            this.recordFailure(serverId, responseTime);
            
            if (selectedServer) {
                this.loadBalancer.onRequestCompleted(selectedServer.id, false, responseTime);
            }
            
            console.log(`❌ Falha na chamada ${methodName} após ${responseTime}ms: ${error.message}`);
            
            // Re-throw com informações adicionais
            const enhancedError = new Error(`Load Balanced gRPC call failed: ${error.message}`);
            enhancedError.originalError = error;
            enhancedError.serverId = serverId;
            enhancedError.method = methodName;
            enhancedError.responseTime = responseTime;
            
            throw enhancedError;
            
        } finally {
            // Liberar cliente
            if (clientWrapper) {
                this.releaseClient(clientWrapper);
            }
        }
    }

    /**
     * Wrapper para chamadas específicas
     */
    async authenticate(credentials, metadata = {}) {
        return this.call('authenticate', credentials, metadata);
    }

    async createTask(taskData, metadata = {}) {
        return this.call('createTask', taskData, metadata);
    }

    async getTasks(filter, metadata = {}) {
        return this.call('getTasks', filter, metadata);
    }

    async updateTask(updateData, metadata = {}) {
        return this.call('updateTask', updateData, metadata);
    }

    async deleteTask(taskId, metadata = {}) {
        return this.call('deleteTask', taskId, metadata);
    }

    /**
     * Registrar sucesso
     */
    recordSuccess(serverId, responseTime) {
        this.requestMetrics.successful++;
        this.updateServerMetrics(serverId, true, responseTime);
    }

    /**
     * Registrar falha
     */
    recordFailure(serverId, responseTime) {
        this.requestMetrics.failed++;
        this.updateServerMetrics(serverId, false, responseTime);
    }

    /**
     * Atualizar métricas por servidor
     */
    updateServerMetrics(serverId, success, responseTime) {
        if (!this.requestMetrics.byServer.has(serverId)) {
            this.requestMetrics.byServer.set(serverId, {
                total: 0,
                successful: 0,
                failed: 0,
                totalResponseTime: 0
            });
        }
        
        const serverMetrics = this.requestMetrics.byServer.get(serverId);
        serverMetrics.total++;
        serverMetrics.totalResponseTime += responseTime;
        
        if (success) {
            serverMetrics.successful++;
        } else {
            serverMetrics.failed++;
        }
    }

    /**
     * Gerar ID único para requisição
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Obter métricas do cliente
     */
    getMetrics() {
        const serverMetrics = {};
        
        this.requestMetrics.byServer.forEach((metrics, serverId) => {
            const avgResponseTime = metrics.total > 0 ? metrics.totalResponseTime / metrics.total : 0;
            const successRate = metrics.total > 0 ? (metrics.successful / metrics.total) * 100 : 0;
            
            serverMetrics[serverId] = {
                total: metrics.total,
                successful: metrics.successful,
                failed: metrics.failed,
                successRate: successRate.toFixed(2) + '%',
                averageResponseTime: avgResponseTime.toFixed(2) + 'ms'
            };
        });
        
        const globalSuccessRate = this.requestMetrics.total > 0 ? 
            (this.requestMetrics.successful / this.requestMetrics.total) * 100 : 0;
        
        return {
            global: {
                total: this.requestMetrics.total,
                successful: this.requestMetrics.successful,
                failed: this.requestMetrics.failed,
                successRate: globalSuccessRate.toFixed(2) + '%'
            },
            byServer: serverMetrics,
            clientPool: this.getClientPoolStats(),
            loadBalancer: this.loadBalancer.getStats()
        };
    }

    /**
     * Obter estatísticas do pool de clientes
     */
    getClientPoolStats() {
        const poolStats = {};
        
        this.clientPool.forEach((clients, serverId) => {
            poolStats[serverId] = {
                total: clients.length,
                inUse: clients.filter(c => c.inUse).length,
                available: clients.filter(c => !c.inUse).length
            };
        });
        
        return poolStats;
    }

    /**
     * Relatório detalhado
     */
    getDetailedReport() {
        const metrics = this.getMetrics();
        
        console.log('\n📊 ===== RELATÓRIO DO CLIENTE LOAD BALANCED =====');
        console.log(`🌐 Total de requisições: ${metrics.global.total}`);
        console.log(`✅ Sucessos: ${metrics.global.successful} (${metrics.global.successRate})`);
        console.log(`❌ Falhas: ${metrics.global.failed}`);
        
        console.log('\n📈 Métricas por servidor:');
        Object.entries(metrics.byServer).forEach(([serverId, serverMetrics]) => {
            console.log(`   🖥️  ${serverId}:`);
            console.log(`      Total: ${serverMetrics.total} req`);
            console.log(`      Sucesso: ${serverMetrics.successRate}`);
            console.log(`      Tempo médio: ${serverMetrics.averageResponseTime}`);
        });
        
        console.log('\n🏊 Pool de clientes:');
        Object.entries(metrics.clientPool).forEach(([serverId, poolInfo]) => {
            console.log(`   ${serverId}: ${poolInfo.inUse}/${poolInfo.total} em uso`);
        });
        
        // Relatório do load balancer
        this.loadBalancer.getDetailedReport();
        
        console.log('================================================\n');
        
        return metrics;
    }

    /**
     * Limpeza de clientes inativos
     */
    cleanupIdleClients(maxIdleTime = 5 * 60 * 1000) { // 5 minutos
        const now = Date.now();
        let cleanedCount = 0;
        
        this.clientPool.forEach((clients, serverId) => {
            const activeClients = clients.filter(clientInfo => {
                if (!clientInfo.inUse && (now - clientInfo.lastUsed) > maxIdleTime) {
                    // Fechar cliente inativo
                    try {
                        clientInfo.grpcClient.close();
                        cleanedCount++;
                    } catch (error) {
                        console.log(`⚠️ Erro ao fechar cliente inativo: ${error.message}`);
                    }
                    return false;
                }
                return true;
            });
            
            if (activeClients.length !== clients.length) {
                this.clientPool.set(serverId, activeClients);
            }
        });
        
        if (cleanedCount > 0) {
            console.log(`🧹 ${cleanedCount} clientes inativos removidos`);
        }
    }

    /**
     * Resetar métricas
     */
    resetMetrics() {
        this.requestMetrics = {
            total: 0,
            successful: 0,
            failed: 0,
            byServer: new Map()
        };
        
        this.loadBalancer.resetStats();
        console.log('📊 Métricas do cliente resetadas');
    }

    /**
     * Destruir cliente e recursos
     */
    async destroy() {
        console.log('🧹 Destruindo Load Balanced gRPC Client...');
        
        // Fechar todos os clientes
        for (const [serverId, clients] of this.clientPool) {
            clients.forEach(clientInfo => {
                try {
                    clientInfo.grpcClient.close();
                } catch (error) {
                    console.log(`⚠️ Erro ao fechar cliente ${serverId}: ${error.message}`);
                }
            });
        }
        
        this.clientPool.clear();
        this.loadBalancer.destroy();
        
        console.log('✅ Load Balanced gRPC Client destruído');
    }
}

module.exports = {
    LoadBalancedGrpcClient
};
