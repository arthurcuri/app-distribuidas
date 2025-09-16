const fs = require('fs');
const path = require('path');
const axios = require('axios');

class ServiceRegistry {
  constructor(registryFile = null) {
    this.registryFile = registryFile || path.join(__dirname, 'services-registry.json');
    this.services = {};
    this.healthChecks = {};
    this.loadRegistry();
    
    // Health check automático a cada 30 segundos
    setInterval(() => {
      this.performHealthChecks();
    }, 30000);

    // Cleanup na saída do processo
    process.on('SIGTERM', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
    process.on('exit', () => this.cleanup());
  }

  loadRegistry() {
    try {
      if (fs.existsSync(this.registryFile)) {
        const content = fs.readFileSync(this.registryFile, 'utf8');
        const data = JSON.parse(content);
        this.services = data.services || {};
        
        // Limpa serviços antigos (mais de 2 minutos sem heartbeat)
        const now = Date.now();
        for (const [name, service] of Object.entries(this.services)) {
          if (now - service.lastHeartbeat > 120000) {
            delete this.services[name];
          }
        }
        
        this.saveRegistry();
      }
    } catch (error) {
      console.error('Erro ao carregar registry:', error.message);
      this.services = {};
    }
  }

  saveRegistry() {
    try {
      const data = {
        services: this.services,
        lastUpdate: new Date().toISOString()
      };
      
      const dir = path.dirname(this.registryFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.registryFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Erro ao salvar registry:', error.message);
    }
  }

  register(serviceName, serviceInfo) {
    const service = {
      name: serviceName,
      host: serviceInfo.host || 'localhost',
      port: serviceInfo.port,
      protocol: serviceInfo.protocol || 'http',
      version: serviceInfo.version || '1.0.0',
      status: 'healthy',
      registeredAt: new Date().toISOString(),
      lastHeartbeat: Date.now(),
      endpoints: serviceInfo.endpoints || [],
      metadata: serviceInfo.metadata || {}
    };

    service.url = `${service.protocol}://${service.host}:${service.port}`;
    service.healthEndpoint = serviceInfo.healthEndpoint || '/health';

    this.services[serviceName] = service;
    this.saveRegistry();
    
    console.log(`Serviço registrado: ${serviceName} em ${service.url}`);
    return service;
  }

  unregister(serviceName) {
    if (this.services[serviceName]) {
      delete this.services[serviceName];
      if (this.healthChecks[serviceName]) {
        clearInterval(this.healthChecks[serviceName]);
        delete this.healthChecks[serviceName];
      }
      this.saveRegistry();
      console.log(`Serviço removido: ${serviceName}`);
      return true;
    }
    return false;
  }

  discover(serviceName) {
    this.loadRegistry(); // Recarrega para pegar atualizações
    const service = this.services[serviceName];
    
    if (!service) {
      throw new Error(`Serviço '${serviceName}' não encontrado no registry`);
    }
    
    if (service.status !== 'healthy') {
      throw new Error(`Serviço '${serviceName}' está indisponível (status: ${service.status})`);
    }
    
    return service;
  }

  getAllServices() {
    this.loadRegistry();
    return { ...this.services };
  }

  getHealthyServices() {
    this.loadRegistry();
    const healthy = {};
    for (const [name, service] of Object.entries(this.services)) {
      if (service.status === 'healthy') {
        healthy[name] = service;
      }
    }
    return healthy;
  }

  heartbeat(serviceName) {
    if (this.services[serviceName]) {
      this.services[serviceName].lastHeartbeat = Date.now();
      this.services[serviceName].status = 'healthy';
      this.saveRegistry();
      return true;
    }
    return false;
  }

  async performHealthChecks() {
    const promises = [];
    
    for (const [name, service] of Object.entries(this.services)) {
      promises.push(this.checkServiceHealth(name, service));
    }
    
    await Promise.allSettled(promises);
    this.saveRegistry();
  }

  async checkServiceHealth(serviceName, service) {
    try {
      const healthUrl = `${service.url}${service.healthEndpoint}`;
      const response = await axios.get(healthUrl, { 
        timeout: 5000,
        validateStatus: (status) => status === 200
      });
      
      if (response.status === 200) {
        service.status = 'healthy';
        service.lastHealthCheck = new Date().toISOString();
      } else {
        service.status = 'unhealthy';
      }
    } catch (error) {
      service.status = 'unhealthy';
      service.lastError = error.message;
      service.lastHealthCheck = new Date().toISOString();
      
      // Remove serviços que falharam por muito tempo
      const timeSinceLastHeartbeat = Date.now() - service.lastHeartbeat;
      if (timeSinceLastHeartbeat > 300000) { // 5 minutos
        console.log(`Removendo serviço inativo: ${serviceName}`);
        delete this.services[serviceName];
      }
    }
  }

  getServiceStats() {
    this.loadRegistry();
    const stats = {
      total: Object.keys(this.services).length,
      healthy: 0,
      unhealthy: 0,
      services: {}
    };

    for (const [name, service] of Object.entries(this.services)) {
      if (service.status === 'healthy') {
        stats.healthy++;
      } else {
        stats.unhealthy++;
      }
      
      stats.services[name] = {
        status: service.status,
        uptime: Date.now() - new Date(service.registeredAt).getTime(),
        lastHeartbeat: service.lastHeartbeat,
        url: service.url
      };
    }

    return stats;
  }

  cleanup() {
    // Remove este processo específico do registry
    const processServices = Object.keys(this.services).filter(name => {
      const service = this.services[name];
      return service.metadata && service.metadata.processId === process.pid;
    });

    processServices.forEach(serviceName => {
      this.unregister(serviceName);
    });
  }

  // Métodos de conveniência para o API Gateway
  async callService(serviceName, endpoint, options = {}) {
    const service = this.discover(serviceName);
    const url = `${service.url}${endpoint}`;
    
    const config = {
      timeout: options.timeout || 10000,
      ...options
    };

    try {
      const response = await axios(url, config);
      return response;
    } catch (error) {
      // Marca serviço como unhealthy em caso de erro
      if (this.services[serviceName]) {
        this.services[serviceName].status = 'unhealthy';
        this.services[serviceName].lastError = error.message;
        this.saveRegistry();
      }
      throw error;
    }
  }
}

// Singleton para ser compartilhado entre todos os serviços
let registryInstance = null;

function getServiceRegistry(registryFile = null) {
  if (!registryInstance) {
    registryInstance = new ServiceRegistry(registryFile);
  }
  return registryInstance;
}

module.exports = {
  ServiceRegistry,
  getServiceRegistry
};