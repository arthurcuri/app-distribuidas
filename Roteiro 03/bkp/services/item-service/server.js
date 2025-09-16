const express = require('express');
const cors = require('cors');
const path = require('path');
const JsonDatabase = require('../../shared/JsonDatabase');
const { getServiceRegistry } = require('../../shared/serviceRegistry');

const app = express();
const PORT = process.env.PORT || 3003;

// Middlewares
app.use(cors());
app.use(express.json());

// Database
const itemsDB = new JsonDatabase(
  path.join(__dirname, 'database', 'items.json'),
  path.join(__dirname, 'database', 'items_index.json')
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

// Middleware de log
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'item-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Inicializar dados de exemplo se necessário
function initializeItems() {
  if (itemsDB.count() === 0) {
    const sampleItems = [
      // Alimentos
      { name: 'Arroz Branco', category: 'Alimentos', brand: 'Tio João', unit: 'kg', averagePrice: 4.50, barcode: '7891234567890', description: 'Arroz branco tipo 1', active: true },
      { name: 'Feijão Preto', category: 'Alimentos', brand: 'Camil', unit: 'kg', averagePrice: 6.90, barcode: '7891234567891', description: 'Feijão preto tipo 1', active: true },
      { name: 'Óleo de Soja', category: 'Alimentos', brand: 'Soya', unit: 'litro', averagePrice: 4.20, barcode: '7891234567892', description: 'Óleo de soja refinado', active: true },
      { name: 'Açúcar Cristal', category: 'Alimentos', brand: 'União', unit: 'kg', averagePrice: 3.80, barcode: '7891234567893', description: 'Açúcar cristal especial', active: true },
      { name: 'Sal Refinado', category: 'Alimentos', brand: 'Cisne', unit: 'kg', averagePrice: 2.10, barcode: '7891234567894', description: 'Sal refinado iodado', active: true },
      { name: 'Macarrão Espaguete', category: 'Alimentos', brand: 'Barilla', unit: 'un', averagePrice: 3.50, barcode: '7891234567895', description: 'Macarrão espaguete nº 8', active: true },
      
      // Limpeza
      { name: 'Detergente Neutro', category: 'Limpeza', brand: 'Ypê', unit: 'un', averagePrice: 2.30, barcode: '7891234567896', description: 'Detergente neutro 500ml', active: true },
      { name: 'Sabão em Pó', category: 'Limpeza', brand: 'OMO', unit: 'un', averagePrice: 8.90, barcode: '7891234567897', description: 'Sabão em pó 1kg', active: true },
      { name: 'Desinfetante', category: 'Limpeza', brand: 'Pinho Sol', unit: 'un', averagePrice: 3.40, barcode: '7891234567898', description: 'Desinfetante 500ml', active: true },
      { name: 'Papel Higiênico', category: 'Limpeza', brand: 'Neve', unit: 'un', averagePrice: 12.50, barcode: '7891234567899', description: 'Papel higiênico 12 rolos', active: true },
      { name: 'Esponja de Aço', category: 'Limpeza', brand: 'Bombril', unit: 'un', averagePrice: 2.80, barcode: '7891234567800', description: 'Esponja de aço pacote 8 unidades', active: true },
      
      // Higiene
      { name: 'Shampoo', category: 'Higiene', brand: 'Seda', unit: 'un', averagePrice: 7.90, barcode: '7891234567801', description: 'Shampoo 400ml', active: true },
      { name: 'Sabonete', category: 'Higiene', brand: 'Dove', unit: 'un', averagePrice: 2.50, barcode: '7891234567802', description: 'Sabonete em barra 90g', active: true },
      { name: 'Pasta de Dente', category: 'Higiene', brand: 'Colgate', unit: 'un', averagePrice: 4.20, barcode: '7891234567803', description: 'Pasta de dente 90g', active: true },
      { name: 'Desodorante', category: 'Higiene', brand: 'Rexona', unit: 'un', averagePrice: 6.80, barcode: '7891234567804', description: 'Desodorante aerosol 150ml', active: true },
      
      // Bebidas
      { name: 'Refrigerante Cola', category: 'Bebidas', brand: 'Coca-Cola', unit: 'litro', averagePrice: 5.50, barcode: '7891234567805', description: 'Refrigerante cola 2L', active: true },
      { name: 'Suco de Laranja', category: 'Bebidas', brand: 'Tang', unit: 'un', averagePrice: 3.20, barcode: '7891234567806', description: 'Suco em pó sabor laranja', active: true },
      { name: 'Água Mineral', category: 'Bebidas', brand: 'Crystal', unit: 'litro', averagePrice: 2.10, barcode: '7891234567807', description: 'Água mineral sem gás 1,5L', active: true },
      { name: 'Café Torrado', category: 'Bebidas', brand: '3 Corações', unit: 'un', averagePrice: 8.50, barcode: '7891234567808', description: 'Café torrado e moído 500g', active: true },
      
      // Padaria
      { name: 'Pão Francês', category: 'Padaria', brand: 'Padaria Local', unit: 'kg', averagePrice: 8.90, barcode: '7891234567809', description: 'Pão francês fresco', active: true },
      { name: 'Pão de Forma', category: 'Padaria', brand: 'Wickbold', unit: 'un', averagePrice: 4.80, barcode: '7891234567810', description: 'Pão de forma integral', active: true },
      { name: 'Bolo Chocolate', category: 'Padaria', brand: 'Bauducco', unit: 'un', averagePrice: 6.50, barcode: '7891234567811', description: 'Bolo de chocolate 300g', active: true }
    ];

    sampleItems.forEach(item => {
      itemsDB.create(item);
    });

    console.log('Dados de exemplo criados: 22 itens adicionados');
  }
}

// ENDPOINTS

// Listar itens com filtros
app.get('/items', (req, res) => {
  try {
    const { category, name, active = 'true' } = req.query;
    let filter = {};

    // Filtro por status ativo
    if (active !== 'all') {
      filter.active = active === 'true';
    }

    // Filtro por categoria
    if (category) {
      filter.category = category;
    }

    let items = itemsDB.findAll(filter);

    // Filtro por nome (busca parcial)
    if (name) {
      const searchTerm = name.toLowerCase();
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm)
      );
    }

    res.json({
      items,
      total: items.length
    });

  } catch (error) {
    console.error('Erro ao listar itens:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar item específico
app.get('/items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const item = itemsDB.findById(id);

    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    res.json(item);

  } catch (error) {
    console.error('Erro ao buscar item:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar novo item (requer autenticação)
app.post('/items', authenticateToken, (req, res) => {
  try {
    const { name, category, brand, unit, averagePrice, barcode, description } = req.body;

    // Validações
    if (!name || !category || !unit) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: name, category, unit' 
      });
    }

    const item = itemsDB.create({
      name,
      category,
      brand: brand || '',
      unit,
      averagePrice: averagePrice || 0,
      barcode: barcode || '',
      description: description || '',
      active: true
    });

    res.status(201).json({
      message: 'Item criado com sucesso',
      item
    });

  } catch (error) {
    console.error('Erro ao criar item:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar item
app.put('/items/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove campos que não devem ser atualizados diretamente
    delete updates.id;
    delete updates.createdAt;
    delete updates.updatedAt;

    const updatedItem = itemsDB.update(id, updates);
    if (!updatedItem) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    res.json({
      message: 'Item atualizado com sucesso',
      item: updatedItem
    });

  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar categorias disponíveis
app.get('/categories', (req, res) => {
  try {
    const items = itemsDB.findAll({ active: true });
    const categories = [...new Set(items.map(item => item.category))].sort();
    
    const categoriesWithCount = categories.map(category => ({
      name: category,
      count: items.filter(item => item.category === category).length
    }));

    res.json({
      categories: categoriesWithCount,
      total: categories.length
    });

  } catch (error) {
    console.error('Erro ao listar categorias:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar itens por nome
app.get('/search', (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Parâmetro de busca "q" é obrigatório' });
    }

    const items = itemsDB.search(q, ['name', 'description', 'brand']);
    const activeItems = items.filter(item => item.active);

    res.json({
      query: q,
      items: activeItems,
      total: activeItems.length
    });

  } catch (error) {
    console.error('Erro na busca:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar múltiplos itens por IDs (para outros serviços)
app.post('/items/batch', (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: 'IDs deve ser um array' });
    }

    const items = ids.map(id => itemsDB.findById(id)).filter(item => item !== null);

    res.json({
      items,
      found: items.length,
      requested: ids.length
    });

  } catch (error) {
    console.error('Erro na busca em lote:', error);
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
  console.log(`Item Service rodando na porta ${PORT}`);
  
  // Inicializa dados de exemplo
  initializeItems();
  
  // Registra o serviço
  registry.register('item-service', {
    host: 'localhost',
    port: PORT,
    healthEndpoint: '/health',
    endpoints: [
      'GET /items',
      'GET /items/:id',
      'POST /items',
      'PUT /items/:id',
      'GET /categories',
      'GET /search',
      'POST /items/batch'
    ],
    metadata: {
      processId: process.pid,
      version: '1.0.0'
    }
  });
});

// Heartbeat periódico
setInterval(() => {
  registry.heartbeat('item-service');
}, 15000);

module.exports = app;