const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./config/database');
const database = require('./database/database');
const logger = require('./middleware/logger');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');


/**
 * Servidor de Aplicação Tradicional
 * 
 * Implementa arquitetura cliente-servidor conforme Coulouris et al. (2012):
 * - Centralização do estado da aplicação
 * - Comunicação Request-Reply via HTTP
 * - Processamento síncrono das requisições
 */

const app = express();

// Middleware de segurança
app.use(helmet());
app.use(rateLimit(config.rateLimit));
app.use(cors());

// Logger middleware (antes de outros middlewares)
app.use(logger.middleware());

// Parsing de dados
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Logging de requisições
app.use((req, res, next) => {
    // Logger estruturado já está capturando, manter compatibilidade
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Rotas principais
app.get('/', (req, res) => {
    logger.info('Root endpoint accessed', { requestId: req.requestId });
    res.json({
        service: 'Task Management API',
        version: '1.0.0',
        architecture: 'Traditional Client-Server',
        endpoints: {
            auth: ['POST /api/auth/register', 'POST /api/auth/login'],
            tasks: ['GET /api/tasks', 'POST /api/tasks', 'PUT /api/tasks/:id', 'DELETE /api/tasks/:id'],
            users: ['GET /api/users', 'GET /api/users/:id', 'PUT /api/users/:id', 'DELETE /api/users/:id'],
            logs: ['GET /api/logs/stats']
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    logger.info('Health check accessed', { requestId: req.requestId });
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Logs stats endpoint
app.get('/api/logs/stats', (req, res) => {
    try {
        const stats = logger.getStats();
        logger.info('Log stats accessed', { requestId: req.requestId });
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('Error getting log stats', { 
            requestId: req.requestId,
            error: error.message 
        });
        res.status(500).json({
            success: false,
            message: 'Erro ao obter estatísticas de logs'
        });
    }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);

// 404 handler
app.use('*', (req, res) => {
    logger.warn('404 - Endpoint not found', { 
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl 
    });
    res.status(404).json({
        success: false,
        message: 'Endpoint não encontrado',
        requestId: req.requestId
    });
});

// Error handler global (logger middleware)
app.use(logger.errorMiddleware());

// Inicialização
async function startServer() {
    try {
        logger.systemLog('Server startup initiated');
        
        await database.init();
        logger.systemLog('Database initialized');
        
        app.listen(config.port, () => {
            logger.systemLog('Server started successfully', {
                port: config.port,
                url: `http://localhost:${config.port}`
            });
            
            console.log('🚀 =================================');
            console.log(`🚀 Servidor iniciado na porta ${config.port}`);
            console.log(`🚀 URL: http://localhost:${config.port}`);
            console.log(`🚀 Health: http://localhost:${config.port}/health`);
            console.log(`🚀 Logs: http://localhost:${config.port}/api/logs/stats`);
            console.log('🚀 =================================');
        });
    } catch (error) {
        logger.error('Server startup failed', { error: error.message, stack: error.stack });
        console.error('❌ Falha na inicialização:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = app;