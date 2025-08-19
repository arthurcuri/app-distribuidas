# API de Gerenciamento de Tarefas

Uma API RESTful completa para gerenciamento de tarefas com autenticação JWT, cache em memória, logs estruturados e filtros avançados.

## Funcionalidades

- Autenticação JWT - Login e registro seguro
- CRUD Completo - Criar, ler, atualizar e deletar tarefas
- Paginação Avançada - Controle total sobre listagens
- Cache em Memória - Performance otimizada com TTL
- Logs Estruturados - Monitoramento completo
- Filtros Avançados - Busca por categoria, tags, datas e texto
- Validação de Dados - Middleware de validação robusto

## Início Rápido

```bash
# Instalar dependências
npm install

# Iniciar servidor
npm start

# Servidor em desenvolvimento
npm run dev
```

O servidor estará disponível em: `http://localhost:3000`

---

## Documentação Completa da API

### Autenticação

#### Registrar Usuário
```http
POST /api/auth/register
```

**Body:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "123456",
  "firstName": "Nome",
  "lastName": "Sobrenome"
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Usuário criado com sucesso",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "username",
      "firstName": "Nome",
      "lastName": "Sobrenome"
    },
    "token": "jwt-token"
  }
}
```

#### Fazer Login
```http
POST /api/auth/login
```

**Body:**
```json
{
  "identifier": "user@example.com", // email ou username
  "password": "123456"
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Login realizado com sucesso",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "username",
      "firstName": "Nome",
      "lastName": "Sobrenome"
    },
    "token": "jwt-token"
  }
}
```

---

### Tarefas

> **Todas as rotas de tarefas requerem autenticação via header:**
> `Authorization: Bearer {token}`

#### Listar Tarefas (com Filtros Avançados)
```http
GET /api/tasks
```

**Query Parameters:**

| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| `page` | `number` | Número da página (padrão: 1) | `?page=2` |
| `limit` | `number` | Itens por página (padrão: 10) | `?limit=5` |
| `completed` | `boolean` | Filtrar por status | `?completed=true` |
| `priority` | `string` | Filtrar por prioridade | `?priority=high` |
| `category` | `string` | Filtrar por categoria | `?category=work` |
| `tags` | `string` | Filtrar por tags (separadas por vírgula) | `?tags=javascript,study` |
| `dateFrom` | `string` | Data inicial de criação (ISO 8601) | `?dateFrom=2025-08-19` |
| `dateTo` | `string` | Data final de criação (ISO 8601) | `?dateTo=2025-08-20` |
| `dueDateFrom` | `string` | Data inicial de vencimento | `?dueDateFrom=2025-08-25` |
| `dueDateTo` | `string` | Data final de vencimento | `?dueDateTo=2025-08-30` |
| `search` | `string` | Busca por texto (título/descrição) | `?search=reunião` |

**Exemplos de Uso:**

```bash
# Paginação básica
GET /api/tasks?page=1&limit=10

# Filtrar tarefas de trabalho com alta prioridade
GET /api/tasks?category=work&priority=high

# Buscar por tags específicas
GET /api/tasks?tags=javascript,programming,study

# Tarefas criadas hoje
GET /api/tasks?dateFrom=2025-08-19

# Filtros combinados
GET /api/tasks?category=work&priority=high&completed=false&page=1&limit=5

