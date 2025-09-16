const express = require('express');
const cors = require('cors');
const path = require('path');
const { getServiceRegistry } = require('../shared/serviceRegistry');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Service Registry
const registry = getServiceRegistry(path.join(__dirname, '../shared/services-registry.json'));

// Circuit Breaker simples
class CircuitBreaker {
  constructor(serviceName, threshold = 3, timeout = 60000) {
    this.serviceName = serviceName;
    this.threshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error(`Circuit breaker OPEN for ${this.serviceName}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      console.log(`Circuit breaker OPEN for ${this.serviceName}`);
    }
  }

  getStatus() {
    return {
      serviceName: this.serviceName,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Circuit breakers para cada serviço
const circuitBreakers = {
  'user-service': new CircuitBreaker('user-service'),
  'item-service': new CircuitBreaker('item-service'),
  'list-service': new CircuitBreaker('list-service')
};

// Middleware de log
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - Gateway`);
  next();
});

// Função auxiliar para fazer proxy de requisições
async function proxyRequest(serviceName, path, req, res) {
  try {
    const circuitBreaker = circuitBreakers[serviceName];
    
    const result = await circuitBreaker.execute(async () => {
      const service = registry.discover(serviceName);
      const url = `${service.url}${path}`;
      
      const config = {
        method: req.method,
        url: url,
        headers: {
          ...req.headers,
          host: undefined, // Remove host header to avoid conflicts
        },
        timeout: 10000
      };

      if (req.body && Object.keys(req.body).length > 0) {
        config.data = req.body;
      }

      if (req.query && Object.keys(req.query).length > 0) {
        config.params = req.query;
      }

      const response = await registry.callService(serviceName, path, config);
      return response;
    });

    res.status(result.status).json(result.data);

  } catch (error) {
    console.error(`Erro no proxy para ${serviceName}:`, error.message);
    
    if (error.message.includes('Circuit breaker OPEN')) {
      res.status(503).json({ 
        error: `Serviço ${serviceName} temporariamente indisponível`,
        circuitBreakerOpen: true
      });
    } else if (error.message.includes('não encontrado no registry')) {
      res.status(503).json({ 
        error: `Serviço ${serviceName} não encontrado` 
      });
    } else if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(503).json({ 
        error: `Erro de comunicação com ${serviceName}` 
      });
    }
  }
}

// Health check do Gateway
app.get('/health', async (req, res) => {
  try {
    const services = registry.getAllServices();
    const healthStatus = {
      gateway: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      },
      services: {},
      circuitBreakers: {}
    };

    // Status dos serviços
    for (const [name, service] of Object.entries(services)) {
      healthStatus.services[name] = {
        status: service.status,
        url: service.url,
        lastHeartbeat: service.lastHeartbeat,
        lastHealthCheck: service.lastHealthCheck
      };
    }

    // Status dos circuit breakers
    for (const [name, breaker] of Object.entries(circuitBreakers)) {
      healthStatus.circuitBreakers[name] = breaker.getStatus();
    }

    res.json(healthStatus);

  } catch (error) {
    console.error('Erro no health check:', error);
    res.status(500).json({ error: 'Erro no health check do gateway' });
  }
});

// Registry info
app.get('/registry', (req, res) => {
  try {
    const services = registry.getAllServices();
    const stats = registry.getServiceStats();
    
    res.json({
      services,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao acessar registry:', error);
    res.status(500).json({ error: 'Erro ao acessar registry' });
  }
});

// ROTEAMENTO PARA MICROSSERVIÇOS

// User Service routes
app.use('/api/auth/*', (req, res) => {
  const path = req.originalUrl.replace('/api/auth', '/auth');
  proxyRequest('user-service', path, req, res);
});

app.use('/api/users/*', (req, res) => {
  const path = req.originalUrl.replace('/api/users', '/users');
  proxyRequest('user-service', path, req, res);
});

// Item Service routes
app.use('/api/items/*', (req, res) => {
  const path = req.originalUrl.replace('/api/items', '/items');
  proxyRequest('item-service', path, req, res);
});

app.use('/api/categories', (req, res) => {
  proxyRequest('item-service', '/categories', req, res);
});

app.use('/api/search', (req, res) => {
  if (req.query.type === 'global') {
    // Busca global (implementada abaixo)
    return globalSearch(req, res);
  } else {
    // Busca apenas em itens
    proxyRequest('item-service', '/search', req, res);
  }
});

// List Service routes
app.use('/api/lists/*', (req, res) => {
  const path = req.originalUrl.replace('/api/lists', '/lists');
  proxyRequest('list-service', path, req, res);
});

// ENDPOINTS AGREGADOS

// Dashboard com estatísticas do usuário
app.get('/api/dashboard', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Token de acesso requerido' });
    }

    // Valida token
    const userValidation = await registry.callService('user-service', '/auth/validate', {
      method: 'POST',
      data: { token: authHeader.split(' ')[1] }
    });

    if (!userValidation.data.valid) {
      return res.status(403).json({ error: 'Token inválido' });
    }

    const userId = userValidation.data.user.userId;

    // Busca dados do usuário
    const userResponse = await registry.callService('user-service', `/users/${userId}`, {
      method: 'GET',
      headers: { authorization: authHeader }
    });

    // Busca estatísticas das listas
    const statsResponse = await registry.callService('list-service', `/users/${userId}/stats`, {
      method: 'GET',
      headers: { authorization: authHeader }
    });

    // Busca listas ativas
    const listsResponse = await registry.callService('list-service', '/lists', {
      method: 'GET',
      headers: { authorization: authHeader },
      params: { status: 'active' }
    });

    const dashboard = {
      user: userResponse.data,
      stats: statsResponse.data,
      recentLists: listsResponse.data.lists.slice(0, 5), // Últimas 5 listas
      timestamp: new Date().toISOString()
    };

    res.json(dashboard);

  } catch (error) {
    console.error('Erro no dashboard:', error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Erro ao gerar dashboard' });
    }
  }
});

