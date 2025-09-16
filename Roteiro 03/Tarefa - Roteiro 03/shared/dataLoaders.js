// shared/dataLoaders.js
const JsonDatabase = require('./JsonDatabase');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

class DataLoaders {
    // User Service Data Loader
    static async loadUserData() {
        console.log('Carregando dados iniciais do User Service...');
        const db = new JsonDatabase('./database', 'users');
        
        try {
            const existingUsers = await db.find();
            if (existingUsers.length > 0) {
                console.log(`User Service já possui ${existingUsers.length} usuários.`);
                return;
            }

            const sampleUsers = [
                {
                    email: 'admin@exemplo.com',
                    username: 'admin',
                    password: await bcrypt.hash('123456', 10),
                    firstName: 'Administrador',
                    lastName: 'Sistema',
                    preferences: {
                        defaultStore: 'Supermercado Central',
                        currency: 'BRL'
                    }
                },
                {
                    email: 'joao@exemplo.com',
                    username: 'joao.silva',
                    password: await bcrypt.hash('senha123', 10),
                    firstName: 'João',
                    lastName: 'Silva',
                    preferences: {
                        defaultStore: 'Extra',
                        currency: 'BRL'
                    }
                },
                {
                    email: 'maria@exemplo.com',
                    username: 'maria.santos',
                    password: await bcrypt.hash('maria456', 10),
                    firstName: 'Maria',
                    lastName: 'Santos',
                    preferences: {
                        defaultStore: 'Carrefour',
                        currency: 'BRL'
                    }
                }
            ];

            for (const userData of sampleUsers) {
                await db.create(userData);
            }
            
            console.log(`User Service: ${sampleUsers.length} usuários criados com sucesso.`);
        } catch (error) {
            console.error('Erro ao carregar dados do User Service:', error);
        }
    }

