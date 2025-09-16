const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const JsonDatabase = require('../../shared/JsonDatabase');
const { getServiceRegistry } = require('../../shared/serviceRegistry');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'user-service-secret-key';

// Middlewares
app.use(cors());
app.use(express.json());

// Database
const usersDB = new JsonDatabase(
  path.join(__dirname, 'database', 'users.json'),
  path.join(__dirname, 'database', 'users_index.json')
);

// Service Registry
const registry = getServiceRegistry(path.join(__dirname, '../../shared/services-registry.json'));

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
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
    service: 'user-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ENDPOINTS DE AUTENTICAÇÃO

// Registro de usuário
app.post('/auth/register', async (req, res) => {
  try {
    const { email, username, password, firstName, lastName, preferences } = req.body;

    // Validações
    if (!email || !username || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: email, username, password, firstName, lastName' 
      });
    }

    // Verifica se email já existe
    const existingUser = usersDB.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Verifica se username já existe
    const existingUsername = usersDB.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ error: 'Username já cadastrado' });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Cria usuário
    const user = usersDB.create({
      email,
      username,
      password: hashedPassword,
      firstName,
      lastName,
      preferences: preferences || {
        defaultStore: '',
        currency: 'BRL'
      }
    });

    // Remove senha da resposta
    const { password: _, ...userResponse } = user;

    res.status(201).json({
      message: 'Usuário criado com sucesso',
      user: userResponse
    });

  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!password || (!email && !username)) {
      return res.status(400).json({ 
        error: 'Informe email/username e senha' 
      });
    }

    // Busca usuário por email ou username
    let user;
    if (email) {
      user = usersDB.findOne({ email });
    } else {
      user = usersDB.findOne({ username });
    }

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Verifica senha
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gera token JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        username: user.username 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remove senha da resposta
    const { password: _, ...userResponse } = user;

    res.json({
      message: 'Login realizado com sucesso',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ENDPOINTS DE USUÁRIO

// Buscar dados do usuário
app.get('/users/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    // Verifica se o usuário pode acessar os dados (só pode ver seus próprios dados)
    if (req.user.userId !== id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const user = usersDB.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Remove senha da resposta
    const { password: _, ...userResponse } = user;
    res.json(userResponse);

  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar perfil do usuário
app.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Verifica se o usuário pode atualizar os dados
    if (req.user.userId !== id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Remove campos que não devem ser atualizados diretamente
    delete updates.id;
    delete updates.createdAt;
    delete updates.updatedAt;

    // Se está atualizando senha, faz hash
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    // Se está atualizando email, verifica unicidade
    if (updates.email) {
      const existingUser = usersDB.findOne({ email: updates.email });
      if (existingUser && existingUser.id !== id) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }
    }

    // Se está atualizando username, verifica unicidade
    if (updates.username) {
      const existingUser = usersDB.findOne({ username: updates.username });
      if (existingUser && existingUser.id !== id) {
        return res.status(400).json({ error: 'Username já cadastrado' });
      }
    }

    const updatedUser = usersDB.update(id, updates);
    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Remove senha da resposta
    const { password: _, ...userResponse } = updatedUser;
    res.json({
      message: 'Usuário atualizado com sucesso',
      user: userResponse
    });

  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Middleware para validar token (usado por outros serviços)
app.post('/auth/validate', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token requerido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Token inválido' });
  }
});

// Endpoint para buscar informações básicas do usuário (para outros serviços)
app.get('/users/:id/info', (req, res) => {
  try {
    const { id } = req.params;
    const user = usersDB.findById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Retorna apenas informações públicas
    res.json({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName
    });

  } catch (error) {
    console.error('Erro ao buscar info do usuário:', error);
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
  console.log(`User Service rodando na porta ${PORT}`);
  
  // Registra o serviço
  registry.register('user-service', {
    host: 'localhost',
    port: PORT,
    healthEndpoint: '/health',
    endpoints: [
      'POST /auth/register',
      'POST /auth/login',
      'POST /auth/validate',
      'GET /users/:id',
      'PUT /users/:id',
      'GET /users/:id/info'
    ],
    metadata: {
      processId: process.pid,
      version: '1.0.0'
    }
  });
});

// Heartbeat periódico
setInterval(() => {
  registry.heartbeat('user-service');
}, 15000);

module.exports = app;