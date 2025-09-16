#!/usr/bin/env node
// scripts/load-item-data.js
const path = require('path');
const DataLoaders = require('../shared/dataLoaders');

// Ajustar path para o diretório do item-service
process.chdir(path.join(__dirname, '../services/product-service'));

async function main() {
    console.log('=== Data Loader - Item/Product Service ===');
    try {
        await DataLoaders.loadItemData();
        console.log('✓ Dados do Item Service carregados com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('✗ Erro ao carregar dados do Item Service:', error);
        process.exit(1);
    }
}

main();