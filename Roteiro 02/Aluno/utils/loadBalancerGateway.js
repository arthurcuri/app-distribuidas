const grpc = require('@grpc/grpc-js');
const { GrpcLoadBalancer, LoadBalancingStrategies } = require('../utils/loadBalancer');
const { GrpcErrorInterceptor } = require('../middleware/errorInterceptor');

/**
 * Gateway/Proxy gRPC com Load Balancing
 * 
 * Atua como ponto único de entrada que distribui requisições
 * entre múltiplos servidores backend usando load balancing
 */

class GrpcLoadBalancerGateway {
    constructor(options = {}) {
        this.port = options.port || 50051;
        this.loadBalancer = new GrpcLoadBalancer({
            strategy: options.strategy || LoadBalancingStrategies.ROUND_ROBIN,
            healthCheckInterval: options.healthCheckInterval || 30000,
            healthCheckTimeout: options.healthCheckTimeout || 5000,
            enableHealthChecks: options.enableHealthChecks !== false,
            stickySession: options.stickySession || false
        });
        
        this.server = new grpc.Server();
        this.backendClients = new Map(); // Cache de clientes para backends
        this.errorInterceptor = new GrpcErrorInterceptor();
        
        // Métricas do gateway
        this.gatewayMetrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            startTime: Date.now()
        };
        
        console.log(`🚪 Load Balancer Gateway iniciado na porta ${this.port}`);
        this.setupEventListeners();
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        this.loadBalancer.on('serverSelected', (server, strategy) => {
            console.log(`🎯 Gateway: Servidor selecionado: ${server.id} (estratégia: ${strategy})`);
        });

        this.loadBalancer.on('serverUnhealthy', (server, error) => {
            console.log(`❌ Gateway: Servidor não saudável: ${server.id}`);
            // Remover cliente do cache
            this.removeBackendClient(server.id);
        });

