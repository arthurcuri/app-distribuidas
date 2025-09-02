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