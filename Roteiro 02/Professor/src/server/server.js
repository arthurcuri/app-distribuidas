const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const TaskServiceImpl = require('./services/taskService');

/**
 * Servidor gRPC para Sistema de Tarefas
 * 
 * Implementa comunicação RPC moderna com:
 * - Protocol Buffers para serialização
 * - HTTP/2 para transporte
 * - Streaming bidirecional
 * - Performance otimizada
 */

class GRPCServer {
    constructor() {
        this.server = new grpc.Server();
        this.port = process.env.GRPC_PORT || 50051;
        this.loadProtoDefinition();
        this.setupServices();
    }

    loadProtoDefinition() {
        const PROTO_PATH = path.join(__dirname, '../../proto/task.proto');
        
        const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true
        });

        this.protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
        this.taskProto = this.protoDescriptor.task;
    }

    setupServices() {
        const taskService = new TaskServiceImpl();

        this.server.addService(this.taskProto.TaskService.service, {
            createTask: taskService.createTask.bind(taskService),
            getTask: taskService.getTask.bind(taskService),
            listTasks: taskService.listTasks.bind(taskService),
            updateTask: taskService.updateTask.bind(taskService),
            deleteTask: taskService.deleteTask.bind(taskService),
            streamTaskUpdates: taskService.streamTaskUpdates.bind(taskService)
        });
    }

    start() {
        const bindAddress = `0.0.0.0:${this.port}`;
        
        this.server.bindAsync(
            bindAddress,
            grpc.ServerCredentials.createInsecure(),
            (error, port) => {
                if (error) {
                    console.error('❌ Erro ao iniciar servidor gRPC:', error);
                    process.exit(1);
                }

                console.log('🚀 =====================================');
                console.log(`🚀 Servidor gRPC iniciado`);
                console.log(`🚀 Porta: ${port}`);
                console.log(`🚀 Protocolo: HTTP/2 + Protocol Buffers`);
                console.log(`🚀 Serviços disponíveis:`);
                console.log(`🚀   - TaskService (CRUD + Streaming)`);
                console.log('🚀 =====================================');

                this.server.start();
            }
        );
    }

    stop() {
        this.server.tryShutdown((error) => {
            if (error) {
                console.error('Erro ao parar servidor:', error);
            } else {
                console.log('✅ Servidor gRPC parado');
            }
        });
    }
}

// Inicialização
if (require.main === module) {
    const server = new GRPCServer();
    server.start();

    // Graceful shutdown
    process.on('SIGTERM', () => server.stop());
    process.on('SIGINT', () => server.stop());
}

module.exports = GRPCServer;