const fs = require('fs');
const path = require('path');

// Script para resetar todos os bancos de dados e registry

function resetDatabase(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ Removido: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Erro ao remover ${filePath}:`, error.message);
  }
}

function resetDatabases() {
  console.log('🔄 Resetando todos os bancos de dados...\n');

  // Caminhos dos bancos de dados
  const dbPaths = [
    // User Service
    'services/user-service/database/users.json',
    'services/user-service/database/users_index.json',
    
    // Item Service  
    'services/item-service/database/items.json',
    'services/item-service/database/items_index.json',
    
    // List Service
    'services/list-service/database/lists.json',
    'services/list-service/database/lists_index.json',
    
    // Service Registry
    'shared/services-registry.json'
  ];

  dbPaths.forEach(dbPath => {
    const fullPath = path.join(__dirname, dbPath);
    resetDatabase(fullPath);
  });

  console.log('\n🎉 Reset concluído! Todos os bancos foram limpos.');
  console.log('ℹ️ Os dados de exemplo serão recriados quando os serviços forem iniciados.');
}

// Executa se chamado diretamente
if (require.main === module) {
  resetDatabases();
}

module.exports = { resetDatabases };