# Busca por texto
GET /api/tasks?search=reunião&category=work
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Estudar JavaScript",
      "description": "Revisar conceitos avançados",
      "completed": false,
      "priority": "high",
      "category": "study",
      "tags": ["javascript", "programming", "study"],
      "dueDate": "2025-08-26T21:00:00.000Z",
      "userId": "user-uuid",
      "createdAt": "2025-08-19T21:00:00.000Z",
      "updatedAt": "2025-08-19T21:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalTasks": 25,
    "hasNextPage": true,
    "hasPrevPage": false,
    "itemsPerPage": 10,
    "nextPage": 2,
    "prevPage": null
  },
  "filters": {
    "page": 1,
    "limit": 10,
    "category": "work"
  }
}
```

#### Criar Tarefa
```http
POST /api/tasks
```

**Body:**
```json
{
  "title": "Nova Tarefa",
  "description": "Descrição da tarefa",
  "priority": "medium", // low, medium, high
  "category": "work", // general, work, personal, study, health, finance, shopping
  "tags": ["tag1", "tag2"],
  "dueDate": "2025-08-25T10:00:00.000Z" // opcional
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Tarefa criada com sucesso",
  "data": {
    "id": "uuid",
    "title": "Nova Tarefa",
    "description": "Descrição da tarefa",
    "completed": false,
    "priority": "medium",
    "category": "work",
    "tags": ["tag1", "tag2"],
    "dueDate": "2025-08-25T10:00:00.000Z",
    "userId": "user-uuid",
    "createdAt": "2025-08-19T21:00:00.000Z",
    "updatedAt": "2025-08-19T21:00:00.000Z"
  }
}
```

#### Buscar Tarefa por ID
```http
GET /api/tasks/{id}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Tarefa Específica",
    "description": "Descrição",
    "completed": false,
    "priority": "high",
    "category": "work",
    "tags": ["important"],
    "dueDate": "2025-08-25T10:00:00.000Z",
    "userId": "user-uuid",
    "createdAt": "2025-08-19T21:00:00.000Z",
    "updatedAt": "2025-08-19T21:00:00.000Z"
  }
}
```

#### Atualizar Tarefa
```http
PUT /api/tasks/{id}
```

**Body (todos os campos são opcionais):**
```json
{
  "title": "Título Atualizado",
  "description": "Nova descrição",
  "completed": true,
  "priority": "low",
  "category": "personal",
  "tags": ["updated", "done"],
  "dueDate": "2025-08-30T15:00:00.000Z"
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Tarefa atualizada com sucesso",
  "data": {
    "id": "uuid",
    "title": "Título Atualizado",
    "description": "Nova descrição",
    "completed": true,
    "priority": "low",
    "category": "personal",
    "tags": ["updated", "done"],
    "dueDate": "2025-08-30T15:00:00.000Z",
    "userId": "user-uuid",
    "createdAt": "2025-08-19T21:00:00.000Z",
    "updatedAt": "2025-08-19T21:30:00.000Z"
  }
}
```

#### Deletar Tarefa
```http
DELETE /api/tasks/{id}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Tarefa deletada com sucesso"
}
```

#### Estatísticas de Tarefas
```http
GET /api/tasks/stats
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "total": 15,
    "completed": 8,
    "pending": 7,
    "completionRate": "53.33"
  }
}
```

---

### Rotas Auxiliares

#### Listar Categorias Disponíveis
```http
GET /api/tasks/categories
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    { "value": "general", "label": "Geral" },
    { "value": "work", "label": "Trabalho" },
    { "value": "personal", "label": "Pessoal" },
    { "value": "study", "label": "Estudos" },
    { "value": "health", "label": "Saúde" },
    { "value": "finance", "label": "Finanças" },
    { "value": "shopping", "label": "Compras" }
  ]
}
```

#### Informações sobre Filtros
```http
GET /api/tasks/filters/info
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "parameters": {
      "page": { "type": "number", "description": "Número da página (padrão: 1)" },
      "limit": { "type": "number", "description": "Itens por página (padrão: 10)" },
      "completed": { "type": "boolean", "description": "Filtrar por status de conclusão" },
      "priority": { "type": "string", "enum": ["low", "medium", "high"], "description": "Filtrar por prioridade" },
      "category": { "type": "string", "description": "Filtrar por categoria" },
      "tags": { "type": "string", "description": "Filtrar por tags (separadas por vírgula)" },
      "dateFrom": { "type": "string", "format": "ISO 8601", "description": "Data inicial de criação" },
      "dateTo": { "type": "string", "format": "ISO 8601", "description": "Data final de criação" },
      "dueDateFrom": { "type": "string", "format": "ISO 8601", "description": "Data inicial de vencimento" },
      "dueDateTo": { "type": "string", "format": "ISO 8601", "description": "Data final de vencimento" },
      "search": { "type": "string", "description": "Busca por texto no título ou descrição" }
    },
    "examples": {
      "Tarefas de trabalho": "/api/tasks?category=work",
      "Tarefas com alta prioridade": "/api/tasks?priority=high",
      "Tarefas com tags específicas": "/api/tasks?tags=javascript,programming",
      "Tarefas criadas hoje": "/api/tasks?dateFrom=2025-08-19",
      "Busca por texto": "/api/tasks?search=reunião",
      "Filtros combinados": "/api/tasks?category=work&priority=high&completed=false&page=1&limit=5"
    }
  }
}
```

#### Criar Tarefas de Exemplo (Para Testes)
```http
POST /api/tasks/test/create-samples
```

**Resposta:**
```json
{
  "success": true,
  "message": "5 tarefas de exemplo criadas com sucesso",
  "data": [
    // Array com 5 tarefas de exemplo com diferentes categorias, tags e datas
  ]
}
```

---

### Usuários

#### Listar Usuários
```http
GET /api/users
```

#### Buscar Usuário por ID
```http
GET /api/users/{id}
```

#### Atualizar Usuário
```http
PUT /api/users/{id}
```

#### Deletar Usuário
```http
DELETE /api/users/{id}
```

---

### Sistema e Monitoramento

#### Health Check
```http
GET /health
```

**Resposta:**
```json
{
  "status": "OK",
  "timestamp": "2025-08-19T21:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

#### Estatísticas do Cache
```http
GET /api/tasks/cache/stats
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "cache": {
      "hits": 45,
      "misses": 12,
      "keys": 8,
      "hitRate": "78.95%"
    },
    "info": {
      "description": "Cache em memória para consultas frequentes",
      "ttl": {
        "tasks": "3 minutos",
        "task-detail": "5 minutos",
        "stats": "2 minutos"
      }
    }
  }
}
```

#### Estatísticas de Logs
```http
GET /api/logs/stats
```

#### Gerar Log de Teste
```http
POST /api/logs/test/{level}
```

Onde `{level}` pode ser: `error`, `warn`, `info`, `debug`

---

## Sistema de Cache

### Estratégia de Cache

| Endpoint | TTL | Invalidação |
|----------|-----|-------------|
| `GET /api/tasks` | 3 minutos | Ao criar/atualizar/deletar tarefa |
| `GET /api/tasks/{id}` | 5 minutos | Ao atualizar/deletar tarefa específica |
| `GET /api/tasks/stats` | 2 minutos | Ao modificar qualquer tarefa |

### Headers de Cache

```http
X-Cache-Status: HIT | MISS
X-Cache-Key: tasks:user:123:page:1:limit:10
```

---

## Sistema de Logs

### Estrutura dos Logs

```json
{
  "timestamp": "2025-08-19T21:00:00.000Z",
  "level": "INFO",
  "message": "Tasks list requested with advanced filters",
  "requestId": "abc123",
  "userId": "user-uuid",
  "filters": { "category": "work", "priority": "high" },
  "pid": 12345,
  "hostname": "server-name"
}
```

### Níveis de Log

- **ERROR**: Erros do sistema (salvos em arquivo)
- **WARN**: Avisos importantes (salvos em arquivo)
- **INFO**: Informações gerais (salvos em arquivo)
- **DEBUG**: Informações de debug (apenas console)

### Arquivos de Log

```
logs/
├── 2025-08-19-error.log    # Apenas erros
├── 2025-08-19-warn.log     # Avisos e erros
└── 2025-08-19-info.log     # Todas as informações
```

---

## Filtros Avançados - Guia Completo

### Combinações de Filtros

```bash
# 1. Filtros básicos
GET /api/tasks?page=1&limit=5
GET /api/tasks?completed=false
GET /api/tasks?priority=high

# 2. Filtros por categoria e tags
GET /api/tasks?category=work
GET /api/tasks?tags=javascript,programming
GET /api/tasks?category=study&tags=javascript

# 3. Filtros por data
GET /api/tasks?dateFrom=2025-08-19                    # Criadas hoje ou depois
GET /api/tasks?dateTo=2025-08-20                      # Criadas até 20/08
GET /api/tasks?dateFrom=2025-08-19&dateTo=2025-08-20  # Criadas entre 19 e 20

# 4. Filtros por data de vencimento
GET /api/tasks?dueDateFrom=2025-08-25                 # Vencem a partir de 25/08
GET /api/tasks?dueDateTo=2025-08-30                   # Vencem até 30/08

# 5. Busca por texto
GET /api/tasks?search=reunião                         # Busca "reunião" no título/descrição
GET /api/tasks?search=javascript&category=study       # Busca + categoria

# 6. Filtros ultra-combinados
GET /api/tasks?category=work&priority=high&completed=false&tags=urgent,meeting&dueDateFrom=2025-08-25&dueDateTo=2025-08-30&page=1&limit=5
```

### Valores Aceitos

#### Priority
- `low` - Baixa prioridade
- `medium` - Média prioridade
- `high` - Alta prioridade

#### Category
- `general` - Geral
- `work` - Trabalho
- `personal` - Pessoal
- `study` - Estudos
- `health` - Saúde
- `finance` - Finanças
- `shopping` - Compras

#### Completed
- `true` - Tarefas concluídas
- `false` - Tarefas pendentes

#### Datas
- Formato: ISO 8601 (`YYYY-MM-DD` ou `YYYY-MM-DDTHH:mm:ss.sssZ`)
- Exemplos: `2025-08-19`, `2025-08-19T21:00:00.000Z`

---

## Códigos de Status HTTP

| Código | Descrição |
|--------|-----------|
| `200` | Sucesso |
| `201` | Criado com sucesso |
| `400` | Dados inválidos |
| `401` | Não autorizado (token inválido/ausente) |
| `404` | Recurso não encontrado |
| `500` | Erro interno do servidor |

---

## Estrutura de Resposta Padrão

### Sucesso
```json
{
  "success": true,
  "message": "Operação realizada com sucesso",
  "data": { /* dados retornados */ }
}
```

### Erro
```json
{
  "success": false,
  "message": "Descrição do erro",
  "errors": ["Lista de erros específicos"] // opcional
}
```

---

## Exemplos de Teste com cURL

### Fluxo Completo de Teste

```bash
# 1. Registrar usuário
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@example.com",
    "username": "testuser",
    "password": "123456",
    "firstName": "Teste",
    "lastName": "Usuario"
  }'

# 2. Fazer login e obter token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "testuser",
    "password": "123456"
  }'

# 3. Criar tarefas de exemplo (substitua TOKEN pelo token obtido)
curl -X POST http://localhost:3000/api/tasks/test/create-samples \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN"

# 4. Listar todas as tarefas
curl -X GET http://localhost:3000/api/tasks \
  -H "Authorization: Bearer TOKEN"

# 5. Filtrar tarefas de trabalho
curl -X GET "http://localhost:3000/api/tasks?category=work" \
  -H "Authorization: Bearer TOKEN"

# 6. Buscar tarefas com tags específicas
curl -X GET "http://localhost:3000/api/tasks?tags=javascript,programming" \
  -H "Authorization: Bearer TOKEN"

# 7. Criar nova tarefa
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "title": "Minha Nova Tarefa",
    "description": "Descrição detalhada",
    "priority": "high",
    "category": "work",
    "tags": ["importante", "urgente"],
    "dueDate": "2025-08-25T10:00:00.000Z"
  }'

# 8. Ver estatísticas
curl -X GET http://localhost:3000/api/tasks/stats \
  -H "Authorization: Bearer TOKEN"
```

