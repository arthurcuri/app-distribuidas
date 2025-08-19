class MemoryCache {
    constructor() {
        this.cache = new Map();
        this.maxSize = 100; // Máximo de 100 itens no cache
        this.defaultTTL = 5 * 60 * 1000; // 5 minutos em milliseconds
    }

    // Gerar chave do cache baseada na requisição
    generateKey(userId, endpoint, query = {}) {
        const sortedQuery = Object.keys(query)
            .sort()
            .map(key => `${key}:${query[key]}`)
            .join('|');
        
        return `${userId}:${endpoint}:${sortedQuery}`;
    }

    // Buscar item no cache
    get(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            return null;
        }

        // Verificar se expirou
        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        // Atualizar timestamp de último acesso
        item.lastAccessed = Date.now();
        return item.data;
    }

    // Armazenar item no cache
    set(key, data, ttl = this.defaultTTL) {
        // Se cache está cheio, remover item mais antigo
        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }

        const item = {
            data,
            createdAt: Date.now(),
            lastAccessed: Date.now(),
            expiresAt: Date.now() + ttl
        };

        this.cache.set(key, item);
    }

    // Remover item mais antigo (LRU - Least Recently Used)
    evictOldest() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, item] of this.cache.entries()) {
            if (item.lastAccessed < oldestTime) {
                oldestTime = item.lastAccessed;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    // Invalidar cache para um usuário específico
    invalidateUser(userId) {
        const keysToDelete = [];
        
        for (const key of this.cache.keys()) {
            if (key.startsWith(`${userId}:`)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));
    }

    // Invalidar cache por padrão
    invalidatePattern(pattern) {
        const keysToDelete = [];
        
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));
    }

    // Limpar todo o cache
    clear() {
        this.cache.clear();
    }

    // Estatísticas do cache
    getStats() {
        const items = Array.from(this.cache.values());
        const now = Date.now();
        
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            usage: `${((this.cache.size / this.maxSize) * 100).toFixed(1)}%`,
            items: items.map(item => ({
                age: Math.round((now - item.createdAt) / 1000),
                ttl: Math.round((item.expiresAt - now) / 1000)
            }))
        };
    }
}

// Instância global do cache
const memoryCache = new MemoryCache();

// Middleware para cache de leitura
const cacheMiddleware = (endpoint, ttl) => {
    return (req, res, next) => {
        // Só cachear GET requests
        if (req.method !== 'GET') {
            return next();
        }

        const userId = req.user?.id;
        if (!userId) {
            return next();
        }

        const cacheKey = memoryCache.generateKey(userId, endpoint, req.query);
        const cachedData = memoryCache.get(cacheKey);

        if (cachedData) {
            // Log cache hit
            if (req.logger) {
                req.logger.cacheLog('hit', cacheKey, true, { endpoint, userId });
            }
            
            // Adicionar header indicando que veio do cache
            res.set('X-Cache', 'HIT');
            res.set('X-Cache-Key', cacheKey);
            return res.json(cachedData);
        }

        // Log cache miss
        if (req.logger) {
            req.logger.cacheLog('miss', cacheKey, false, { endpoint, userId });
        }

        // Interceptar a resposta para cachear
        const originalJson = res.json;
        res.json = function(data) {
            // Só cachear respostas de sucesso
            if (data.success) {
                memoryCache.set(cacheKey, data, ttl);
                if (req.logger) {
                    req.logger.cacheLog('set', cacheKey, false, { endpoint, userId, ttl });
                }
            }
            
            res.set('X-Cache', 'MISS');
            res.set('X-Cache-Key', cacheKey);
            return originalJson.call(this, data);
        };

        next();
    };
};

// Middleware para invalidar cache após modificações
const invalidateCacheMiddleware = (patterns = []) => {
    return (req, res, next) => {
        const originalJson = res.json;
        
        res.json = function(data) {
            // Se a operação foi bem-sucedida, invalidar cache
            if (data.success && req.user?.id) {
                const userId = req.user.id;
                
                if (patterns.length > 0) {
                    patterns.forEach(pattern => {
                        memoryCache.invalidatePattern(`${userId}:${pattern}`);
                        if (req.logger) {
                            req.logger.cacheLog('invalidate', `${userId}:${pattern}`, false, { 
                                patterns, 
                                userId,
                                operation: req.method 
                            });
                        }
                    });
                } else {
                    // Invalidar todo o cache do usuário
                    memoryCache.invalidateUser(userId);
                    if (req.logger) {
                        req.logger.cacheLog('invalidate-user', userId, false, { 
                            userId,
                            operation: req.method 
                        });
                    }
                }
            }
            
            return originalJson.call(this, data);
        };

        next();
    };
};

module.exports = {
    memoryCache,
    cacheMiddleware,
    invalidateCacheMiddleware
};
