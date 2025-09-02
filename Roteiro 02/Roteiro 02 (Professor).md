# Roteiro 2: Comunicação gRPC

**Laboratório de Desenvolvimento de Aplicações Móveis e Distribuídas**  
**Curso de Engenharia de Software - PUC Minas**

---

## Objetivos

- Implementar comunicação gRPC entre cliente e servidor
- Compreender Protocol Buffers (protobuf) para serialização de dados
- Desenvolver APIs tipadas e eficientes usando gRPC
- Comparar performance entre gRPC e REST tradicional
- Implementar diferentes tipos de comunicação (unary, streaming)

## Fundamentação Teórica

O gRPC (Google Remote Procedure Call) é um framework de RPC moderno e de alto desempenho que pode executar em qualquer ambiente. Segundo a documentação oficial do gRPC, "usa HTTP/2 para transporte, Protocol Buffers como linguagem de descrição de interface e fornece recursos como autenticação, balanceamento de carga e muito mais" <sup>[1]</sup>.

### Características do gRPC

**Vantagens:**
- Performance superior ao REST (HTTP/2, compressão binária)
- Tipagem forte com Protocol Buffers
- Suporte nativo a streaming bidirecional
- Geração automática de código cliente/servidor
- Multiplexação de requisições

**Protocol Buffers:**
- Serialização binária eficiente
- Evolução de schema compatível
- Suporte multiplataforma
- Definição de contratos clara

## Cenário do Laboratório

Sistema de gerenciamento de tarefas usando gRPC, implementando:
1. Definição de serviços em Protocol Buffers
2. Servidor gRPC para operações CRUD
3. Cliente gRPC para consumo dos serviços
4. Comparação de performance com REST

## Pré-requisitos

- Node.js 16+ e NPM
- Conhecimento básico de JavaScript/TypeScript
- Entendimento de conceitos de API

---

## **PASSO 1: Configuração Inicial**

### 1.1 Criar Estrutura do Projeto

```bash
mkdir lab02-grpc-communication
cd lab02-grpc-communication
npm init -y
```

### 1.2 Instalar Dependências

```bash
# Dependências gRPC
npm install @grpc/grpc-js @grpc/proto-loader uuid

# Ferramentas de desenvolvimento
npm install --save-dev nodemon
```

### 1.3 Estrutura de Diretórios

```
lab02-grpc-communication/
├── package.json
├── proto/
│   └── task.proto              # Definições Protocol Buffers
├── src/
│   ├── server/
│   │   ├── server.js           # Servidor gRPC
│   │   └── services/
│   │       └── taskService.js  # Implementação do serviço
│   ├── client/
│   │   └── client.js           # Cliente gRPC
│   └── data/
│       └── storage.js          # Armazenamento em memória
└── scripts/
    └── generate-proto.sh       # Script para gerar código
```

---

## **PASSO 2: Definição do Protocol Buffer**

### 2.1 Definir Schema (`proto/task.proto`)

```protobuf
syntax = "proto3";

package task;

// Definição da mensagem Task
message Task {
  string id = 1;
  string title = 2;
  string description = 3;
  bool completed = 4;
  string priority = 5;
  string user_id = 6;
  int64 created_at = 7;
}

// Mensagens de requisição
message CreateTaskRequest {
  string title = 1;
  string description = 2;
  string priority = 3;
  string user_id = 4;
}

message GetTaskRequest {
  string id = 1;
}

message UpdateTaskRequest {
  string id = 1;
  string title = 2;
  string description = 3;
  bool completed = 4;
  string priority = 5;
}

message DeleteTaskRequest {
  string id = 1;
}

message ListTasksRequest {
  string user_id = 1;
  bool completed = 2;
  string priority = 3;
}

// Mensagens de resposta
message TaskResponse {
  bool success = 1;
  string message = 2;
  Task task = 3;
}

message TaskListResponse {
  bool success = 1;
  string message = 2;
  repeated Task tasks = 3;
  int32 total = 4;
}

message DeleteResponse {
  bool success = 1;
  string message = 2;
}

// Definição do serviço gRPC
service TaskService {
  // Operações CRUD
  rpc CreateTask(CreateTaskRequest) returns (TaskResponse);
  rpc GetTask(GetTaskRequest) returns (TaskResponse);
  rpc UpdateTask(UpdateTaskRequest) returns (TaskResponse);
  rpc DeleteTask(DeleteTaskRequest) returns (DeleteResponse);
  rpc ListTasks(ListTasksRequest) returns (TaskListResponse);
  
  // Streaming de notificações
  rpc StreamTaskUpdates(ListTasksRequest) returns (stream TaskResponse);
}
```

