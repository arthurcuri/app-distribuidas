class Task {
    constructor(data) {
        this.id = data.id;
        this.title = data.title;
        this.description = data.description || '';
        this.completed = data.completed || false;
        this.priority = data.priority || 'medium';
        this.userId = data.userId;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
        this.dueDate = data.dueDate || null;
        this.category = data.category || 'general';
        this.tags = data.tags ? (typeof data.tags === 'string' ? JSON.parse(data.tags) : data.tags) : [];
    }

    validate() {
        const errors = [];
        if (!this.title?.trim()) errors.push('Título é obrigatório');
        if (!this.userId) errors.push('Usuário é obrigatório');
        
        // Validar categoria
        const validCategories = ['general', 'work', 'personal', 'study', 'health', 'finance', 'shopping'];
        if (this.category && !validCategories.includes(this.category)) {
            errors.push('Categoria inválida');
        }
        
        // Validar data de vencimento
        if (this.dueDate && new Date(this.dueDate) < new Date()) {
            errors.push('Data de vencimento deve ser futura');
        }
        
        return { isValid: errors.length === 0, errors };
    }

    static async create(taskData) {
        const { v4: uuidv4 } = require('uuid');
        const database = require('../database/database');
        const db = database;

        const task = {
            id: uuidv4(),
            title: taskData.title,
            description: taskData.description || '',
            completed: 0,
            priority: taskData.priority || 'medium',
            userId: taskData.userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            dueDate: taskData.dueDate || null,
            category: taskData.category || 'general',
            tags: JSON.stringify(taskData.tags || [])
        };

        await db.run(
            `INSERT INTO tasks (id, title, description, completed, priority, userId, createdAt, updatedAt, dueDate, category, tags) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [task.id, task.title, task.description, task.completed, task.priority, task.userId, 
             task.createdAt, task.updatedAt, task.dueDate, task.category, task.tags]
        );

        return new Task(task);
    }

    static async findById(id) {
        const database = require('../database/database');
        const db = database;
        const task = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
        return task ? new Task(task) : null;
    }

    static async findByUserId(userId, options = {}) {
        const database = require('../database/database');
        const db = database;
        
        const {
            page = 1,
            limit = 10,
            completed,
            priority,
            category,
            tags,
            dateFrom,
            dateTo,
            dueDateFrom,
            dueDateTo,
            search
        } = options;

        let query = 'SELECT * FROM tasks WHERE userId = ?';
        let countQuery = 'SELECT COUNT(*) as total FROM tasks WHERE userId = ?';
        const params = [userId];
        const countParams = [userId];

        // Filtros de status
        if (completed !== undefined) {
            query += ' AND completed = ?';
            countQuery += ' AND completed = ?';
            params.push(completed ? 1 : 0);
            countParams.push(completed ? 1 : 0);
        }

        // Filtro de prioridade
        if (priority) {
            query += ' AND priority = ?';
            countQuery += ' AND priority = ?';
            params.push(priority);
            countParams.push(priority);
        }

        // Filtro de categoria
        if (category) {
            query += ' AND category = ?';
            countQuery += ' AND category = ?';
            params.push(category);
            countParams.push(category);
        }

        // Filtro de tags
        if (tags && tags.length > 0) {
            const tagConditions = tags.map(() => 'tags LIKE ?').join(' OR ');
            query += ` AND (${tagConditions})`;
            countQuery += ` AND (${tagConditions})`;
            
            tags.forEach(tag => {
                params.push(`%"${tag}"%`);
                countParams.push(`%"${tag}"%`);
            });
        }

        // Filtros de data de criação
        if (dateFrom) {
            query += ' AND createdAt >= ?';
            countQuery += ' AND createdAt >= ?';
            params.push(dateFrom);
            countParams.push(dateFrom);
        }

        if (dateTo) {
            query += ' AND createdAt <= ?';
            countQuery += ' AND createdAt <= ?';
            params.push(dateTo);
            countParams.push(dateTo);
        }

        // Filtros de data de vencimento
        if (dueDateFrom) {
            query += ' AND dueDate >= ?';
            countQuery += ' AND dueDate >= ?';
            params.push(dueDateFrom);
            countParams.push(dueDateFrom);
        }

        if (dueDateTo) {
            query += ' AND dueDate <= ?';
            countQuery += ' AND dueDate <= ?';
            params.push(dueDateTo);
            countParams.push(dueDateTo);
        }

        // Busca por texto
        if (search) {
            query += ' AND (title LIKE ? OR description LIKE ?)';
            countQuery += ' AND (title LIKE ? OR description LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam);
            countParams.push(searchParam, searchParam);
        }

        // Ordenação e paginação
        query += ' ORDER BY createdAt DESC';
        
        const offset = (page - 1) * limit;
        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [tasks, countResult] = await Promise.all([
            db.all(query, params),
            db.get(countQuery, countParams)
        ]);

        const totalTasks = countResult.total;
        const totalPages = Math.ceil(totalTasks / limit);

        return {
            tasks: tasks.map(task => new Task(task)),
            pagination: {
                currentPage: page,
                totalPages,
                totalTasks,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        };
    }

    async update(updates) {
        const database = require('../database/database');
        const db = database;

        const allowedUpdates = ['title', 'description', 'completed', 'priority', 'dueDate', 'category', 'tags'];
        const updateFields = [];
        const params = [];

        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                updateFields.push(`${key} = ?`);
                if (key === 'tags' && Array.isArray(updates[key])) {
                    params.push(JSON.stringify(updates[key]));
                } else {
                    params.push(updates[key]);
                }
            }
        });

        if (updateFields.length === 0) return this;

        updateFields.push('updatedAt = ?');
        params.push(new Date().toISOString());
        params.push(this.id);

        await db.run(
            `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`,
            params
        );

        // Atualizar a instância atual
        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                if (key === 'tags' && Array.isArray(updates[key])) {
                    this[key] = updates[key];
                } else {
                    this[key] = updates[key];
                }
            }
        });
        this.updatedAt = new Date().toISOString();

        return this;
    }

    async delete() {
        const database = require('../database/database');
        const db = database;
        await db.run('DELETE FROM tasks WHERE id = ?', [this.id]);
        return true;
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            completed: this.completed,
            priority: this.priority,
            userId: this.userId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            dueDate: this.dueDate,
            category: this.category,
            tags: this.tags
        };
    }
}

module.exports = Task;