    // Item Service Data Loader
    static async loadItemData() {
        console.log('Carregando dados iniciais do Item Service...');
        const db = new JsonDatabase('./database', 'items');
        
        try {
            const existingItems = await db.find();
            if (existingItems.length > 0) {
                console.log(`Item Service já possui ${existingItems.length} itens.`);
                return;
            }

            const sampleItems = [
                // Alimentos
                {
                    name: 'Arroz Branco',
                    category: 'Alimentos',
                    brand: 'Tio João',
                    unit: 'kg',
                    averagePrice: 4.50,
                    barcode: '7891234567890',
                    description: 'Arroz branco tipo 1, pacote de 1kg',
                    active: true
                },
                {
                    name: 'Feijão Preto',
                    category: 'Alimentos',
                    brand: 'Kicaldo',
                    unit: 'kg',
                    averagePrice: 6.20,
                    barcode: '7891234567891',
                    description: 'Feijão preto tipo 1, pacote de 1kg',
                    active: true
                },
                {
                    name: 'Açúcar Cristal',
                    category: 'Alimentos',
                    brand: 'União',
                    unit: 'kg',
                    averagePrice: 3.80,
                    barcode: '7891234567892',
                    description: 'Açúcar cristal, pacote de 1kg',
                    active: true
                },
                {
                    name: 'Óleo de Soja',
                    category: 'Alimentos',
                    brand: 'Soya',
                    unit: 'litro',
                    averagePrice: 5.90,
                    barcode: '7891234567893',
                    description: 'Óleo de soja refinado, garrafa de 900ml',
                    active: true
                },
                {
                    name: 'Macarrão Espaguete',
                    category: 'Alimentos',
                    brand: 'Barilla',
                    unit: 'un',
                    averagePrice: 4.20,
                    barcode: '7891234567894',
                    description: 'Macarrão espaguete, pacote de 500g',
                    active: true
                },
                
                // Limpeza
                {
                    name: 'Detergente Líquido',
                    category: 'Limpeza',
                    brand: 'Ypê',
                    unit: 'un',
                    averagePrice: 2.50,
                    barcode: '7891234567895',
                    description: 'Detergente líquido neutro, frasco de 500ml',
                    active: true
                },
                {
                    name: 'Sabão em Pó',
                    category: 'Limpeza',
                    brand: 'OMO',
                    unit: 'un',
                    averagePrice: 12.90,
                    barcode: '7891234567896',
                    description: 'Sabão em pó multiação, caixa de 1kg',
                    active: true
                },
                {
                    name: 'Desinfetante',
                    category: 'Limpeza',
                    brand: 'Pinho Sol',
                    unit: 'un',
                    averagePrice: 4.80,
                    barcode: '7891234567897',
                    description: 'Desinfetante original, frasco de 500ml',
                    active: true
                },
                {
                    name: 'Papel Higiênico',
                    category: 'Limpeza',
                    brand: 'Personal',
                    unit: 'un',
                    averagePrice: 8.90,
                    barcode: '7891234567898',
                    description: 'Papel higiênico folha dupla, pacote com 4 rolos',
                    active: true
                },
                
                // Higiene
                {
                    name: 'Shampoo',
                    category: 'Higiene',
                    brand: 'Pantene',
                    unit: 'un',
                    averagePrice: 9.50,
                    barcode: '7891234567899',
                    description: 'Shampoo hidratação, frasco de 400ml',
                    active: true
                },
                {
                    name: 'Sabonete',
                    category: 'Higiene',
                    brand: 'Dove',
                    unit: 'un',
                    averagePrice: 3.20,
                    barcode: '7891234567800',
                    description: 'Sabonete hidratante, barra de 90g',
                    active: true
                },
                {
                    name: 'Creme Dental',
                    category: 'Higiene',
                    brand: 'Colgate',
                    unit: 'un',
                    averagePrice: 4.50,
                    barcode: '7891234567801',
                    description: 'Creme dental total 12, tubo de 90g',
                    active: true
                },
                {
                    name: 'Desodorante',
                    category: 'Higiene',
                    brand: 'Rexona',
                    unit: 'un',
                    averagePrice: 7.90,
                    barcode: '7891234567802',
                    description: 'Desodorante aerosol masculino, frasco de 150ml',
                    active: true
                },
                
                // Bebidas
                {
                    name: 'Refrigerante Cola',
                    category: 'Bebidas',
                    brand: 'Coca-Cola',
                    unit: 'litro',
                    averagePrice: 6.50,
                    barcode: '7891234567803',
                    description: 'Refrigerante de cola, garrafa de 2 litros',
                    active: true
                },
                {
                    name: 'Suco de Laranja',
                    category: 'Bebidas',
                    brand: 'Del Valle',
                    unit: 'litro',
                    averagePrice: 4.20,
                    barcode: '7891234567804',
                    description: 'Suco de laranja integral, caixa de 1 litro',
                    active: true
                },
                {
                    name: 'Água Mineral',
                    category: 'Bebidas',
                    brand: 'Crystal',
                    unit: 'litro',
                    averagePrice: 2.80,
                    barcode: '7891234567805',
                    description: 'Água mineral sem gás, garrafa de 1,5 litros',
                    active: true
                },
                {
                    name: 'Cerveja',
                    category: 'Bebidas',
                    brand: 'Skol',
                    unit: 'un',
                    averagePrice: 3.50,
                    barcode: '7891234567806',
                    description: 'Cerveja pilsen, lata de 350ml',
                    active: true
                },
                
                // Padaria
                {
                    name: 'Pão de Forma',
                    category: 'Padaria',
                    brand: 'Wickbold',
                    unit: 'un',
                    averagePrice: 5.80,
                    barcode: '7891234567807',
                    description: 'Pão de forma integral, pacote de 500g',
                    active: true
                },
                {
                    name: 'Pão Francês',
                    category: 'Padaria',
                    brand: 'Padaria Local',
                    unit: 'kg',
                    averagePrice: 8.50,
                    barcode: '7891234567808',
                    description: 'Pão francês tradicional, vendido por kg',
                    active: true
                },
                {
                    name: 'Bolo de Chocolate',
                    category: 'Padaria',
                    brand: 'Ana Maria',
                    unit: 'un',
                    averagePrice: 12.90,
                    barcode: '7891234567809',
                    description: 'Bolo de chocolate com cobertura, 400g',
                    active: true
                }
            ];

            for (const itemData of sampleItems) {
                await db.create(itemData);
            }
            
            console.log(`Item Service: ${sampleItems.length} itens criados com sucesso.`);
        } catch (error) {
            console.error('Erro ao carregar dados do Item Service:', error);
        }
    }