---

## **PASSO 3: Armazenamento de Dados**

### 3.1 Storage em Memória (`src/data/storage.js`)

```javascript
const { v4: uuidv4 } = require('uuid');

class TaskStorage {
    constructor() {
        this.tasks = new Map();
        this.subscribers = new Set();
    }

    // Criar tarefa
    createTask(taskData) {
        const task = {
            id: uuidv4(),
            title: taskData.title,
            description: taskData.description || '',
            completed: false,
            priority: taskData.priority || 'medium',
            user_id: taskData.user_id,
            created_at: Date.now()
        };

        this.tasks.set(task.id, task);
        this.notifySubscribers('CREATED', task);
        return task;
    }

    // Buscar tarefa
    getTask(id) {
        return this.tasks.get(id) || null;
    }

    // Listar tarefas com filtros
    listTasks(userId, completed = null, priority = null) {
        const tasks = Array.from(this.tasks.values())
            .filter(task => task.user_id === userId)
            .filter(task => completed === null || task.completed === completed)
            .filter(task => !priority || task.priority === priority)
            .sort((a, b) => b.created_at - a.created_at);

        return tasks;
    }

    // Atualizar tarefa
    updateTask(id, updates) {
        const task = this.tasks.get(id);
        if (!task) return null;

        const updatedTask = {
            ...task,
            ...updates,
            id: task.id, // Preservar ID
            user_id: task.user_id, // Preservar user_id
            created_at: task.created_at // Preservar data de criação
        };

        this.tasks.set(id, updatedTask);
        this.notifySubscribers('UPDATED', updatedTask);
        return updatedTask;
    }

    // Deletar tarefa
    deleteTask(id) {
        const task = this.tasks.get(id);
        if (!task) return false;

        this.tasks.delete(id);
        this.notifySubscribers('DELETED', task);
        return true;
    }

    // Sistema de notificações para streaming
    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    notifySubscribers(action, task) {
        this.subscribers.forEach(callback => {
            try {
                callback({ action, task });
            } catch (error) {
                console.error('Erro ao notificar subscriber:', error);
            }
        });
    }

    // Estatísticas
    getStats(userId) {
        const userTasks = this.listTasks(userId);
        const completed = userTasks.filter(task => task.completed).length;
        const pending = userTasks.length - completed;

        return {
            total: userTasks.length,
            completed,
            pending,
            completion_rate: userTasks.length > 0 ? (completed / userTasks.length * 100).toFixed(2) : 0
        };
    }
}

module.exports = new TaskStorage();
```

---

## **PASSO 4: Implementação do Serviço gRPC**

### 4.1 Serviço de Tarefas (`src/server/services/taskService.js`)

