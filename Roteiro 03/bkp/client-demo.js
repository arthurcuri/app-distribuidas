const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

class ShoppingListClient {
  constructor() {
    this.token = null;
    this.userId = null;
    this.currentUser = null;
  }

  // Função auxiliar para fazer requisições autenticadas
  async request(method, endpoint, data = null, headers = {}) {
    try {
      const config = {
        method,
        url: `${API_BASE_URL}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`${error.response.status}: ${error.response.data.error || error.response.statusText}`);
      } else {
        throw new Error(`Erro de rede: ${error.message}`);
      }
    }
  }

  // Função para aguardar um tempo
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Função para log formatado
  log(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  // 1. Registro de usuário
  async registerUser() {
    this.log('🔐 Registrando novo usuário...');
    
    const userData = {
      email: 'teste@example.com',
      username: 'usuario_teste',
      password: 'senha123',
      firstName: 'João',
      lastName: 'Silva',
      preferences: {
        defaultStore: 'Supermercado ABC',
        currency: 'BRL'
      }
    };

    try {
      const result = await this.request('POST', '/auth/register', userData);
      this.log('✅ Usuário registrado com sucesso!', result);
      return result;
    } catch (error) {
      if (error.message.includes('Email já cadastrado')) {
        this.log('ℹ️ Usuário já existe, continuando com o login...');
        return { user: { email: userData.email } };
      } else {
        throw error;
      }
    }
  }

  // 2. Login
  async login() {
    this.log('🔑 Fazendo login...');
    
    const loginData = {
      email: 'teste@example.com',
      password: 'senha123'
    };

    const result = await this.request('POST', '/auth/login', loginData);
    this.token = result.token;
    this.currentUser = result.user;
    this.userId = result.user.id;
    
    this.log('✅ Login realizado com sucesso!', {
      user: result.user.username,
      userId: this.userId
    });
    
    return result;
  }

  // 3. Buscar itens do catálogo
  async searchItems() {
    this.log('🔍 Buscando itens no catálogo...');
    
    // Busca geral
    const allItems = await this.request('GET', '/items');
    this.log(`📦 Total de itens disponíveis: ${allItems.total}`, {
      categorias: [...new Set(allItems.items.map(item => item.category))]
    });

    // Busca por categoria
    const alimentos = await this.request('GET', '/items?category=Alimentos');
    this.log(`🥘 Itens da categoria Alimentos: ${alimentos.total}`);

    // Busca por termo
    const arrozSearch = await this.request('GET', '/search?q=arroz');
    this.log(`🍚 Busca por "arroz": ${arrozSearch.total} resultados`, 
      arrozSearch.items.slice(0, 2));

    // Busca categorias
    const categories = await this.request('GET', '/categories');
    this.log('📋 Categorias disponíveis:', categories.categories);

    return { allItems, alimentos, arrozSearch, categories };
  }

  // 4. Criar lista de compras
  async createShoppingList() {
    this.log('📝 Criando lista de compras...');
    
    const listData = {
      name: 'Compras da Semana',
      description: 'Lista de compras para a semana do dia 15/09/2025'
    };

    const result = await this.request('POST', '/lists', listData);
    this.log('✅ Lista criada com sucesso!', result.list);
    
    return result.list;
  }

  // 5. Adicionar itens à lista
  async addItemsToList(listId, itemsData) {
    this.log(`🛒 Adicionando itens à lista ${listId}...`);
    
    const addedItems = [];
    
    for (const itemData of itemsData) {
      try {
        const result = await this.request('POST', `/lists/${listId}/items`, itemData);
        addedItems.push(result);
        this.log(`✅ Item adicionado: ${itemData.quantity}x ${itemData.itemId}`);
        
        // Pequena pausa entre as adições
        await this.sleep(500);
      } catch (error) {
        this.log(`❌ Erro ao adicionar item ${itemData.itemId}: ${error.message}`);
      }
    }
    
    return addedItems;
  }

  // 6. Visualizar lista completa
  async viewList(listId) {
    this.log(`👁️ Visualizando lista ${listId}...`);
    
    const list = await this.request('GET', `/lists/${listId}`);
    this.log('📋 Lista completa:', {
      nome: list.name,
      status: list.status,
      totalItens: list.summary.totalItems,
      valorEstimado: `R$ ${list.summary.estimatedTotal.toFixed(2)}`,
      itens: list.items.map(item => ({
        nome: item.itemName,
        quantidade: `${item.quantity} ${item.unit}`,
        preco: `R$ ${item.estimatedPrice.toFixed(2)}`,
        comprado: item.purchased ? '✅' : '❌'
      }))
    });
    
    return list;
  }

  // 7. Marcar alguns itens como comprados
  async markItemsAsPurchased(listId, itemIds) {
    this.log('✅ Marcando itens como comprados...');
    
    for (const itemId of itemIds) {
      try {
        await this.request('PUT', `/lists/${listId}/items/${itemId}`, {
          purchased: true
        });
        this.log(`✅ Item ${itemId} marcado como comprado`);
      } catch (error) {
        this.log(`❌ Erro ao marcar item ${itemId}: ${error.message}`);
      }
    }
  }

  // 8. Ver resumo da lista
  async getListSummary(listId) {
    this.log(`📊 Obtendo resumo da lista ${listId}...`);
    
    const summary = await this.request('GET', `/lists/${listId}/summary`);
    this.log('📈 Resumo da lista:', {
      progresso: `${summary.progress}%`,
      totalItens: summary.totalItems,
      itensComprados: summary.purchasedItems,
      valorEstimado: `R$ ${summary.estimatedTotal.toFixed(2)}`
    });
    
    return summary;
  }

  // 9. Visualizar dashboard
  async viewDashboard() {
    this.log('📊 Carregando dashboard do usuário...');
    
    const dashboard = await this.request('GET', '/dashboard');
    this.log('🏠 Dashboard:', {
      usuario: `${dashboard.user.firstName} ${dashboard.user.lastName}`,
      estatisticas: {
        totalListas: dashboard.stats.totalLists,
        listasAtivas: dashboard.stats.activeLists,
        totalItens: dashboard.stats.totalItems,
        taxaCompletude: `${dashboard.stats.completionRate}%`,
        valorTotal: `R$ ${dashboard.stats.totalEstimated.toFixed(2)}`
      },
      listasRecentes: dashboard.recentLists.length
    });
    
    return dashboard;
  }

  // 10. Testar busca global
  async testGlobalSearch() {
    this.log('🔍 Testando busca global...');
    
    const searchResult = await this.request('GET', '/search?type=global&q=compras');
    this.log('🌍 Resultado da busca global:', {
      termo: searchResult.query,
      itensEncontrados: searchResult.items.length,
      listasEncontradas: searchResult.lists.length
    });
    
    return searchResult;
  }

  // 11. Verificar health dos serviços
  async checkHealth() {
    this.log('🏥 Verificando saúde dos serviços...');
    
    try {
      const health = await axios.get('http://localhost:3000/health');
      this.log('💚 Status dos serviços:', {
        gateway: health.data.gateway.status,
        servicosAtivos: Object.keys(health.data.services).length,
        circuitBreakers: Object.entries(health.data.circuitBreakers).map(([name, status]) => ({
          servico: name,
          estado: status.state,
          falhas: status.failureCount
        }))
      });
      
      return health.data;
    } catch (error) {
      this.log('❌ Erro ao verificar health:', error.message);
      throw error;
    }
  }

  // Função principal para executar toda a demonstração
  async runDemo() {
    console.log('🚀 Iniciando demonstração do Sistema de Lista de Compras');
    console.log('=' .repeat(60));

    try {
      // Aguarda os serviços estarem prontos
      this.log('⏳ Aguardando serviços estarem prontos...');
      await this.sleep(2000);

      // 1. Verificar health dos serviços primeiro
      await this.checkHealth();

      // 2. Registro e login
      await this.registerUser();
      await this.login();

      // 3. Explorar catálogo
      const catalogData = await this.searchItems();

      // 4. Criar lista
      const newList = await this.createShoppingList();

      // 5. Adicionar itens à lista (pegando alguns itens do catálogo)
      const itemsToAdd = [
        {
          itemId: catalogData.allItems.items.find(i => i.name.includes('Arroz'))?.id,
          quantity: 2,
          estimatedPrice: 4.50,
          notes: 'Arroz tipo 1'
        },
        {
          itemId: catalogData.allItems.items.find(i => i.name.includes('Feijão'))?.id,
          quantity: 1,
          estimatedPrice: 6.90,
          notes: 'Feijão preto'
        },
        {
          itemId: catalogData.allItems.items.find(i => i.name.includes('Óleo'))?.id,
          quantity: 1,
          estimatedPrice: 4.20
        },
        {
          itemId: catalogData.allItems.items.find(i => i.name.includes('Açúcar'))?.id,
          quantity: 1,
          estimatedPrice: 3.80
        },
        {
          itemId: catalogData.allItems.items.find(i => i.name.includes('Detergente'))?.id,
          quantity: 2,
          estimatedPrice: 2.30
        }
      ].filter(item => item.itemId); // Remove itens não encontrados

      await this.addItemsToList(newList.id, itemsToAdd);

      // 6. Visualizar lista
      const completeList = await this.viewList(newList.id);

      // 7. Marcar alguns itens como comprados
      const itemsToMark = completeList.items.slice(0, 2).map(item => item.itemId);
      await this.markItemsAsPurchased(newList.id, itemsToMark);

      // 8. Ver resumo atualizado
      await this.getListSummary(newList.id);

      // 9. Ver dashboard
      await this.viewDashboard();

      // 10. Busca global
      await this.testGlobalSearch();

      // 11. Verificar health final
      await this.checkHealth();

      console.log('\n' + '=' .repeat(60));
      this.log('🎉 Demonstração concluída com sucesso!');
      console.log('=' .repeat(60));

    } catch (error) {
      console.log('\n' + '=' .repeat(60));
      this.log('❌ Erro durante a demonstração:', error.message);
      console.log('=' .repeat(60));
      process.exit(1);
    }
  }
}

// Executa a demonstração se for chamado diretamente
if (require.main === module) {
  const client = new ShoppingListClient();
  client.runDemo().catch(error => {
    console.error('Erro fatal:', error.message);
    process.exit(1);
  });
}

module.exports = ShoppingListClient;