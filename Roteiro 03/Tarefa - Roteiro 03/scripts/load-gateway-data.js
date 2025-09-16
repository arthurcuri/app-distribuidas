#!/usr/bin/env node
// scripts/load-gateway-data.js
const path = require('path');
const DataLoaders = require('../shared/dataLoaders');

// Ajustar path para o diretório do api-gateway
process.chdir(path.join(__dirname, '../api-gateway'));

async function main() {
    console.log('=== Data Loader - API Gateway ===');
    try {
        await DataLoaders.loadGatewayData();
        console.log('✓ Configurações do API Gateway carregadas com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('✗ Erro ao carregar configurações do API Gateway:', error);
        process.exit(1);
    }
}

main();