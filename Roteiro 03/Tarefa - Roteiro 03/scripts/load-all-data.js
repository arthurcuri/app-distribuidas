#!/usr/bin/env node
// scripts/load-all-data.js
const path = require('path');
const DataLoaders = require('../shared/dataLoaders');

async function main() {
    console.log('=== Data Loader - Todos os Serviços ===');
    try {
        // Carregar dados para cada serviço em seu diretório correspondente
        
        // User Service
        process.chdir(path.join(__dirname, '../services/user-service'));
        await DataLoaders.loadUserData();
        
        // Item/Product Service  
        process.chdir(path.join(__dirname, '../services/product-service'));
        await DataLoaders.loadItemData();
        
        // List Service
        process.chdir(path.join(__dirname, '../services/list-service'));
        await DataLoaders.loadListData();
        
        // API Gateway
        process.chdir(path.join(__dirname, '../api-gateway'));
        await DataLoaders.loadGatewayData();
        
        console.log('✓ Todos os dados foram carregados com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('✗ Erro ao carregar dados:', error);
        process.exit(1);
    }
}

main();