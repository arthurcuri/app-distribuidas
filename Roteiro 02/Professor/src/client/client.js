const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

class TaskGRPCClient {
    constructor(serverAddress = 'localhost:50051') {
        this.serverAddress = serverAddress;
        this.loadProtoDefinition();
        this.createClient();
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

    createClient() {
        this.client = new this.taskProto.TaskService(
            this.serverAddress,
            grpc.credentials.createInsecure()
        );
    }

    // Criar tarefa
    async createTask(title, description = '', priority = 'medium', userId = 'user1') {
        return new Promise((resolve, reject) => {
            this.client.createTask({
                title,
                description,
                priority,
                user_id: userId
            }, (error, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
        });
    }

    // Buscar tarefa
    async getTask(id) {
        return new Promise((resolve, reject) => {
            this.client.getTask({ id }, (error, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
        });
    }

    // Listar tarefas
    async listTasks(userId = 'user1', completed = null, priority = null) {
        return new Promise((resolve, reject) => {
            const request = { user_id: userId };
            if (completed !== null) request.completed = completed;
            if (priority) request.priority = priority;

            this.client.listTasks(request, (error, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
        });
    }

    // Atualizar tarefa
    async updateTask(id, updates) {
        return new Promise((resolve, reject) => {
            const request = { id, ...updates };
            
            this.client.updateTask(request, (error, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
        });
    }

    // Deletar tarefa
    async deleteTask(id) {
        return new Promise((resolve, reject) => {
            this.client.deleteTask({ id }, (error, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
        });
    }

    // Stream de atualizações em tempo real
    streamTaskUpdates(userId = 'user1', onUpdate) {
        const stream = this.client.streamTaskUpdates({ user_id: userId });

        stream.on('data', (response) => {
            onUpdate(response);
        });

        stream.on('error', (error) => {
			stream.on('error', (error) => {
				// Ignorar erro de cancelamento (comportamento normal)
				if (error.code !== 1 || error.details !== 'Cancelled on client') {
					console.error('Erro no stream:', error);
				}
			});
        });

        stream.on('end', () => {
            console.log('Stream finalizado');
        });

        return stream;
    }

    // Fechar conexão
    close() {
        this.client.close();
    }
}

// Exemplo de uso interativo
async function demonstrateGRPC() {
    const client = new TaskGRPCClient();
    const userId = 'demo-user';

    console.log('🔄 Demonstração Cliente gRPC\n');

    try {
        // 1. Criar algumas tarefas
        console.log('📝 Criando tarefas...');
        const task1 = await client.createTask(
            'Estudar gRPC',
            'Aprender Protocol Buffers e streaming',
            'high',
            userId
        );
        console.log(`✅ Tarefa criada: ${task1.task.title}`);

        const task2 = await client.createTask(
            'Implementar servidor',
            'Codificar servidor gRPC em Node.js',
            'medium',
            userId
        );
        console.log(`✅ Tarefa criada: ${task2.task.title}`);

        // 2. Listar tarefas
        console.log('\n📋 Listando tarefas...');
        const taskList = await client.listTasks(userId);
        console.log(`📊 Total de tarefas: ${taskList.total}`);
        taskList.tasks.forEach(task => {
            console.log(`  - ${task.title} [${task.priority}]`);
        });

        // 3. Atualizar tarefa
        console.log('\n🔄 Atualizando tarefa...');
        const updated = await client.updateTask(task1.task.id, {
            completed: true,
            title: 'Estudar gRPC - Concluído!'
        });
        console.log(`✅ Tarefa atualizada: ${updated.task.title}`);

        // 4. Demonstrar streaming
        console.log('\n🌊 Iniciando stream de atualizações...');
        const stream = client.streamTaskUpdates(userId, (update) => {
            console.log(`📨 Atualização recebida: ${update.message}`);
            if (update.task) {
                console.log(`   Tarefa: ${update.task.title}`);
            }
        });

        // Simular algumas atualizações
        setTimeout(async () => {
            await client.createTask('Nova tarefa via stream', 'Teste de streaming', 'low', userId);
        }, 2000);

        setTimeout(async () => {
            await client.updateTask(task2.task.id, { completed: true });
        }, 4000);

        setTimeout(() => {
            stream.cancel();
            client.close();
            console.log('\n✅ Demonstração concluída');
        }, 6000);

    } catch (error) {
        console.error('❌ Erro:', error);
        client.close();
    }
}

// Executar demonstração se script for chamado diretamente
if (require.main === module) {
    demonstrateGRPC();
}

module.exports = TaskGRPCClient;