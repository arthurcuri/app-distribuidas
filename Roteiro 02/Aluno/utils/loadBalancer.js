const grpc = require('@grpc/grpc-js');
const { EventEmitter } = require('events');

/**
 * Load Balancer para gRPC
 * 
 * Implementa diferentes estratégias de balanceamento:
 * - Round Robin: Distribui requisições uniformemente
 * - Weighted Round Robin: Considera peso dos servidores
 * - Least Connections: Prioriza servidores com menos conexões
 * - Health-based: Considera saúde dos servidores
 * - IP Hash: Consistente baseado no IP do cliente
 */

/**
 * Estratégias de balanceamento
 */
const LoadBalancingStrategies = {
    ROUND_ROBIN: 'round_robin',
    WEIGHTED_ROUND_ROBIN: 'weighted_round_robin',
    LEAST_CONNECTIONS: 'least_connections',
    HEALTH_BASED: 'health_based',
    IP_HASH: 'ip_hash'
};

/**
 * Estado de saúde do servidor
 */
const ServerHealth = {
    HEALTHY: 'healthy',
    UNHEALTHY: 'unhealthy',
    UNKNOWN: 'unknown'
};

/**
 * Classe para representar um servidor backend
 */
class BackendServer {
    constructor(host, port, options = {}) {
        this.id = `${host}:${port}`;
        this.host = host;
        this.port = port;
        this.weight = options.weight || 1;
        this.maxConnections = options.maxConnections || 100;
        this.currentConnections = 0;
        this.totalRequests = 0;
        this.successfulRequests = 0;
        this.failedRequests = 0;
        this.health = ServerHealth.UNKNOWN;
        this.lastHealthCheck = null;
        this.responseTime = 0;
        this.enabled = true;
        this.metadata = options.metadata || {};
        
        // Estatísticas de tempo
        this.responseTimes = [];
        this.maxResponseTimeHistory = 100;
    }

    /**
     * Registrar nova conexão
     */
    addConnection() {
        this.currentConnections++;
    }

    /**
     * Remover conexão
     */
    removeConnection() {
        if (this.currentConnections > 0) {
            this.currentConnections--;
        }
    }

    /**
     * Registrar requisição
     */
    recordRequest(success, responseTime = 0) {
        this.totalRequests++;
        
        if (success) {
            this.successfulRequests++;
        } else {
            this.failedRequests++;
        }

        // Registrar tempo de resposta
        if (responseTime > 0) {
            this.responseTimes.push(responseTime);
            if (this.responseTimes.length > this.maxResponseTimeHistory) {
                this.responseTimes.shift();
            }
            this.responseTime = this.getAverageResponseTime();
        }
    }

    /**
     * Calcular tempo de resposta médio
     */
    getAverageResponseTime() {
        if (this.responseTimes.length === 0) return 0;
        const sum = this.responseTimes.reduce((a, b) => a + b, 0);
        return sum / this.responseTimes.length;
    }

    /**
     * Calcular taxa de sucesso
     */
    getSuccessRate() {
        if (this.totalRequests === 0) return 1;
        return this.successfulRequests / this.totalRequests;
    }

    /**
     * Verificar se servidor está disponível
     */
    isAvailable() {
        return this.enabled && 
               this.health !== ServerHealth.UNHEALTHY && 
               this.currentConnections < this.maxConnections;
    }

    /**
     * Calcular score de saúde (0-1, maior é melhor)
     */
    getHealthScore() {
        if (!this.isAvailable()) return 0;
        
        const successRate = this.getSuccessRate();
        const connectionLoad = this.currentConnections / this.maxConnections;
        const responseTimeFactor = this.responseTime > 0 ? Math.max(0, 1 - (this.responseTime / 5000)) : 1;
        
        return (successRate * 0.5) + ((1 - connectionLoad) * 0.3) + (responseTimeFactor * 0.2);
    }