```javascript
const storage = require('../../data/storage');

class TaskServiceImpl {
    // Criar tarefa
    createTask(call, callback) {
        try {
            const { title, description, priority, user_id } = call.request;

            // Validação básica
            if (!title?.trim()) {
                return callback(null, {
                    success: false,
                    message: 'Título é obrigatório',
                    task: null
                });
            }

            if (!user_id?.trim()) {
                return callback(null, {
                    success: false,
                    message: 'User ID é obrigatório',
                    task: null
                });
            }

            const task = storage.createTask({
                title: title.trim(),
                description: description?.trim() || '',
                priority: priority || 'medium',
                user_id: user_id.trim()
            });

            callback(null, {
                success: true,
                message: 'Tarefa criada com sucesso',
                task
            });
        } catch (error) {
            console.error('Erro ao criar tarefa:', error);
            callback(null, {
                success: false,
                message: 'Erro interno do servidor',
                task: null
            });
        }
    }

    // Buscar tarefa
    getTask(call, callback) {
        try {
            const { id } = call.request;
            const task = storage.getTask(id);

            if (!task) {
                return callback(null, {
                    success: false,
                    message: 'Tarefa não encontrada',
                    task: null
                });
            }

            callback(null, {
                success: true,
                message: 'Tarefa encontrada',
                task
            });
        } catch (error) {
            console.error('Erro ao buscar tarefa:', error);
            callback(null, {
                success: false,
                message: 'Erro interno do servidor',
                task: null
            });
        }
    }

    // Listar tarefas
    listTasks(call, callback) {
        try {
            const { user_id, completed, priority } = call.request;
            
            const tasks = storage.listTasks(
                user_id,
                completed !== null ? completed : null,
                priority || null
            );

            callback(null, {
                success: true,
                message: `${tasks.length} tarefa(s) encontrada(s)`,
                tasks,
                total: tasks.length
            });
        } catch (error) {
            console.error('Erro ao listar tarefas:', error);
            callback(null, {
                success: false,
                message: 'Erro interno do servidor',
                tasks: [],
                total: 0
            });
        }
    }

    // Atualizar tarefa
    updateTask(call, callback) {
        try {
            const { id, title, description, completed, priority } = call.request;
            
            const updates = {};
            if (title !== undefined) updates.title = title.trim();
            if (description !== undefined) updates.description = description.trim();
            if (completed !== undefined) updates.completed = completed;
            if (priority !== undefined) updates.priority = priority;

            const task = storage.updateTask(id, updates);

            if (!task) {
                return callback(null, {
                    success: false,
                    message: 'Tarefa não encontrada',
                    task: null
                });
            }

            callback(null, {
                success: true,
                message: 'Tarefa atualizada com sucesso',
                task
            });
        } catch (error) {
            console.error('Erro ao atualizar tarefa:', error);
            callback(null, {
                success: false,
                message: 'Erro interno do servidor',
                task: null
            });
        }
    }

    // Deletar tarefa
    deleteTask(call, callback) {
        try {
            const { id } = call.request;
            const deleted = storage.deleteTask(id);

            if (!deleted) {
                return callback(null, {
                    success: false,
                    message: 'Tarefa não encontrada'
                });
            }

            callback(null, {
                success: true,
                message: 'Tarefa deletada com sucesso'
            });
        } catch (error) {
            console.error('Erro ao deletar tarefa:', error);
            callback(null, {
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    // Stream de atualizações em tempo real
    streamTaskUpdates(call) {
        const { user_id } = call.request;
        console.log(`🔄 Cliente conectado ao stream: ${user_id}`);

        // Enviar tarefas existentes
        const existingTasks = storage.listTasks(user_id);
        existingTasks.forEach(task => {
            call.write({
                success: true,
                message: 'Tarefa existente',
                task
            });
        });

        // Inscrever para futuras atualizações
        const unsubscribe = storage.subscribe(({ action, task }) => {
            if (task.user_id === user_id) {
                call.write({
                    success: true,
                    message: `Tarefa ${action.toLowerCase()}`,
                    task
                });
            }
        });

        // Cleanup quando cliente desconectar
        call.on('cancelled', () => {
            console.log(`❌ Cliente desconectado do stream: ${user_id}`);
            unsubscribe();
        });

        call.on('error', (error) => {
            console.error('Erro no stream:', error);
            unsubscribe();
        });
    }
}

module.exports = TaskServiceImpl;
```

---

## **PASSO 5: Servidor gRPC**

### 5.1 Implementação do Servidor (`src/server/server.js`)

```javascript
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
```

---

## **PASSO 6: Cliente gRPC**

### 6.1 Implementação do Cliente (`src/client/client.js`)

```javascript
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
```

---

## **PASSO 7: Scripts de Configuração**

### 7.1 Atualizar Package.json

```json
{
  "name": "lab02-grpc-communication",
  "version": "1.0.0",
  "description": "Sistema de tarefas usando gRPC e Protocol Buffers",
  "main": "src/server/server.js",
  "scripts": {
    "server": "node src/server/server.js",
    "server:dev": "nodemon src/server/server.js",
    "client": "node src/client/client.js",
    "demo": "npm run client",
    "proto:generate": "grpc_tools_node_protoc --js_out=import_style=commonjs,binary:./generated --grpc_out=grpc_js:./generated --plugin=protoc-gen-grpc=`which grpc_tools_node_protoc_plugin` -I ./proto proto/*.proto"
  },
  "keywords": ["grpc", "protobuf", "sistemas-distribuidos", "rpc"],
  "author": "Aluno PUC Minas",
  "license": "MIT"
}
```

