const express = require('express');
const cors = require('cors');
const path = require('path');
const JsonDatabase = require('../../shared/JsonDatabase');
const { getServiceRegistry } = require('../../shared/serviceRegistry');

const app = express();
const PORT = process.env.PORT || 3002;

// Middlewares
app.use(cors());
app.use(express.json());

// Database
const listsDB = new JsonDatabase(
  path.join(__dirname, 'database', 'lists.json'),
  path.join(__dirname, 'database', 'lists_index.json')
);

// Service Registry
const registry = getServiceRegistry(path.join(__dirname, '../../shared/services-registry.json'));

// Middleware de autenticação (verifica com User Service)
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }

  try {
    const userService = registry.discover('user-service');
    const response = await registry.callService('user-service', '/auth/validate', {
      method: 'POST',
      data: { token }
    });

    if (response.data.valid) {
      req.user = response.data.user;
      next();
    } else {
      res.status(403).json({ error: 'Token inválido' });
    }
  } catch (error) {
    console.error('Erro na validação do token:', error.message);
    res.status(503).json({ error: 'Serviço de autenticação indisponível' });
  }
};

// Função auxiliar para calcular resumo da lista
function calculateSummary(items) {
  const totalItems = items.length;
  const purchasedItems = items.filter(item => item.purchased).length;
  const estimatedTotal = items.reduce((total, item) => {
    return total + (item.estimatedPrice * item.quantity);
  }, 0);

  return {
    totalItems,
    purchasedItems,
    estimatedTotal: Math.round(estimatedTotal * 100) / 100
  };
}

// Função auxiliar para buscar dados do item no Item Service
async function getItemData(itemId) {
  try {
    const response = await registry.callService('item-service', `/items/${itemId}`, {
      method: 'GET'
    });
    return response.data;
  } catch (error) {
    console.error(`Erro ao buscar item ${itemId}:`, error.message);
    return null;
  }
}

// Middleware de log
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'list-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ENDPOINTS DE LISTAS