// Busca global (listas + itens)
async function globalSearch(req, res) {
  try {
    const { q } = req.query;
    const authHeader = req.headers['authorization'];

    if (!q) {
      return res.status(400).json({ error: 'Parâmetro de busca "q" é obrigatório' });
    }

    if (!authHeader) {
      return res.status(401).json({ error: 'Token de acesso requerido' });
    }

    // Busca em paralelo
    const [itemsSearch, userLists] = await Promise.allSettled([
      registry.callService('item-service', '/search', {
        method: 'GET',
        params: { q }
      }),
      registry.callService('list-service', '/lists', {
        method: 'GET',
        headers: { authorization: authHeader }
      })
    ]);

    const results = {
      query: q,
      items: [],
      lists: [],
      timestamp: new Date().toISOString()
    };

    // Processa resultados dos itens
    if (itemsSearch.status === 'fulfilled') {
      results.items = itemsSearch.value.data.items || [];
    }

    // Processa e filtra listas do usuário
    if (userLists.status === 'fulfilled') {
      const searchTerm = q.toLowerCase();
      results.lists = (userLists.value.data.lists || []).filter(list => 
        list.name.toLowerCase().includes(searchTerm) ||
        (list.description && list.description.toLowerCase().includes(searchTerm))
      );
    }

    res.json(results);

  } catch (error) {
    console.error('Erro na busca global:', error.message);
    res.status(500).json({ error: 'Erro na busca global' });
  }
}

// Status detalhado dos serviços
app.get('/api/status', async (req, res) => {
  try {
    const services = registry.getAllServices();
    const detailed = {};

    for (const [name, service] of Object.entries(services)) {
      try {
        const healthResponse = await registry.callService(name, '/health', {
          method: 'GET',
          timeout: 5000
        });
        
        detailed[name] = {
          ...service,
          healthCheck: healthResponse.data,
          circuitBreaker: circuitBreakers[name]?.getStatus()
        };
      } catch (error) {
        detailed[name] = {
          ...service,
          healthCheck: { error: error.message },
          circuitBreaker: circuitBreakers[name]?.getStatus()
        };
      }
    }

    res.json({
      gateway: {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      },
      services: detailed
    });

  } catch (error) {
    console.error('Erro no status:', error);
    res.status(500).json({ error: 'Erro ao verificar status' });
  }
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint não encontrado',
    path: req.originalUrl,
    availableRoutes: [
      'GET /health',
      'GET /registry', 
      'GET /api/status',
      'GET /api/dashboard',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/users/:id',
      'PUT /api/users/:id',
      'GET /api/items',
      'POST /api/items',
      'GET /api/categories',
      'GET /api/search',
      'GET /api/lists',
      'POST /api/lists'
    ]
  });
});

// Error handler global
app.use((error, req, res, next) => {
  console.error('Erro não tratado no Gateway:', error);
  res.status(500).json({ error: 'Erro interno do gateway' });
});

// Inicialização do servidor
app.listen(PORT, () => {
  console.log(`API Gateway rodando na porta ${PORT}`);
  console.log(`Acesse http://localhost:${PORT}/health para verificar status`);
  console.log(`Acesse http://localhost:${PORT}/registry para ver serviços registrados`);
  
  // Registra o gateway
  registry.register('api-gateway', {
    host: 'localhost',
    port: PORT,
    healthEndpoint: '/health',
    endpoints: [
      'GET /health',
      'GET /registry',
      'GET /api/dashboard',
      'GET /api/search (global)',
      'GET /api/status'
    ],
    metadata: {
      processId: process.pid,
      version: '1.0.0',
      type: 'gateway'
    }
  });
});

// Heartbeat periódico
setInterval(() => {
  registry.heartbeat('api-gateway');
}, 15000);

module.exports = app;