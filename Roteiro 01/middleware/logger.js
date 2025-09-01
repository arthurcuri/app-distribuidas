const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logLevels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };
        
        this.currentLevel = this.logLevels.INFO;
        this.logDir = path.join(__dirname, '../logs');
        
        // Criar diretório de logs se não existir
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    formatLog(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...meta,
            pid: process.pid,
            hostname: require('os').hostname()
        };

        return JSON.stringify(logEntry);
    }

    writeToFile(level, logEntry) {
        const today = new Date().toISOString().split('T')[0];
        const filename = `${today}-${level.toLowerCase()}.log`;
        const filepath = path.join(this.logDir, filename);
        
        fs.appendFileSync(filepath, logEntry + '\n');
    }

    writeToConsole(level, logEntry) {
        const colors = {
            ERROR: '\x1b[31m', // Red
            WARN: '\x1b[33m',  // Yellow
            INFO: '\x1b[36m',  // Cyan
            DEBUG: '\x1b[32m'  // Green
        };
        
        const reset = '\x1b[0m';
        const color = colors[level] || '';
        
        console.log(`${color}[${level}]${reset} ${logEntry}`);
    }

    log(level, message, meta = {}) {
        if (this.logLevels[level] > this.currentLevel) {
            return;
        }

        const logEntry = this.formatLog(level, message, meta);
        
        // Escrever no console
        this.writeToConsole(level, logEntry);
        
        // Escrever em arquivo baseado no nível
        if (level === 'ERROR') {
            this.writeToFile(level, logEntry);
        } else if (level === 'WARN') {
            this.writeToFile(level, logEntry);
        } else if (level === 'INFO') {
            // Salvar INFO em desenvolvimento também (para testes)
            this.writeToFile('info', logEntry);
        } else if (level === 'DEBUG' && process.env.NODE_ENV === 'production') {
            this.writeToFile(level, logEntry);
        }
    }

    error(message, meta = {}) {
        this.log('ERROR', message, meta);
    }

    warn(message, meta = {}) {
        this.log('WARN', message, meta);
    }

    info(message, meta = {}) {
        this.log('INFO', message, meta);
    }

    debug(message, meta = {}) {
        this.log('DEBUG', message, meta);
    }

    // Middleware para Express
    middleware() {
        return (req, res, next) => {
            const startTime = Date.now();
            const requestId = Math.random().toString(36).substr(2, 9);
            
            // Adicionar requestId ao request
            req.requestId = requestId;
            req.logger = this;

            // Log da requisição
            this.info('Request received', {
                requestId,
                method: req.method,
                url: req.originalUrl,
                userAgent: req.get('User-Agent'),
                ip: req.ip || req.connection.remoteAddress,
                userId: req.user?.id
            });

            // Interceptar resposta
            const originalSend = res.send;
            res.send = function(data) {
                const duration = Date.now() - startTime;
                
                // Log da resposta
                req.logger.info('Request completed', {
                    requestId,
                    method: req.method,
                    url: req.originalUrl,
                    statusCode: res.statusCode,
                    duration,
                    userId: req.user?.id
                });

                return originalSend.call(this, data);
            };

            next();
        };
    }

    // Middleware para capturar erros
    errorMiddleware() {
        return (err, req, res, next) => {
            this.error('Request error', {
                requestId: req.requestId,
                error: {
                    message: err.message,
                    stack: err.stack,
                    name: err.name
                },
                method: req.method,
                url: req.originalUrl,
                userId: req.user?.id
            });

            // Se response não foi enviado ainda
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Erro interno do servidor',
                    requestId: req.requestId
                });
            }
        };
    }

    // Logs de sistema
    systemLog(event, data = {}) {
        this.info(`System: ${event}`, {
            event,
            ...data,
            system: true
        });
    }

    // Logs de segurança
    securityLog(event, data = {}) {
        this.warn(`Security: ${event}`, {
            event,
            ...data,
            security: true
        });
    }

    // Logs de performance
    performanceLog(operation, duration, data = {}) {
        const level = duration > 1000 ? 'WARN' : 'INFO';
        this.log(level, `Performance: ${operation}`, {
            operation,
            duration,
            ...data,
            performance: true
        });
    }

    // Logs de cache
    cacheLog(operation, key, hit = false, data = {}) {
        this.debug(`Cache: ${operation}`, {
            operation,
            key,
            hit,
            ...data,
            cache: true
        });
    }

    // Logs de banco de dados
    dbLog(operation, query, duration, data = {}) {
        this.debug(`Database: ${operation}`, {
            operation,
            query,
            duration,
            ...data,
            database: true
        });
    }

    // Obter estatísticas de logs
    getStats() {
        const today = new Date().toISOString().split('T')[0];
        const stats = {
            date: today,
            files: [],
            totalSize: 0
        };

        try {
            const files = fs.readdirSync(this.logDir);
            files.forEach(file => {
                if (file.startsWith(today)) {
                    const filepath = path.join(this.logDir, file);
                    const stat = fs.statSync(filepath);
                    stats.files.push({
                        name: file,
                        size: stat.size,
                        modified: stat.mtime
                    });
                    stats.totalSize += stat.size;
                }
            });
        } catch (error) {
            this.error('Error reading log stats', { error: error.message });
        }

        return stats;
    }
}

// Instância global do logger
const logger = new Logger();

module.exports = logger;