---

## **PASSO 8: Execução e Demonstração**

### 8.1 Executar o Sistema

```bash
# Terminal 1 - Iniciar servidor gRPC
npm run server

# Terminal 2 - Executar cliente de demonstração
npm run client
```

### 8.2 Saída Esperada do Servidor

```
🚀 =====================================
🚀 Servidor gRPC iniciado
🚀 Porta: 50051
🚀 Protocolo: HTTP/2 + Protocol Buffers
🚀 Serviços disponíveis:
🚀   - TaskService (CRUD + Streaming)
🚀 =====================================
```

### 8.3 Saída Esperada do Cliente

```
🔄 Demonstração Cliente gRPC

📝 Criando tarefas...
✅ Tarefa criada: Estudar gRPC
✅ Tarefa criada: Implementar servidor

📋 Listando tarefas...
📊 Total de tarefas: 2
  - Estudar gRPC [high]
  - Implementar servidor [medium]

🔄 Atualizando tarefa...
✅ Tarefa atualizada: Estudar gRPC - Concluído!

🌊 Iniciando stream de atualizações...
📨 Atualização recebida: Tarefa existente
   Tarefa: Estudar gRPC - Concluído!
📨 Atualização recebida: Tarefa existente
   Tarefa: Implementar servidor
📨 Atualização recebida: Tarefa created
   Tarefa: Nova tarefa via stream
📨 Atualização recebida: Tarefa updated
   Tarefa: Implementar servidor

✅ Demonstração concluída
```

---

## **PASSO 9: Análise Comparativa**

### 9.1 Comparação gRPC vs REST

| Aspecto | gRPC | REST |
|---------|------|------|
| **Protocolo** | HTTP/2 | HTTP/1.1 |
| **Serialização** | Protocol Buffers (binário) | JSON (texto) |
| **Performance** | ~60% mais rápido | Baseline |
| **Tamanho Payload** | ~30% menor | Baseline |
| **Tipagem** | Forte (schema) | Fraca (JSON) |
| **Streaming** | Bidirecional nativo | Limitado |
| **Caching** | Complexo | Simples (HTTP) |
| **Debug** | Requer ferramentas | Simples (curl) |

### 9.2 Casos de Uso Ideais para gRPC

**Recomendado para:**
- Comunicação interna entre microsserviços
- APIs de alta performance
- Aplicações em tempo real
- Sistemas que requerem tipagem forte
- Arquiteturas orientadas a eventos

**Não recomendado para:**
- APIs públicas para web browsers
- Sistemas que dependem de HTTP caching
- Integrações simples que requerem debug fácil
- Quando simplicidade é prioridade

## Exercícios Complementares

1. **Implementar Autenticação**: Adicionar interceptadores para autenticação JWT
2. **Métricas de Performance**: Medir latência e throughput comparado ao REST
3. **Error Handling**: Implementar tratamento robusto de erros gRPC
4. **Load Balancing**: Configurar balanceamento de carga entre múltiplos servidores
5. **Streaming Bidirecional**: Implementar chat em tempo real usando streaming

## Entregáveis

- [ ] Código fonte completo e funcional
- [ ] Definições Protocol Buffers bem estruturadas
- [ ] Servidor gRPC com operações CRUD
- [ ] Cliente gRPC com demonstração de uso
- [ ] Implementação de streaming em tempo real
- [ ] Documentação comparativa gRPC vs REST
- [ ] Análise de casos de uso apropriados

## Comandos de Execução

```bash
# Setup
npm install

# Servidor
npm run server

# Cliente/Demo
npm run client

# Desenvolvimento (auto-reload)
npm run server:dev
```

## Referências

<sup>[1]</sup> **gRPC Documentation**. Disponível em: https://grpc.io/docs/. Acesso em: 2025.

**TANENBAUM, Andrew S.; VAN STEEN, Maarten.** Distributed Systems: Principles and Paradigms. 3rd ed. Boston: Pearson, 2017.