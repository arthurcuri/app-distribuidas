const grpc = require('@grpc/grpc-js');
const { loadPackageDefinition } = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Importar módulos necessários
const { AuthService } = require('../services/AuthService');
const { TaskService } = require('../services/TaskService');
const { GrpcLoadBalancerGateway } = require('./loadBalancerGateway');
const { LoadBalancingStrategies } = require('./loadBalancer');

/**
 * Configuração de múltiplos servidores backend para Load Balancing
 * 
 * Este arquivo cria múltiplas instâncias do servidor gRPC
 * para demonstrar o load balancing em ação
 */

class BackendServerInstance {
    constructor(port, serverId, options = {}) {
        this.port = port;
        this.serverId = serverId;
        this.server = new grpc.Server();
        this.started = false;
        
        // Configurações do servidor
        this.config = {
            simulateLatency: options.simulateLatency || false,
            minLatency: options.minLatency || 100,
            maxLatency: options.maxLatency || 500,
            errorRate: options.errorRate || 0, // 0-1 (0% a 100%)
            weight: options.weight || 1,
            ...options
        };
        
        console.log(`🏗️  Criando servidor backend ${serverId} na porta ${port}`);
        this.setupServices();
    }

    /**
     * Configurar serviços gRPC
     */
    setupServices() {
        // Carregar definições proto
        const authProtoPath = path.join(__dirname, '..', 'protos', 'auth_service.proto');
        const taskProtoPath = path.join(__dirname, '..', 'protos', 'task_service.proto');
        
        const authPackageDefinition = protoLoader.loadSync(authProtoPath, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
        });
        
        const taskPackageDefinition = protoLoader.loadSync(taskProtoPath, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
        });
        
        const authProto = loadPackageDefinition(authPackageDefinition);
        const taskProto = loadPackageDefinition(taskPackageDefinition);
        
        // Criar instâncias dos serviços com identificação do servidor
        const authService = new AuthService();
        const taskService = new TaskService();
        
        // Wrapper para adicionar informações do servidor nas respostas
        const wrapServiceMethods = (serviceInstance, serviceName) => {
            const wrappedService = {};
            
            // Para AuthService, precisamos mapear métodos específicos
            if (serviceName === 'AuthService') {
                wrappedService.authenticate = async (call, callback) => {
                    const startTime = Date.now();
                    
                    try {
                        // Simular latência se configurado
                        if (this.config.simulateLatency) {
                            const latency = Math.random() * (this.config.maxLatency - this.config.minLatency) + this.config.minLatency;
                            await new Promise(resolve => setTimeout(resolve, latency));
                        }
                        
                        // Simular erro se configurado
                        if (this.config.errorRate > 0 && Math.random() < this.config.errorRate) {
                            const error = new Error(`Simulated error from ${this.serverId}`);
                            error.code = grpc.status.INTERNAL;
                            throw error;
                        }
                        
                        console.log(`🔧 ${this.serverId}: Processando authenticate (${serviceName})`);
                        
                        // Executar método original
                        await serviceInstance.authenticate(call, (error, response) => {
                            if (error) {
                                console.log(`❌ ${this.serverId}: Erro em authenticate: ${error.message}`);
                                callback(error);
                            } else {
                                // Adicionar informações do servidor na resposta
                                if (response && typeof response === 'object') {
                                    response.serverId = this.serverId;
                                    response.serverPort = this.port;
                                }
                                
                                const processingTime = Date.now() - startTime;
                                console.log(`✅ ${this.serverId}: authenticate concluído em ${processingTime}ms`);
                                
                                callback(null, response);
                            }
                        });
                        
                    } catch (error) {
                        const processingTime = Date.now() - startTime;
                        console.log(`❌ ${this.serverId}: Erro em authenticate após ${processingTime}ms: ${error.message}`);
                        callback(error);
                    }
                };
                
                wrappedService.validateToken = async (call, callback) => {
                    try {
                        console.log(`🔧 ${this.serverId}: Processando validateToken`);
                        await serviceInstance.validateToken(call, callback);
                    } catch (error) {
                        console.log(`❌ ${this.serverId}: Erro em validateToken: ${error.message}`);
                        callback(error);
                    }
                };
            }
            
            // Para TaskService
            if (serviceName === 'TaskService') {
                const methods = ['createTask', 'getTasks', 'updateTask', 'deleteTask'];
                
                methods.forEach(methodName => {
                    wrappedService[methodName] = async (call, callback) => {
                        const startTime = Date.now();
                        
                        try {
                            // Simular latência se configurado
                            if (this.config.simulateLatency) {
                                const latency = Math.random() * (this.config.maxLatency - this.config.minLatency) + this.config.minLatency;
                                await new Promise(resolve => setTimeout(resolve, latency));
                            }
                            
                            // Simular erro se configurado
                            if (this.config.errorRate > 0 && Math.random() < this.config.errorRate) {
                                const error = new Error(`Simulated error from ${this.serverId}`);
                                error.code = grpc.status.INTERNAL;
                                throw error;
                            }
                            
                            console.log(`🔧 ${this.serverId}: Processando ${methodName} (${serviceName})`);
                            
                            // Executar método original
                            await serviceInstance[methodName](call, (error, response) => {
                                if (error) {
                                    console.log(`❌ ${this.serverId}: Erro em ${methodName}: ${error.message}`);
                                    callback(error);
                                } else {
                                    // Adicionar informações do servidor na resposta
                                    if (response && typeof response === 'object') {
                                        response.serverId = this.serverId;
                                        response.serverPort = this.port;
                                    }
                                    
                                    const processingTime = Date.now() - startTime;
                                    console.log(`✅ ${this.serverId}: ${methodName} concluído em ${processingTime}ms`);
                                    
                                    callback(null, response);
                                }
                            });
                            
                        } catch (error) {
                            const processingTime = Date.now() - startTime;
                            console.log(`❌ ${this.serverId}: Erro em ${methodName} após ${processingTime}ms: ${error.message}`);
                            callback(error);
                        }
                    };
                });
            }
            
            return wrappedService;
        };
        
        // Adicionar serviços com wrappers
        const wrappedAuthService = wrapServiceMethods(authService, 'AuthService');
        const wrappedTaskService = wrapServiceMethods(taskService, 'TaskService');
        
        this.server.addService(authProto.AuthService.service, wrappedAuthService);
        this.server.addService(taskProto.TaskService.service, wrappedTaskService);
        
        console.log(`🔌 Serviços configurados para ${this.serverId}`);
    }

    /**
     * Iniciar servidor backend
     */
    async start() {
        if (this.started) {
            throw new Error(`Servidor ${this.serverId} já está rodando`);
        }
        
        return new Promise((resolve, reject) => {
            this.server.bindAsync(
                `0.0.0.0:${this.port}`,
                grpc.ServerCredentials.createInsecure(),
                (error, port) => {
                    if (error) {
                        console.error(`❌ Erro ao iniciar ${this.serverId}: ${error.message}`);
                        reject(error);
                    } else {
                        this.server.start();
                        this.started = true;
                        console.log(`🚀 ${this.serverId} rodando na porta ${port}`);
                        resolve(port);
                    }
                }
            );
        });
    }

    /**
     * Parar servidor backend
     */
    async stop() {
        if (!this.started) {
            return;
        }
        
        return new Promise((resolve) => {
            console.log(`🛑 Parando ${this.serverId}...`);
            
            this.server.tryShutdown((error) => {
                if (error) {
                    console.log(`⚠️ Shutdown forçado para ${this.serverId}: ${error.message}`);
                    this.server.forceShutdown();
                }
                
                this.started = false;
                console.log(`✅ ${this.serverId} parado`);
                resolve();
            });
        });
    }

    /**
     * Obter informações do servidor
     */
    getInfo() {
        return {
            serverId: this.serverId,
            port: this.port,
            started: this.started,
            config: this.config
        };
    }
}