// Criar nova lista
app.post('/lists', authenticateToken, (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome da lista é obrigatório' });
    }

    const list = listsDB.create({
      userId: req.user.userId,
      name,
      description: description || '',
      status: 'active',
      items: [],
      summary: {
        totalItems: 0,
        purchasedItems: 0,
        estimatedTotal: 0
      }
    });

    res.status(201).json({
      message: 'Lista criada com sucesso',
      list
    });

  } catch (error) {
    console.error('Erro ao criar lista:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar listas do usuário
app.get('/lists', authenticateToken, (req, res) => {
  try {
    const { status } = req.query;
    let filter = { userId: req.user.userId };

    if (status) {
      filter.status = status;
    }

    const lists = listsDB.findAll(filter);

    res.json({
      lists,
      total: lists.length
    });

  } catch (error) {
    console.error('Erro ao listar listas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar lista específica
app.get('/lists/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const list = listsDB.findById(id);

    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    // Verifica se o usuário é o dono da lista
    if (list.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    res.json(list);

  } catch (error) {
    console.error('Erro ao buscar lista:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar lista (nome, descrição, status)
app.put('/lists/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const list = listsDB.findById(id);
    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    // Verifica se o usuário é o dono da lista
    if (list.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Remove campos que não devem ser atualizados diretamente
    delete updates.id;
    delete updates.userId;
    delete updates.items;
    delete updates.summary;
    delete updates.createdAt;
    delete updates.updatedAt;

    const updatedList = listsDB.update(id, updates);

    res.json({
      message: 'Lista atualizada com sucesso',
      list: updatedList
    });

  } catch (error) {
    console.error('Erro ao atualizar lista:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Deletar lista
app.delete('/lists/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const list = listsDB.findById(id);

    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    // Verifica se o usuário é o dono da lista
    if (list.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    listsDB.delete(id);

    res.json({ message: 'Lista deletada com sucesso' });

  } catch (error) {
    console.error('Erro ao deletar lista:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ENDPOINTS DE ITENS DA LISTA

// Adicionar item à lista
app.post('/lists/:id/items', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { itemId, quantity, estimatedPrice, notes } = req.body;

    if (!itemId || !quantity) {
      return res.status(400).json({ error: 'ItemId e quantity são obrigatórios' });
    }

    const list = listsDB.findById(id);
    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    // Verifica se o usuário é o dono da lista
    if (list.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Busca dados do item no Item Service
    const itemData = await getItemData(itemId);
    if (!itemData) {
      return res.status(404).json({ error: 'Item não encontrado no catálogo' });
    }

    // Verifica se o item já está na lista
    const existingItemIndex = list.items.findIndex(item => item.itemId === itemId);
    
    if (existingItemIndex >= 0) {
      // Atualiza quantidade se o item já existe
      list.items[existingItemIndex].quantity += quantity;
      list.items[existingItemIndex].estimatedPrice = estimatedPrice || itemData.averagePrice || 0;
      list.items[existingItemIndex].notes = notes || list.items[existingItemIndex].notes;
    } else {
      // Adiciona novo item
      const newItem = {
        itemId,
        itemName: itemData.name,
        quantity,
        unit: itemData.unit,
        estimatedPrice: estimatedPrice || itemData.averagePrice || 0,
        purchased: false,
        notes: notes || '',
        addedAt: new Date().toISOString()
      };
      list.items.push(newItem);
    }

    // Recalcula resumo
    list.summary = calculateSummary(list.items);

    // Salva atualizações
    const updatedList = listsDB.update(id, { 
      items: list.items, 
      summary: list.summary 
    });

    res.status(201).json({
      message: 'Item adicionado à lista com sucesso',
      list: updatedList
    });

  } catch (error) {
    console.error('Erro ao adicionar item:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar item na lista
app.put('/lists/:id/items/:itemId', authenticateToken, (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { quantity, estimatedPrice, purchased, notes } = req.body;

    const list = listsDB.findById(id);
    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    // Verifica se o usuário é o dono da lista
    if (list.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Encontra o item na lista
    const itemIndex = list.items.findIndex(item => item.itemId === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item não encontrado na lista' });
    }

    // Atualiza campos do item
    if (quantity !== undefined) list.items[itemIndex].quantity = quantity;
    if (estimatedPrice !== undefined) list.items[itemIndex].estimatedPrice = estimatedPrice;
    if (purchased !== undefined) list.items[itemIndex].purchased = purchased;
    if (notes !== undefined) list.items[itemIndex].notes = notes;

    // Recalcula resumo
    list.summary = calculateSummary(list.items);

    // Salva atualizações
    const updatedList = listsDB.update(id, { 
      items: list.items, 
      summary: list.summary 
    });

    res.json({
      message: 'Item atualizado com sucesso',
      list: updatedList
    });

  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Remover item da lista
app.delete('/lists/:id/items/:itemId', authenticateToken, (req, res) => {
  try {
    const { id, itemId } = req.params;

    const list = listsDB.findById(id);
    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    // Verifica se o usuário é o dono da lista
    if (list.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Remove o item da lista
    const initialLength = list.items.length;
    list.items = list.items.filter(item => item.itemId !== itemId);

    if (list.items.length === initialLength) {
      return res.status(404).json({ error: 'Item não encontrado na lista' });
    }

    // Recalcula resumo
    list.summary = calculateSummary(list.items);

    // Salva atualizações
    const updatedList = listsDB.update(id, { 
      items: list.items, 
      summary: list.summary 
    });

    res.json({
      message: 'Item removido da lista com sucesso',
      list: updatedList
    });

  } catch (error) {
    console.error('Erro ao remover item:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Resumo da lista
app.get('/lists/:id/summary', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const list = listsDB.findById(id);

    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    // Verifica se o usuário é o dono da lista
    if (list.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Calcula estatísticas detalhadas
    const itemsByCategory = {};
    const purchasedByCategory = {};

    list.items.forEach(item => {
      // Para simplicidade, usamos uma categoria padrão se não temos acesso aos dados do item
      const category = 'Geral';
      
      if (!itemsByCategory[category]) {
        itemsByCategory[category] = [];
        purchasedByCategory[category] = 0;
      }
      
      itemsByCategory[category].push(item);
      if (item.purchased) {
        purchasedByCategory[category]++;
      }
    });

    const detailedSummary = {
      ...list.summary,
      progress: list.summary.totalItems > 0 ? 
        Math.round((list.summary.purchasedItems / list.summary.totalItems) * 100) : 0,
      itemsByCategory,
      purchasedByCategory,
      listInfo: {
        id: list.id,
        name: list.name,
        status: list.status,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt
      }
    };

    res.json(detailedSummary);

  } catch (error) {
    console.error('Erro ao gerar resumo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Estatísticas do usuário (para o dashboard)
app.get('/users/:userId/stats', authenticateToken, (req, res) => {
  try {
    const { userId } = req.params;

    // Verifica se o usuário pode acessar as estatísticas
    if (req.user.userId !== userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const userLists = listsDB.findAll({ userId });
    
    const stats = {
      totalLists: userLists.length,
      activeLists: userLists.filter(list => list.status === 'active').length,
      completedLists: userLists.filter(list => list.status === 'completed').length,
      archivedLists: userLists.filter(list => list.status === 'archived').length,
      totalItems: userLists.reduce((total, list) => total + list.summary.totalItems, 0),
      totalPurchased: userLists.reduce((total, list) => total + list.summary.purchasedItems, 0),
      totalEstimated: userLists.reduce((total, list) => total + list.summary.estimatedTotal, 0)
    };

    stats.completionRate = stats.totalItems > 0 ? 
      Math.round((stats.totalPurchased / stats.totalItems) * 100) : 0;

    res.json(stats);

  } catch (error) {
    console.error('Erro ao gerar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Erro não tratado:', error);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado' });
});

// Inicialização do servidor
app.listen(PORT, () => {
  console.log(`List Service rodando na porta ${PORT}`);
  
  // Registra o serviço
  registry.register('list-service', {
    host: 'localhost',
    port: PORT,
    healthEndpoint: '/health',
    endpoints: [
      'POST /lists',
      'GET /lists',
      'GET /lists/:id',
      'PUT /lists/:id',
      'DELETE /lists/:id',
      'POST /lists/:id/items',
      'PUT /lists/:id/items/:itemId',
      'DELETE /lists/:id/items/:itemId',
      'GET /lists/:id/summary',
      'GET /users/:userId/stats'
    ],
    metadata: {
      processId: process.pid,
      version: '1.0.0'
    }
  });
});

// Heartbeat periódico
setInterval(() => {
  registry.heartbeat('list-service');
}, 15000);

module.exports = app;