#!/usr/bin/env node
// scripts/load-user-data.js
const path = require('path');
const DataLoaders = require('../shared/dataLoaders');

// Ajustar path para o diretório do user-service
process.chdir(path.join(__dirname, '../services/user-service'));

async function main() {
    console.log('=== Data Loader - User Service ===');
    try {
        await DataLoaders.loadUserData();
        console.log('✓ Dados do User Service carregados com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('✗ Erro ao carregar dados do User Service:', error);
        process.exit(1);
    }
}

main();