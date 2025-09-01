const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Task = require('../models/Task');
const database = require('../database/database');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { cacheMiddleware, invalidateCacheMiddleware, memoryCache } = require('../middleware/cache');
const logger = require('../middleware/logger');

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Listar tarefas (com cache de 3 minutos e filtros avançados)
router.get('/', cacheMiddleware('tasks', 3 * 60 * 1000), async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { 
            completed, 
            priority, 
            page, 
            limit,
            category,
            tags,
            dateFrom,
            dateTo,
            dueDateFrom,
            dueDateTo,
            search
        } = req.query;
        
        logger.info('Tasks list requested with advanced filters', {
            requestId: req.requestId,
            userId: req.user.id,
            filters: { 
                completed, priority, page, limit, category, tags, 
                dateFrom, dateTo, dueDateFrom, dueDateTo, search 
            }
        });
        
        // Preparar opções para o modelo
        const options = {
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 10,
        };

        // Aplicar filtros
        if (completed !== undefined) {
            options.completed = completed === 'true';
        }
        
        if (priority) {
            options.priority = priority;
        }
        
        if (category) {
            options.category = category;
        }
        
        if (tags) {
            // Suporte para múltiplas tags separadas por vírgula
            options.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
        }
        
        if (dateFrom) {
            options.dateFrom = dateFrom;
        }
        
        if (dateTo) {
            options.dateTo = dateTo;
        }
        
        if (dueDateFrom) {
            options.dueDateFrom = dueDateFrom;
        }
        
        if (dueDateTo) {
            options.dueDateTo = dueDateTo;
        }
        
        if (search) {
            options.search = search;
        }

        const queryStart = Date.now();
        const result = await Task.findByUserId(req.user.id, options);
        logger.dbLog('findByUserId', 'Task.findByUserId with filters', Date.now() - queryStart, { 
            userId: req.user.id, 
            rowCount: result.tasks.length,
            filters: options
        });

        const duration = Date.now() - startTime;
        logger.performanceLog('tasks-list-advanced', duration, {
            userId: req.user.id,
            totalItems: result.pagination.totalTasks,
            returnedItems: result.tasks.length,
            page: options.page,
            filters: options
        });

        res.json({
            success: true,
            data: result.tasks.map(task => task.toJSON()),
            pagination: {
                ...result.pagination,
                itemsPerPage: options.limit,
                nextPage: result.pagination.hasNextPage ? result.pagination.currentPage + 1 : null,
                prevPage: result.pagination.hasPrevPage ? result.pagination.currentPage - 1 : null
            },
            filters: options
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Error fetching tasks with advanced filters', {
            error: error.message,
            stack: error.stack,
            requestId: req.requestId,
            userId: req.user.id,
            duration
        });
        
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// Criar tarefa (invalida cache de listagens)
router.post('/', validate('task'), invalidateCacheMiddleware(['tasks', 'stats']), async (req, res) => {
    const startTime = Date.now();
    
    try {
        logger.info('Creating new task', {
            requestId: req.requestId,
            userId: req.user.id,
            taskData: req.body
        });

        const task = await Task.create({
            ...req.body,
            userId: req.user.id
        });
        
        const duration = Date.now() - startTime;
        logger.performanceLog('task-create', duration, {
            userId: req.user.id,
            taskId: task.id
        });

        res.status(201).json({
            success: true,
            message: 'Tarefa criada com sucesso',
            data: task.toJSON()
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Error creating task', {
            error: error.message,
            stack: error.stack,
            requestId: req.requestId,
            userId: req.user.id,
            duration
        });
        
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// Buscar tarefa por ID (com cache de 5 minutos)
router.get('/:id', cacheMiddleware('task-detail', 5 * 60 * 1000), async (req, res) => {
    const startTime = Date.now();
    
    try {
        logger.info('Fetching task by ID', {
            requestId: req.requestId,
            userId: req.user.id,
            taskId: req.params.id
        });

        const task = await Task.findById(req.params.id);

        if (!task || task.userId !== req.user.id) {
            logger.warn('Task not found or access denied', {
                requestId: req.requestId,
                userId: req.user.id,
                taskId: req.params.id
            });
            
            return res.status(404).json({
                success: false,
                message: 'Tarefa não encontrada'
            });
        }

        const duration = Date.now() - startTime;
        logger.performanceLog('task-detail', duration, {
            userId: req.user.id,
            taskId: task.id
        });

        res.json({
            success: true,
            data: task.toJSON()
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Error fetching task by ID', {
            error: error.message,
            stack: error.stack,
            requestId: req.requestId,
            userId: req.user.id,
            taskId: req.params.id,
            duration
        });
        
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// Atualizar tarefa (invalida cache)
router.put('/:id', invalidateCacheMiddleware(['tasks', 'task-detail', 'stats']), async (req, res) => {
    const startTime = Date.now();
    
    try {
        logger.info('Updating task', {
            requestId: req.requestId,
            userId: req.user.id,
            taskId: req.params.id,
            updates: req.body
        });

        const task = await Task.findById(req.params.id);

        if (!task || task.userId !== req.user.id) {
            logger.warn('Task not found for update or access denied', {
                requestId: req.requestId,
                userId: req.user.id,
                taskId: req.params.id
            });
            
            return res.status(404).json({
                success: false,
                message: 'Tarefa não encontrada'
            });
        }

        const updatedTask = await task.update(req.body);
        
        const duration = Date.now() - startTime;
        logger.performanceLog('task-update', duration, {
            userId: req.user.id,
            taskId: task.id
        });

        res.json({
            success: true,
            message: 'Tarefa atualizada com sucesso',
            data: updatedTask.toJSON()
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Error updating task', {
            error: error.message,
            stack: error.stack,
            requestId: req.requestId,
            userId: req.user.id,
            taskId: req.params.id,
            duration
        });
        
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// Deletar tarefa (invalida cache)
router.delete('/:id', invalidateCacheMiddleware(['tasks', 'task-detail', 'stats']), async (req, res) => {
    const startTime = Date.now();
    
    try {
        logger.info('Deleting task', {
            requestId: req.requestId,
            userId: req.user.id,
            taskId: req.params.id
        });

        const task = await Task.findById(req.params.id);

        if (!task || task.userId !== req.user.id) {
            logger.warn('Task not found for deletion or access denied', {
                requestId: req.requestId,
                userId: req.user.id,
                taskId: req.params.id
            });
            
            return res.status(404).json({
                success: false,
                message: 'Tarefa não encontrada'
            });
        }

        await task.delete();
        
        const duration = Date.now() - startTime;
        logger.performanceLog('task-delete', duration, {
            userId: req.user.id,
            taskId: req.params.id
        });

        res.json({
            success: true,
            message: 'Tarefa deletada com sucesso'
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Error deleting task', {
            error: error.message,
            stack: error.stack,
            requestId: req.requestId,
            userId: req.user.id,
            taskId: req.params.id,
            duration
        });
        
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// Estatísticas (com cache de 2 minutos)
router.get('/stats/summary', cacheMiddleware('stats', 2 * 60 * 1000), async (req, res) => {
    try {
        const stats = await database.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as pending
            FROM tasks WHERE userId = ?
        `, [req.user.id]);

        res.json({
            success: true,
            data: {
                ...stats,
                completionRate: stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(2) : 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Estatísticas do cache (rota de debug)
router.get('/cache/stats', (req, res) => {
    try {
        const stats = memoryCache.getStats();
        res.json({
            success: true,
            data: {
                cache: stats,
                info: {
                    description: 'Cache em memória para consultas frequentes',
                    ttl: {
                        tasks: '3 minutos',
                        'task-detail': '5 minutos',
                        stats: '2 minutos'
                    }
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Limpar cache (rota de debug)
router.delete('/cache/clear', (req, res) => {
    try {
        memoryCache.invalidateUser(req.user.id);
        res.json({
            success: true,
            message: 'Cache limpo com sucesso'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Rota para forçar diferentes tipos de log (apenas para testes)
router.post('/test/logs/:level', (req, res) => {
    try {
        const { level } = req.params;
        const { message } = req.body;
        
        const testMessage = message || `Teste de log ${level.toUpperCase()}`;
        const testData = {
            requestId: req.requestId,
            userId: req.user.id,
            testData: 'Dados de teste para logs',
            timestamp: new Date().toISOString()
        };

        switch (level.toLowerCase()) {
            case 'error':
                logger.error(testMessage, testData);
                break;
            case 'warn':
                logger.warn(testMessage, testData);
                break;
            case 'info':
                logger.info(testMessage, testData);
                break;
            case 'debug':
                logger.debug(testMessage, testData);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Nível de log inválido. Use: error, warn, info, debug'
                });
        }

        res.json({
            success: true,
            message: `Log ${level.toUpperCase()} gerado com sucesso`,
            data: {
                level: level.toUpperCase(),
                message: testMessage,
                saved: level.toLowerCase() === 'error' || level.toLowerCase() === 'warn' || level.toLowerCase() === 'info'
            }
        });
    } catch (error) {
        logger.error('Erro ao gerar log de teste', {
            requestId: req.requestId,
            error: error.message
        });
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Rota para criar tarefas de exemplo com os novos campos (para teste dos filtros)
router.post('/test/create-samples', async (req, res) => {
    try {
        logger.info('Creating sample tasks for filter testing', {
            requestId: req.requestId,
            userId: req.user.id
        });

        const sampleTasks = [
            {
                title: 'Estudar JavaScript',
                description: 'Revisar conceitos avançados',
                priority: 'high',
                category: 'study',
                tags: ['javascript', 'programming', 'study'],
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 dias
            },
            {
                title: 'Comprar mantimentos',
                description: 'Lista de compras da semana',
                priority: 'medium',
                category: 'shopping',
                tags: ['compras', 'casa'],
                dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // 2 dias
            },
            {
                title: 'Reunião de trabalho',
                description: 'Reunião mensal de equipe',
                priority: 'high',
                category: 'work',
                tags: ['reunião', 'equipe', 'mensal'],
                dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 dias
            },
            {
                title: 'Exercícios físicos',
                description: 'Treino na academia',
                priority: 'medium',
                category: 'health',
                tags: ['exercício', 'saúde', 'academia'],
                dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString() // 1 dia
            },
            {
                title: 'Organizar documentos',
                description: 'Organizar papéis pessoais',
                priority: 'low',
                category: 'personal',
                tags: ['organização', 'documentos'],
                dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 dias
            }
        ];

        const createdTasks = [];
        for (const taskData of sampleTasks) {
            const task = await Task.create({
                ...taskData,
                userId: req.user.id
            });
            createdTasks.push(task);
        }

        // Invalidar cache
        memoryCache.invalidatePattern('tasks');

        res.status(201).json({
            success: true,
            message: `${createdTasks.length} tarefas de exemplo criadas com sucesso`,
            data: createdTasks.map(task => task.toJSON())
        });
    } catch (error) {
        logger.error('Error creating sample tasks', {
            error: error.message,
            stack: error.stack,
            requestId: req.requestId,
            userId: req.user.id
        });
        
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

// Rota para listar categorias disponíveis
router.get('/categories', (req, res) => {
    const categories = [
        { value: 'general', label: 'Geral' },
        { value: 'work', label: 'Trabalho' },
        { value: 'personal', label: 'Pessoal' },
        { value: 'study', label: 'Estudos' },
        { value: 'health', label: 'Saúde' },
        { value: 'finance', label: 'Finanças' },
        { value: 'shopping', label: 'Compras' }
    ];

    res.json({
        success: true,
        data: categories
    });
});

// Rota para listar filtros disponíveis
router.get('/filters/info', (req, res) => {
    res.json({
        success: true,
        data: {
            parameters: {
                page: { type: 'number', description: 'Número da página (padrão: 1)' },
                limit: { type: 'number', description: 'Itens por página (padrão: 10)' },
                completed: { type: 'boolean', description: 'Filtrar por status de conclusão' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Filtrar por prioridade' },
                category: { type: 'string', description: 'Filtrar por categoria' },
                tags: { type: 'string', description: 'Filtrar por tags (separadas por vírgula)' },
                dateFrom: { type: 'string', format: 'ISO 8601', description: 'Data inicial de criação' },
                dateTo: { type: 'string', format: 'ISO 8601', description: 'Data final de criação' },
                dueDateFrom: { type: 'string', format: 'ISO 8601', description: 'Data inicial de vencimento' },
                dueDateTo: { type: 'string', format: 'ISO 8601', description: 'Data final de vencimento' },
                search: { type: 'string', description: 'Busca por texto no título ou descrição' }
            },
            examples: {
                'Tarefas de trabalho': '/api/tasks?category=work',
                'Tarefas com alta prioridade': '/api/tasks?priority=high',
                'Tarefas com tags específicas': '/api/tasks?tags=javascript,programming',
                'Tarefas criadas hoje': `/api/tasks?dateFrom=${new Date().toISOString().split('T')[0]}`,
                'Busca por texto': '/api/tasks?search=reunião',
                'Filtros combinados': '/api/tasks?category=work&priority=high&completed=false&page=1&limit=5'
            }
        }
    });
});

module.exports = router;