    // List Service Data Loader  
    static async loadListData() {
        console.log('Carregando dados iniciais do List Service...');
        const db = new JsonDatabase('./database', 'lists');
        
        try {
            const existingLists = await db.find();
            if (existingLists.length > 0) {
                console.log(`List Service já possui ${existingLists.length} listas.`);
                return;
            }

            // Para demonstração, vamos criar algumas listas de exemplo
            // Em produção, as listas seriam criadas pelos usuários
            const sampleLists = [
                {
                    userId: 'user-demo-1', // ID fictício para demonstração
                    name: 'Lista de Compras da Semana',
                    description: 'Lista básica para compras semanais',
                    status: 'active',
                    items: [
                        {
                            itemId: 'item-1',
                            itemName: 'Arroz Branco',
                            quantity: 2,
                            unit: 'kg',
                            estimatedPrice: 9.00,
                            purchased: false,
                            notes: 'Marca Tio João preferencial',
                            addedAt: new Date().toISOString()
                        },
                        {
                            itemId: 'item-2',
                            itemName: 'Feijão Preto',
                            quantity: 1,
                            unit: 'kg',
                            estimatedPrice: 6.20,
                            purchased: false,
                            notes: '',
                            addedAt: new Date().toISOString()
                        }
                    ],
                    summary: {
                        totalItems: 2,
                        purchasedItems: 0,
                        estimatedTotal: 15.20
                    }
                }
            ];

            for (const listData of sampleLists) {
                await db.create(listData);
            }
            
            console.log(`List Service: ${sampleLists.length} listas criadas com sucesso.`);
        } catch (error) {
            console.error('Erro ao carregar dados do List Service:', error);
        }
    }

    // API Gateway Data Loader (configurações e cache inicial)
    static async loadGatewayData() {
        console.log('Carregando configurações iniciais do API Gateway...');
        
        try {
            // Configurações do circuit breaker
            const circuitBreakerConfig = {
                failureThreshold: 3,
                recoveryTimeout: 30000,
                timeout: 5000
            };

            // Cache de rotas
            const routeConfig = {
                '/api/auth': 'user-service',
                '/api/users': 'user-service',
                '/api/items': 'item-service',
                '/api/lists': 'list-service'
            };

            console.log('API Gateway: Configurações carregadas com sucesso.');
            console.log('- Circuit Breaker configurado');
            console.log('- Rotas mapeadas para os serviços');
            
            return { circuitBreakerConfig, routeConfig };
        } catch (error) {
            console.error('Erro ao carregar configurações do API Gateway:', error);
        }
    }

    // Carregar todos os dados
    static async loadAllData() {
        console.log('=== Iniciando carregamento de dados iniciais ===');
        
        await this.loadUserData();
        await this.loadItemData();
        await this.loadListData();
        await this.loadGatewayData();
        
        console.log('=== Carregamento de dados concluído ===');
    }

    // Limpar todos os dados (útil para desenvolvimento)
    static async clearAllData() {
        console.log('Limpando todos os dados...');
        
        const databases = ['users', 'items', 'lists'];
        
        for (const dbName of databases) {
            try {
                const db = new JsonDatabase('./database', dbName);
                const items = await db.find();
                for (const item of items) {
                    await db.delete(item.id);
                }
                console.log(`${dbName}: Dados limpos`);
            } catch (error) {
                console.error(`Erro ao limpar ${dbName}:`, error);
            }
        }
        
        console.log('Limpeza concluída.');
    }
}

module.exports = DataLoaders;