/**
 * Gerenciador de múltiplos servidores backend
 */
class BackendCluster {
    constructor() {
        this.servers = new Map();
        this.gateway = null;
        
        console.log('🏭 Cluster de servidores backend criado');
    }

    /**
     * Adicionar servidor backend ao cluster
     */
    addServer(port, serverId, options = {}) {
        if (this.servers.has(serverId)) {
            throw new Error(`Servidor ${serverId} já existe no cluster`);
        }
        
        const server = new BackendServerInstance(port, serverId, options);
        this.servers.set(serverId, server);
        
        console.log(`➕ Servidor ${serverId} adicionado ao cluster`);
        return server;
    }

    /**
     * Remover servidor do cluster
     */
    async removeServer(serverId) {
        const server = this.servers.get(serverId);
        if (server) {
            await server.stop();
            this.servers.delete(serverId);
            
            // Remover do gateway se existir
            if (this.gateway) {
                this.gateway.removeBackendServer(serverId);
            }
            
            console.log(`➖ Servidor ${serverId} removido do cluster`);
        }
    }

    /**
     * Iniciar todos os servidores do cluster
     */
    async startAll() {
        console.log('🚀 Iniciando cluster de servidores...');
        
        const startPromises = Array.from(this.servers.values()).map(server => 
            server.start().catch(error => {
                console.error(`❌ Falha ao iniciar ${server.serverId}: ${error.message}`);
                return null;
            })
        );
        
        const results = await Promise.allSettled(startPromises);
        const successCount = results.filter(result => result.status === 'fulfilled' && result.value !== null).length;
        
        console.log(`🎯 ${successCount}/${this.servers.size} servidores iniciados com sucesso`);
        return successCount;
    }

    /**
     * Parar todos os servidores do cluster
     */
    async stopAll() {
        console.log('🛑 Parando cluster de servidores...');
        
        const stopPromises = Array.from(this.servers.values()).map(server => server.stop());
        await Promise.allSettled(stopPromises);
        
        console.log('✅ Todos os servidores do cluster foram parados');
    }

