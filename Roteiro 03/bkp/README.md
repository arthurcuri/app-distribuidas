# Sistema de Lista de Compras com Microsserviços

Sistema distribuído para gerenciamento de listas de compras utilizando arquitetura de microsserviços com API Gateway, Service Discovery e bancos NoSQL independentes.

## 📋 Funcionalidades

- **Gerenciamento de Usuários**: Registro, login, autenticação JWT
- **Catálogo de Itens**: CRUD de produtos com categorias e busca
- **Listas de Compras**: Criação e gerenciamento de listas personalizadas
- **Service Discovery**: Descoberta automática de serviços
- **Circuit Breaker**: Proteção contra falhas em cascata
- **Health Checks**: Monitoramento automático da saúde dos serviços

## 🏗️ Arquitetura

```
lista-compras-microservices/
├── api-gateway/           # Gateway (porta 3000)
├── services/
│   ├── user-service/      # Usuários (porta 3001)
│   ├── item-service/      # Catálogo (porta 3003)
│   └── list-service/      # Listas (porta 3002)
├── shared/
│   ├── JsonDatabase.js    # Banco NoSQL
│   └── serviceRegistry.js # Service Discovery
├── client-demo.js         # Cliente de demonstração
└── reset-services.js      # Script de reset
```

## 🚀 Instalação e Execução

### 1. Instalar Dependências
```bash
npm install
npm run install:all
```

### 2. Executar Serviços (em terminais separados)

**Terminal 1 - User Service:**
```bash
npm run start:user
```

**Terminal 2 - Item Service:**
```bash
npm run start:item
```

**Terminal 3 - List Service:**
```bash
npm run start:list
```

**Terminal 4 - API Gateway:**
```bash
npm run start:gateway
```

### 3. Testar o Sistema
```bash
# Terminal 5 - Executar demonstração
npm run demo
```

## 🔧 Verificação de Status

### Health Check
```bash
curl http://localhost:3000/health
```

### Registry de Serviços
```bash
curl http://localhost:3000/registry
```

### Status Detalhado
```bash
curl http://localhost:3000/api/status
```

## 📡 Endpoints da API

### Autenticação
- `POST /api/auth/register` - Registro de usuário
- `POST /api/auth/login` - Login

### Usuários
- `GET /api/users/:id` - Dados do usuário
- `PUT /api/users/:id` - Atualizar perfil

### Itens
- `GET /api/items` - Listar itens
- `GET /api/items/:id` - Buscar item
- `POST /api/items` - Criar item
- `PUT /api/items/:id` - Atualizar item
- `GET /api/categories` - Listar categorias
- `GET /api/search?q=termo` - Buscar itens

### Listas
- `POST /api/lists` - Criar lista
- `GET /api/lists` - Listar listas do usuário
- `GET /api/lists/:id` - Buscar lista
- `PUT /api/lists/:id` - Atualizar lista
- `DELETE /api/lists/:id` - Deletar lista
- `POST /api/lists/:id/items` - Adicionar item à lista
- `PUT /api/lists/:id/items/:itemId` - Atualizar item na lista
- `DELETE /api/lists/:id/items/:itemId` - Remover item da lista
- `GET /api/lists/:id/summary` - Resumo da lista

### Agregados
- `GET /api/dashboard` - Dashboard do usuário
- `GET /api/search?type=global&q=termo` - Busca global

## 🗃️ Estrutura dos Dados

### Usuário
```json
{
  "id": "uuid",
  "email": "usuario@email.com",
  "username": "usuario",
  "firstName": "Nome",
  "lastName": "Sobrenome",
  "preferences": {
    "defaultStore": "Supermercado",
    "currency": "BRL"
  }
}
```

### Item
```json
{
  "id": "uuid",
  "name": "Arroz Branco",
  "category": "Alimentos",
  "brand": "Marca",
  "unit": "kg",
  "averagePrice": 4.50,
  "barcode": "7891234567890",
  "description": "Descrição do produto",
  "active": true
}
```

### Lista
```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Compras da Semana",
  "description": "Descrição",
  "status": "active",
  "items": [
    {
      "itemId": "uuid",
      "itemName": "Arroz Branco",
      "quantity": 2,
      "unit": "kg",
      "estimatedPrice": 4.50,
      "purchased": false,
      "notes": "Observações"
    }
  ],
  "summary": {
    "totalItems": 5,
    "purchasedItems": 2,
    "estimatedTotal": 25.40
  }
}
```

## 🧪 Exemplo de Uso

### 1. Registrar Usuário
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@email.com",
    "username": "teste",
    "password": "senha123",
    "firstName": "João",
    "lastName": "Silva"
  }'
```

### 2. Fazer Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@email.com",
    "password": "senha123"
  }'
```

### 3. Buscar Itens
```bash
curl http://localhost:3000/api/items?category=Alimentos
```

### 4. Criar Lista
```bash
curl -X POST http://localhost:3000/api/lists \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "name": "Compras da Semana",
    "description": "Lista semanal"
  }'
```

## 🔄 Resetar Sistema

Para limpar todos os dados e começar do zero:
```bash
node reset-services.js
```

## 🏥 Monitoramento

### Service Registry
O sistema utiliza um registro de serviços baseado em arquivo que:
- Registra automaticamente todos os serviços
- Realiza health checks a cada 30 segundos
- Remove serviços inativos automaticamente
- Persiste o estado em `shared/services-registry.json`

### Circuit Breaker
Cada serviço possui um circuit breaker que:
- Abre após 3 falhas consecutivas
- Fica aberto por 60 segundos
- Tenta reestabelecer conexão automaticamente

### Health Checks
Todos os serviços expõem um endpoint `/health` que retorna:
- Status do serviço
- Tempo de atividade
- Timestamp da verificação

## 🛠️ Solução de Problemas

### Serviços não se conectam
1. Verifique se todos os serviços estão rodando
2. Verifique o arquivo `shared/services-registry.json`
3. Execute `curl http://localhost:3000/registry`

### Dados inconsistentes
1. Execute `node reset-services.js`
2. Reinicie todos os serviços
3. Execute novamente a demonstração

### Circuit breaker ativo
1. Verifique `curl http://localhost:3000/health`
2. Aguarde 60 segundos para reset automático
3. Verifique logs dos serviços

## 📊 Demonstração

O arquivo `client-demo.js` executa um fluxo completo:

1. ✅ Verificação de saúde dos serviços
2. 🔐 Registro de usuário de teste
3. 🔑 Login e obtenção de token
4. 🔍 Exploração do catálogo de itens
5. 📝 Criação de lista de compras
6. 🛒 Adição de itens à lista
7. ✅ Marcação de itens como comprados
8. 📊 Visualização de resumos e dashboard
9. 🌍 Teste de busca global
10. 🏥 Verificação final de saúde

Execute com: `npm run demo`

## 🎯 Características Técnicas

- **Node.js + Express**: Framework web
- **JWT**: Autenticação stateless
- **bcrypt**: Hash seguro de senhas
- **Axios**: Cliente HTTP para comunicação
- **JSON Database**: Persistência baseada em arquivos
- **Service Discovery**: Registro automático de serviços
- **Circuit Breaker**: Proteção contra falhas
- **CORS**: Suporte a Cross-Origin

## 📝 Notas de Desenvolvimento

- Todos os dados são persistidos em arquivos JSON
- Service Registry é compartilhado entre todos os processos
- Circuit breakers protegem a comunicação entre serviços
- Health checks são executados automaticamente
- Logs estruturados facilitam debugging
- Sistema é tolerante a falhas de serviços individuais