#!/usr/bin/env node
// scripts/load-list-data.js
const path = require('path');
const DataLoaders = require('../shared/dataLoaders');

// Ajustar path para o diretório do list-service
process.chdir(path.join(__dirname, '../services/list-service'));

async function main() {
    console.log('=== Data Loader - List Service ===');
    try {
        await DataLoaders.loadListData();
        console.log('✓ Dados do List Service carregados com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('✗ Erro ao carregar dados do List Service:', error);
        process.exit(1);
    }
}

main();