    /**
     * Configurar gateway com load balancer
     */
    setupGateway(gatewayPort = 50050, strategy = LoadBalancingStrategies.ROUND_ROBIN) {
        this.gateway = new GrpcLoadBalancerGateway({
            port: gatewayPort,
            strategy: strategy,
            healthCheckInterval: 10000, // 10s para demo
            healthCheckTimeout: 3000,   // 3s para demo
            enableHealthChecks: true
        });
        
        // Adicionar todos os servidores do cluster ao load balancer
        this.servers.forEach((server, serverId) => {
            if (server.started) {
                this.gateway.addBackendServer('localhost', server.port, {
                    weight: server.config.weight,
                    metadata: { serverId }
                });
            }
        });
        
        console.log(`🚪 Gateway configurado na porta ${gatewayPort} com estratégia ${strategy}`);
        return this.gateway;
    }

    /**
     * Iniciar gateway
     */
    async startGateway() {
        if (!this.gateway) {
            throw new Error('Gateway não configurado. Use setupGateway() primeiro.');
        }
        
        // Carregar e adicionar serviços ao gateway
        const authProtoPath = path.join(__dirname, '..', 'protos', 'auth_service.proto');
        const taskProtoPath = path.join(__dirname, '..', 'protos', 'task_service.proto');
        
        const authPackageDefinition = protoLoader.loadSync(authProtoPath, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
        });
        
        const taskPackageDefinition = protoLoader.loadSync(taskProtoPath, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
        });
        
        const authProto = loadPackageDefinition(authPackageDefinition);
        const taskProto = loadPackageDefinition(taskPackageDefinition);
        
        // Adicionar serviços ao gateway (os métodos serão proxied para os backends)
        this.gateway.addService(authProto.AuthService, {});
        this.gateway.addService(taskProto.TaskService, {});
        
        return await this.gateway.start();
    }

    /**
     * Parar gateway
     */
    async stopGateway() {
        if (this.gateway) {
            await this.gateway.stop();
            this.gateway = null;
        }
    }

    /**
     * Obter status do cluster
     */
    getClusterStatus() {
        const servers = Array.from(this.servers.values()).map(server => server.getInfo());
        const runningServers = servers.filter(s => s.started);
        
        return {
            totalServers: this.servers.size,
            runningServers: runningServers.length,
            gatewayRunning: this.gateway ? true : false,
            servers: servers
        };
    }

    /**
     * Relatório detalhado do cluster
     */
    getDetailedReport() {
        const status = this.getClusterStatus();
        
        console.log('\n🏭 ===== RELATÓRIO DO CLUSTER BACKEND =====');
        console.log(`🖥️  Total de servidores: ${status.totalServers}`);
        console.log(`🚀 Servidores rodando: ${status.runningServers}`);
        console.log(`🚪 Gateway: ${status.gatewayRunning ? 'Rodando' : 'Parado'}`);
        
        console.log('\n📋 Servidores:');
        status.servers.forEach(server => {
            const statusIcon = server.started ? '✅' : '❌';
            console.log(`   ${statusIcon} ${server.serverId} - porta ${server.port} - peso ${server.config.weight}`);
            if (server.config.simulateLatency) {
                console.log(`      📶 Latência: ${server.config.minLatency}-${server.config.maxLatency}ms`);
            }
            if (server.config.errorRate > 0) {
                console.log(`      ⚠️ Taxa de erro: ${(server.config.errorRate * 100).toFixed(1)}%`);
            }
        });
        
        if (this.gateway) {
            this.gateway.getDetailedReport();
        }
        
        console.log('==========================================\n');
        
        return status;
    }

    /**
     * Simular falha de servidor
     */
    async simulateServerFailure(serverId, duration = 30000) {
        const server = this.servers.get(serverId);
        if (!server || !server.started) {
            throw new Error(`Servidor ${serverId} não está rodando`);
        }
        
        console.log(`💥 Simulando falha do servidor ${serverId} por ${duration}ms`);
        
        await server.stop();
        
        // Remover do gateway temporariamente
        if (this.gateway) {
            this.gateway.removeBackendServer(serverId);
        }
        
        // Restaurar servidor após duração especificada
        setTimeout(async () => {
            try {
                await server.start();
                
                // Adicionar de volta ao gateway
                if (this.gateway) {
                    this.gateway.addBackendServer('localhost', server.port, {
                        weight: server.config.weight,
                        metadata: { serverId }
                    });
                }
                
                console.log(`🔄 Servidor ${serverId} restaurado após simulação de falha`);
            } catch (error) {
                console.error(`❌ Erro ao restaurar servidor ${serverId}: ${error.message}`);
            }
        }, duration);
    }

    /**
     * Destruir cluster
     */
    async destroy() {
        console.log('🧹 Destruindo cluster...');
        
        await this.stopGateway();
        await this.stopAll();
        this.servers.clear();
        
        console.log('✅ Cluster destruído');
    }
}

module.exports = {
    BackendServerInstance,
    BackendCluster
};
