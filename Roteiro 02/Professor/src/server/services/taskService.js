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