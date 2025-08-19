## **RESPOSTAS ÀS QUESTÕES ARQUITETURAIS**

### **1. ESCALABILIDADE: Como esta arquitetura se comportaria com 1000 usuários simultâneos?**

#### **Análise Atual:**
```javascript
// Configuração atual de rate limiting
rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 1000 // máximo 1000 requests por IP
}
```

#### **LIMITAÇÕES CRÍTICAS:**

**a) Banco de Dados (SQLite):**
- **Suporta:** ~100-500 usuários simultâneos
- **Falha com:** 1000+ usuários simultâneos
- **Problema:** SQLite é single-threaded, não suporta alta concorrência
- **Sintomas esperados:** Locks, timeouts, performance degradada

**b) Servidor Single-Thread:**
```javascript
// PROBLEMA: Apenas 1 instância rodando
app.listen(config.port, () => {
    console.log(`Servidor iniciado na porta ${config.port}`);
});
```

**c) Memória e CPU:**
- **Estimativa atual:** ~50-100MB para 100 usuários
- **Projeção 1000 usuários:** ~500MB-1GB (sem otimização)
- **CPU:** 100% de utilização em picos

### **2. DISPONIBILIDADE: Quais são os pontos de falha identificados?**

#### **PONTOS DE FALHA CRÍTICOS:**

**a) Single Point of Failure (SPOF):**
```
[Cliente] ← HTTP → [Servidor Node.js] ← [SQLite DB]
                        ↑
                   SPOF CRÍTICO
```

**b) Banco de Dados:**
- **Arquivo único:** `database/tasks.db`
- **Sem backup automático**
- **Sem replicação**
- **Corrupção = perda total**

**c) Servidor:**
- **Processo único:** Uma instância Node.js
- **Sem monitoramento:** Crashes não detectados
- **Sem restart automático**

**d) Dependências Externas:**
```javascript
// PROBLEMAS IDENTIFICADOS:
const jwt = require('jsonwebtoken');     // Sem fallback
const bcrypt = require('bcryptjs');      // Operação CPU-intensiva
const sqlite3 = require('sqlite3');     // Sem connection pooling
```

### **3. PERFORMANCE: Onde estão os possíveis gargalos do sistema?**

#### **GARGALOS IDENTIFICADOS:**

**a) Banco de Dados (75% dos problemas):**
```sql
-- PROBLEMA: Consultas sem índices
SELECT * FROM tasks WHERE userId = ? AND priority = ?;

-- PROBLEMA: N+1 Queries
-- Para cada usuário, busca suas tasks separadamente
```

**b) Autenticação JWT:**
```javascript
// PROBLEMA: Verificação JWT a cada request
const authMiddleware = (req, res, next) => {
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, config.jwtSecret); // CPU intensivo
    req.user = decoded;
    next();
};
```

**c) Processamento Síncrono:**
```javascript
// PROBLEMA: Operações bloqueantes
await bcrypt.hash(this.password, 12); // 100-200ms por hash
```

**d) Falta de Compressão:**
```javascript
// AUSENTE: Compressão de responses
app.use(bodyParser.json({ limit: '10mb' })); // Sem gzip
```

### **4. MANUTENÇÃO: Como seria o processo de atualização em produção?**

#### **PROBLEMAS ATUAIS:**

**a) Deployment Manual:**
- Sem CI/CD pipeline
- Downtime durante updates
- Rollback manual complexo

**b) Configuração Hardcoded:**
```javascript
// PROBLEMA: Configurações fixas no código
port: process.env.PORT || 3000,
jwtSecret: process.env.JWT_SECRET || 'seu-secret-aqui', // Secret fraco
```

**c) Migrações de DB:**
- Sem sistema de migrations
- Schema changes manuais
- Sem versionamento de DB

### **5. EVOLUÇÃO: Que mudanças seriam necessárias para suportar múltiplas regiões?**

#### **DESAFIOS MULTI-REGIÃO:**

**a) Latência Global:**
- Usuários distantes enfrentam alta latência
- Dados centralizados em uma região

**b) Sincronização de Dados:**
- SQLite não suporta replicação
- Conflitos de dados entre regiões

**c) Disponibilidade Regional:**
- Falha de uma região = indisponibilidade global
- Sem failover automático

#### **ARQUITETURA NECESSÁRIA:**

**a) Infraestrutura Global:**
- CDN para distribuição de conteúdo
- Load balancers regionais
- Database replication cross-region

**b) Sincronização de Dados:**
- Event-driven architecture
- Database clustering
- Conflict resolution strategies

**c) Monitoramento Global:**
- Health checks por região
- Failover automático
- Disaster recovery