    /**
     * Obter informações do servidor
     */
    getInfo() {
        return {
            id: this.id,
            host: this.host,
            port: this.port,
            weight: this.weight,
            health: this.health,
            enabled: this.enabled,
            connections: this.currentConnections,
            maxConnections: this.maxConnections,
            totalRequests: this.totalRequests,
            successfulRequests: this.successfulRequests,
            failedRequests: this.failedRequests,
            successRate: (this.getSuccessRate() * 100).toFixed(2) + '%',
            responseTime: this.responseTime.toFixed(2) + 'ms',
            healthScore: this.getHealthScore().toFixed(3),
            metadata: this.metadata
        };
    }
}

/**
 * Load Balancer Principal
 */
class GrpcLoadBalancer extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.servers = new Map();
        this.strategy = options.strategy || LoadBalancingStrategies.ROUND_ROBIN;
        this.healthCheckInterval = options.healthCheckInterval || 30000; // 30s
        this.healthCheckTimeout = options.healthCheckTimeout || 5000; // 5s
        this.enableHealthChecks = options.enableHealthChecks !== false;
        this.stickySession = options.stickySession || false;
        this.sessionStore = new Map(); // Para sticky sessions
        
        // Estado interno para algoritmos
        this.roundRobinIndex = 0;
        this.weightedRoundRobinState = [];
        
        // Estatísticas globais
        this.totalRequests = 0;
        this.distributionStats = new Map();
        
        console.log(`🔄 Load Balancer inicializado - Estratégia: ${this.strategy}`);
        
        // Iniciar health checks
        if (this.enableHealthChecks) {
            this.startHealthChecks();
        }
    }

    /**
     * Adicionar servidor backend
     */
    addServer(host, port, options = {}) {
        const server = new BackendServer(host, port, options);
        this.servers.set(server.id, server);
        this.distributionStats.set(server.id, 0);
        
        console.log(`➕ Servidor adicionado: ${server.id} (peso: ${server.weight})`);
        this.emit('serverAdded', server);
        
        // Reconfigurar algoritmos que dependem de estado
        this.reconfigureAlgorithms();
        
        return server.id;
    }

    /**
     * Remover servidor
     */
    removeServer(serverId) {
        const server = this.servers.get(serverId);
        if (server) {
            this.servers.delete(serverId);
            this.distributionStats.delete(serverId);
            console.log(`➖ Servidor removido: ${serverId}`);
            this.emit('serverRemoved', server);
            this.reconfigureAlgorithms();
        }
    }

    /**
     * Habilitar/desabilitar servidor
     */
    setServerEnabled(serverId, enabled) {
        const server = this.servers.get(serverId);
        if (server) {
            server.enabled = enabled;
            console.log(`🔧 Servidor ${serverId} ${enabled ? 'habilitado' : 'desabilitado'}`);
            this.emit('serverStatusChanged', server);
        }
    }

    /**
     * Selecionar servidor baseado na estratégia
     */
    selectServer(clientInfo = {}) {
        const availableServers = Array.from(this.servers.values()).filter(s => s.isAvailable());
        
        if (availableServers.length === 0) {
            throw new Error('Nenhum servidor disponível');
        }

        let selectedServer;

        // Verificar sticky session primeiro
        if (this.stickySession && clientInfo.sessionId) {
            const stickyServerId = this.sessionStore.get(clientInfo.sessionId);
            const stickyServer = this.servers.get(stickyServerId);
            if (stickyServer && stickyServer.isAvailable()) {
                selectedServer = stickyServer;
            }
        }

        // Se não há sticky session ou servidor não disponível, usar estratégia
        if (!selectedServer) {
            switch (this.strategy) {
                case LoadBalancingStrategies.ROUND_ROBIN:
                    selectedServer = this.selectRoundRobin(availableServers);
                    break;
                case LoadBalancingStrategies.WEIGHTED_ROUND_ROBIN:
                    selectedServer = this.selectWeightedRoundRobin(availableServers);
                    break;
                case LoadBalancingStrategies.LEAST_CONNECTIONS:
                    selectedServer = this.selectLeastConnections(availableServers);
                    break;
                case LoadBalancingStrategies.HEALTH_BASED:
                    selectedServer = this.selectHealthBased(availableServers);
                    break;
                case LoadBalancingStrategies.IP_HASH:
                    selectedServer = this.selectIpHash(availableServers, clientInfo.clientIp);
                    break;
                default:
                    selectedServer = this.selectRoundRobin(availableServers);
            }

            // Salvar sticky session
            if (this.stickySession && clientInfo.sessionId) {
                this.sessionStore.set(clientInfo.sessionId, selectedServer.id);
            }
        }

        // Registrar seleção
        this.totalRequests++;
        this.distributionStats.set(selectedServer.id, this.distributionStats.get(selectedServer.id) + 1);
        selectedServer.addConnection();

        this.emit('serverSelected', selectedServer, this.strategy);
        return selectedServer;
    }

    /**
     * Round Robin
     */
    selectRoundRobin(servers) {
        const server = servers[this.roundRobinIndex % servers.length];
        this.roundRobinIndex++;
        return server;
    }

    /**
     * Weighted Round Robin
     */
    selectWeightedRoundRobin(servers) {
        if (this.weightedRoundRobinState.length === 0) {
            this.buildWeightedRoundRobinState(servers);
        }

        if (this.weightedRoundRobinState.length === 0) {
            return this.selectRoundRobin(servers);
        }

        const serverId = this.weightedRoundRobinState[this.roundRobinIndex % this.weightedRoundRobinState.length];
        this.roundRobinIndex++;
        return this.servers.get(serverId);
    }

    /**
     * Construir estado para Weighted Round Robin
     */
    buildWeightedRoundRobinState(servers) {
        this.weightedRoundRobinState = [];
        servers.forEach(server => {
            for (let i = 0; i < server.weight; i++) {
                this.weightedRoundRobinState.push(server.id);
            }
        });
        // Embaralhar para melhor distribuição
        this.shuffleArray(this.weightedRoundRobinState);
    }

    /**
     * Least Connections
     */
    selectLeastConnections(servers) {
        return servers.reduce((least, current) => 
            current.currentConnections < least.currentConnections ? current : least
        );
    }

    /**
     * Health-based (melhor score de saúde)
     */
    selectHealthBased(servers) {
        return servers.reduce((best, current) => 
            current.getHealthScore() > best.getHealthScore() ? current : best
        );
    }

    /**
     * IP Hash (consistente)
     */
    selectIpHash(servers, clientIp) {
        if (!clientIp) {
            return this.selectRoundRobin(servers);
        }

        const hash = this.hashString(clientIp);
        const index = hash % servers.length;
        return servers[index];
    }

    /**
     * Reconfigurar algoritmos quando servidores mudam
     */
    reconfigureAlgorithms() {
        this.weightedRoundRobinState = [];
        this.roundRobinIndex = 0;
    }

    /**
     * Notificar que requisição foi processada
     */
    onRequestCompleted(serverId, success, responseTime) {
        const server = this.servers.get(serverId);
        if (server) {
            server.removeConnection();
            server.recordRequest(success, responseTime);
            this.emit('requestCompleted', server, success, responseTime);
        }
    }

    /**
     * Health checks periódicos
     */
    startHealthChecks() {
        setInterval(() => {
            this.performHealthChecks();
        }, this.healthCheckInterval);
        
        console.log(`💊 Health checks habilitados (intervalo: ${this.healthCheckInterval}ms)`);
    }

    /**
     * Executar health check em todos os servidores
     */
    async performHealthChecks() {
        const promises = Array.from(this.servers.values()).map(server => 
            this.checkServerHealth(server)
        );
        
        await Promise.allSettled(promises);
        this.emit('healthCheckCompleted');
    }

    /**
     * Verificar saúde de um servidor específico
     */
    async checkServerHealth(server) {
        const startTime = Date.now();
        
        try {
            // Tentar conectar ao servidor
            const client = new grpc.Client(`${server.host}:${server.port}`, grpc.credentials.createInsecure());
            
            // Timeout para health check
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Health check timeout')), this.healthCheckTimeout)
            );
            
            const checkPromise = new Promise((resolve, reject) => {
                // Simular health check - em produção, usar endpoint específico
                const deadline = Date.now() + this.healthCheckTimeout;
                client.waitForReady(deadline, (error) => {
                    client.close();
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });

            await Promise.race([checkPromise, timeoutPromise]);
            
            const responseTime = Date.now() - startTime;
            server.health = ServerHealth.HEALTHY;
            server.lastHealthCheck = new Date();
            server.recordRequest(true, responseTime);
            
            this.emit('serverHealthy', server);
            
        } catch (error) {
            server.health = ServerHealth.UNHEALTHY;
            server.lastHealthCheck = new Date();
            server.recordRequest(false);
            
            console.log(`❌ Health check falhou para ${server.id}: ${error.message}`);
            this.emit('serverUnhealthy', server, error);
        }
    }

    /**
     * Obter estatísticas do load balancer
     */
    getStats() {
        const serverStats = Array.from(this.servers.values()).map(s => s.getInfo());
        const distribution = {};
        
        this.distributionStats.forEach((count, serverId) => {
            const percentage = this.totalRequests > 0 ? ((count / this.totalRequests) * 100).toFixed(2) : '0.00';
            distribution[serverId] = {
                requests: count,
                percentage: percentage + '%'
            };
        });

        return {
            strategy: this.strategy,
            totalServers: this.servers.size,
            availableServers: Array.from(this.servers.values()).filter(s => s.isAvailable()).length,
            totalRequests: this.totalRequests,
            stickySession: this.stickySession,
            healthChecksEnabled: this.enableHealthChecks,
            distribution,
            servers: serverStats
        };
    }

    /**
     * Relatório detalhado
     */
    getDetailedReport() {
        const stats = this.getStats();
        
        console.log('\n📊 ===== RELATÓRIO DO LOAD BALANCER =====');
        console.log(`🔄 Estratégia: ${stats.strategy}`);
        console.log(`🖥️  Servidores: ${stats.availableServers}/${stats.totalServers} disponíveis`);
        console.log(`📈 Total de requisições: ${stats.totalRequests}`);
        console.log(`🔗 Sticky sessions: ${stats.stickySession ? 'Habilitado' : 'Desabilitado'}`);
        console.log(`💊 Health checks: ${stats.healthChecksEnabled ? 'Habilitado' : 'Desabilitado'}`);
        
        console.log('\n📊 Distribuição de requisições:');
        Object.entries(stats.distribution).forEach(([serverId, data]) => {
            console.log(`   ${serverId}: ${data.requests} req (${data.percentage})`);
        });
        
        console.log('\n🖥️  Status dos servidores:');
        stats.servers.forEach(server => {
            const statusIcon = server.health === 'healthy' ? '✅' : 
                             server.health === 'unhealthy' ? '❌' : '⚠️';
            console.log(`   ${statusIcon} ${server.id} - ${server.health} - ${server.connections}/${server.maxConnections} conn - ${server.successRate} sucesso - ${server.responseTime} resp`);
        });
        
        console.log('=========================================\n');
        
        return stats;
    }

    /**
     * Utilitários
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    /**
     * Resetar estatísticas
     */
    resetStats() {
        this.totalRequests = 0;
        this.distributionStats.clear();
        this.servers.forEach(server => {
            this.distributionStats.set(server.id, 0);
            server.totalRequests = 0;
            server.successfulRequests = 0;
            server.failedRequests = 0;
            server.responseTimes = [];
        });
        console.log('📊 Estatísticas resetadas');
    }

    /**
     * Cleanup
     */
    destroy() {
        this.removeAllListeners();
        this.sessionStore.clear();
        console.log('🧹 Load Balancer destruído');
    }
}

module.exports = {
    GrpcLoadBalancer,
    BackendServer,
    LoadBalancingStrategies,
    ServerHealth
};
