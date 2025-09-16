#!/usr/bin/env node
// scripts/clear-all-data.js
const path = require('path');
const DataLoaders = require('../shared/dataLoaders');

async function main() {
    console.log('=== Limpeza de Dados - Todos os Serviços ===');
    try {
        // User Service
        process.chdir(path.join(__dirname, '../services/user-service'));
        await clearServiceData('users');
        
        // Item/Product Service  
        process.chdir(path.join(__dirname, '../services/product-service'));
        await clearServiceData('items');
        
        // List Service
        process.chdir(path.join(__dirname, '../services/list-service'));
        await clearServiceData('lists');
        
        console.log('✓ Todos os dados foram limpos com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('✗ Erro ao limpar dados:', error);
        process.exit(1);
    }
}

async function clearServiceData(collection) {
    const JsonDatabase = require('../shared/JsonDatabase');
    try {
        const db = new JsonDatabase('./database', collection);
        const items = await db.find();
        for (const item of items) {
            await db.delete(item.id);
        }
        console.log(`✓ ${collection}: ${items.length} registros removidos`);
    } catch (error) {
        console.error(`✗ Erro ao limpar ${collection}:`, error);
    }
}

main();