        this.loadBalancer.on('serverHealthy', (server) => {
            console.log(`✅ Gateway: Servidor saudável: ${server.id}`);
        });
    }

    /**
     * Adicionar servidor backend
     */
    addBackendServer(host, port, options = {}) {
        return this.loadBalancer.addServer(host, port, options);
    }

    /**
     * Remover servidor backend
     */
    removeBackendServer(serverId) {
        this.removeBackendClient(serverId);
        this.loadBalancer.removeServer(serverId);
    }

    /**
     * Obter ou criar cliente para servidor backend
     */
    getBackendClient(server, serviceDefinition) {
        const clientKey = `${server.id}_${serviceDefinition.name || 'default'}`;
        
        if (!this.backendClients.has(clientKey)) {
            const address = `${server.host}:${server.port}`;
            const client = new serviceDefinition(
                address,
                grpc.credentials.createInsecure()
            );
            
            this.backendClients.set(clientKey, {
                client,
                serverId: server.id,
                address,
                createdAt: Date.now(),
                lastUsed: Date.now()
            });
            
            console.log(`🔧 Cliente backend criado: ${clientKey}`);
        }
        
        const clientInfo = this.backendClients.get(clientKey);
        clientInfo.lastUsed = Date.now();
        
        return clientInfo.client;
    }

    /**
     * Remover cliente backend do cache
     */
    removeBackendClient(serverId) {
        const keysToRemove = [];
        
        this.backendClients.forEach((clientInfo, key) => {
            if (clientInfo.serverId === serverId) {
                try {
                    clientInfo.client.close();
                    keysToRemove.push(key);
                } catch (error) {
                    console.log(`⚠️ Erro ao fechar cliente backend: ${error.message}`);
                }
            }
        });
        
        keysToRemove.forEach(key => this.backendClients.delete(key));
        
        if (keysToRemove.length > 0) {
            console.log(`🗑️ ${keysToRemove.length} clientes backend removidos para ${serverId}`);
        }
    }

    /**
     * Criar proxy para método gRPC
     */
    createMethodProxy(methodName, serviceDefinition) {
        return async (call, callback) => {
            const startTime = Date.now();
            this.gatewayMetrics.totalRequests++;
            
            // Extrair informações do cliente
            const metadata = call.metadata;
            const clientInfo = {
                clientIp: this.extractClientIp(call),
                sessionId: metadata.get('session-id')?.[0],
                userId: metadata.get('user-id')?.[0],
                requestId: this.generateRequestId()
            };
            
            // Adicionar metadata do gateway
            metadata.set('x-gateway-id', 'load-balancer-gateway');
            metadata.set('x-request-id', clientInfo.requestId);
            metadata.set('x-gateway-timestamp', Date.now().toString());
            
            console.log(`📨 Gateway: Recebida chamada ${methodName} de ${clientInfo.clientIp}`);
            
            let selectedServer;
            let backendClient;
            
            try {
                // Selecionar servidor backend
                selectedServer = this.loadBalancer.selectServer(clientInfo);
                console.log(`🎯 Gateway: Redirecionando ${methodName} para ${selectedServer.id}`);
                
                // Obter cliente para o servidor selecionado
                backendClient = this.getBackendClient(selectedServer, serviceDefinition);
                
                // Adicionar metadata do servidor selecionado
                metadata.set('x-backend-server', selectedServer.id);
                
                // Executar chamada no backend
                const backendCall = backendClient[methodName](call.request, metadata);
                
                // Aguardar resposta
                backendCall.end((error, response) => {
                    const responseTime = Date.now() - startTime;
                    
                    if (error) {
                        // Registrar falha
                        this.gatewayMetrics.failedRequests++;
                        this.loadBalancer.onRequestCompleted(selectedServer.id, false, responseTime);
                        
                        console.log(`❌ Gateway: Falha em ${methodName} via ${selectedServer.id}: ${error.message}`);
                        
                        // Enriquecer erro com informações do gateway
                        const enhancedError = this.errorInterceptor.enhanceError(error, {
                            method: methodName,
                            serverId: selectedServer.id,
                            gatewayId: 'load-balancer-gateway',
                            clientIp: clientInfo.clientIp,
                            requestId: clientInfo.requestId,
                            responseTime
                        });
                        
                        callback(enhancedError);
                    } else {
                        // Registrar sucesso
                        this.gatewayMetrics.successfulRequests++;
                        this.loadBalancer.onRequestCompleted(selectedServer.id, true, responseTime);
                        
                        console.log(`✅ Gateway: Sucesso em ${methodName} via ${selectedServer.id} (${responseTime}ms)`);
                        
                        callback(null, response);
                    }
                });
                
            } catch (error) {
                // Erro no gateway (ex: nenhum servidor disponível)
                const responseTime = Date.now() - startTime;
                this.gatewayMetrics.failedRequests++;
                
                console.log(`❌ Gateway: Erro interno em ${methodName}: ${error.message}`);
                
                const gatewayError = this.errorInterceptor.createError(
                    'INTERNAL',
                    `Gateway error: ${error.message}`,
                    {
                        method: methodName,
                        gatewayId: 'load-balancer-gateway',
                        clientIp: clientInfo.clientIp,
                        requestId: clientInfo.requestId,
                        responseTime,
                        originalError: error.message
                    }
                );
                
                callback(gatewayError);
            }
        };
    }

    /**
     * Configurar serviço com load balancing
     */
    addService(serviceDefinition, serviceImplementation) {
        const proxiedImplementation = {};
        
        // Criar proxies para todos os métodos
        Object.keys(serviceImplementation).forEach(methodName => {
            proxiedImplementation[methodName] = this.createMethodProxy(methodName, serviceDefinition.service);
        });
        
        // Adicionar interceptors de erro
        const interceptedImplementation = this.errorInterceptor.interceptService(proxiedImplementation);
        
        this.server.addService(serviceDefinition, interceptedImplementation);
        console.log(`🔌 Serviço adicionado ao gateway com load balancing`);
    }

    /**
     * Extrair IP do cliente
     */
    extractClientIp(call) {
        const peer = call.getPeer();
        // Extrair IP do formato "ipv4:127.0.0.1:12345" ou "ipv6:[::1]:12345"
        const match = peer.match(/ipv[46]:(.+?):\d+$/);
        return match ? match[1].replace(/[\[\]]/g, '') : 'unknown';
    }

    /**
     * Gerar ID único para requisição
     */
    generateRequestId() {
        return `gw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Adicionar endpoint de status/health check
     */
    addHealthCheckEndpoint() {
        const healthImpl = {
            check: (call, callback) => {
                const status = this.getGatewayStatus();
                callback(null, {
                    status: status.healthy ? 'SERVING' : 'NOT_SERVING',
                    details: JSON.stringify(status)
                });
            }
        };
        
        // Definição simples do serviço de health check
        const healthProto = {
            check: {
                path: '/grpc.health.v1.Health/Check',
                requestStream: false,
                responseStream: false,
                requestType: 'HealthCheckRequest',
                responseType: 'HealthCheckResponse'
            }
        };
        
        this.server.addService(healthProto, healthImpl);
        console.log(`💊 Health check endpoint adicionado ao gateway`);
    }

    /**
     * Obter status do gateway
     */
    getGatewayStatus() {
        const uptime = Date.now() - this.gatewayMetrics.startTime;
        const stats = this.loadBalancer.getStats();
        const globalSuccessRate = this.gatewayMetrics.totalRequests > 0 ? 
            (this.gatewayMetrics.successfulRequests / this.gatewayMetrics.totalRequests) * 100 : 0;
        
        return {
            healthy: stats.availableServers > 0,
            uptime: uptime,
            totalServers: stats.totalServers,
            availableServers: stats.availableServers,
            totalRequests: this.gatewayMetrics.totalRequests,
            successfulRequests: this.gatewayMetrics.successfulRequests,
            failedRequests: this.gatewayMetrics.failedRequests,
            successRate: globalSuccessRate.toFixed(2) + '%',
            loadBalancerStrategy: stats.strategy,
            backendClientsCount: this.backendClients.size
        };
    }

    /**
     * Obter métricas do gateway
     */
    getMetrics() {
        return {
            gateway: this.getGatewayStatus(),
            loadBalancer: this.loadBalancer.getStats(),
            backendClients: Array.from(this.backendClients.entries()).map(([key, info]) => ({
                key,
                serverId: info.serverId,
                address: info.address,
                lastUsed: new Date(info.lastUsed).toISOString()
            }))
        };
    }

    /**
     * Relatório detalhado
     */
    getDetailedReport() {
        const metrics = this.getMetrics();
        
        console.log('\n🚪 ===== RELATÓRIO DO GATEWAY LOAD BALANCER =====');
        console.log(`🌐 Status: ${metrics.gateway.healthy ? 'Saudável' : 'Não Saudável'}`);
        console.log(`⏱️  Uptime: ${(metrics.gateway.uptime / 1000 / 60).toFixed(2)} minutos`);
        console.log(`🖥️  Servidores: ${metrics.gateway.availableServers}/${metrics.gateway.totalServers} disponíveis`);
        console.log(`📈 Total de requisições: ${metrics.gateway.totalRequests}`);
        console.log(`✅ Taxa de sucesso: ${metrics.gateway.successRate}`);
        console.log(`🔄 Estratégia: ${metrics.gateway.loadBalancerStrategy}`);
        console.log(`🔌 Clientes backend ativos: ${metrics.gateway.backendClientsCount}`);
        
        console.log('\n🔗 Clientes backend:');
        metrics.backendClients.forEach(client => {
            console.log(`   ${client.key} -> ${client.address} (último uso: ${client.lastUsed})`);
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
        const keysToRemove = [];
        
        this.backendClients.forEach((clientInfo, key) => {
            if ((now - clientInfo.lastUsed) > maxIdleTime) {
                try {
                    clientInfo.client.close();
                    keysToRemove.push(key);
                } catch (error) {
                    console.log(`⚠️ Erro ao fechar cliente inativo: ${error.message}`);
                }
            }
        });
        
        keysToRemove.forEach(key => this.backendClients.delete(key));
        
        if (keysToRemove.length > 0) {
            console.log(`🧹 ${keysToRemove.length} clientes backend inativos removidos`);
        }
    }

    /**
     * Iniciar servidor gateway
     */
    async start() {
        return new Promise((resolve, reject) => {
            this.server.bindAsync(
                `0.0.0.0:${this.port}`,
                grpc.ServerCredentials.createInsecure(),
                (error, port) => {
                    if (error) {
                        console.error(`❌ Erro ao iniciar gateway: ${error.message}`);
                        reject(error);
                    } else {
                        this.server.start();
                        console.log(`🚀 Gateway Load Balancer rodando na porta ${port}`);
                        
                        // Iniciar limpeza periódica
                        setInterval(() => {
                            this.cleanupIdleClients();
                        }, 5 * 60 * 1000); // A cada 5 minutos
                        
                        resolve(port);
                    }
                }
            );
        });
    }

    /**
     * Parar servidor gateway
     */
    async stop() {
        return new Promise((resolve) => {
            console.log('🛑 Parando Gateway Load Balancer...');
            
            this.server.tryShutdown((error) => {
                if (error) {
                    console.log(`⚠️ Shutdown forçado: ${error.message}`);
                    this.server.forceShutdown();
                }
                
                // Fechar todos os clientes backend
                this.backendClients.forEach((clientInfo, key) => {
                    try {
                        clientInfo.client.close();
                    } catch (error) {
                        console.log(`⚠️ Erro ao fechar cliente ${key}: ${error.message}`);
                    }
                });
                
                this.backendClients.clear();
                this.loadBalancer.destroy();
                
                console.log('✅ Gateway Load Balancer parado');
                resolve();
            });
        });
    }
}

module.exports = {
    GrpcLoadBalancerGateway
};
