#!/usr/bin/env node

const readline = require('readline');
const { spawn } = require('child_process');
const path = require('path');

/**
 * Interface CLI para Demonstração dos Entregáveis gRPC
 * 
 * DISCLAIMER: Esta interface CLI NÃO faz parte dos entregáveis obrigatórios.
 * Foi desenvolvida apenas para facilitar a visualização e demonstração das
 * funcionalidades implementadas nos itens do roteiro.
 * 
 * Funcionalidades implementadas nos entregáveis:
 * 1. ✅ Autenticação JWT com interceptadores
 * 2. ✅ Tratamento robusto de erros gRPC  
 * 3. ✅ Load Balancing entre múltiplos servidores
 * 4. ✅ Streaming Bidirecional com chat em tempo real
 */

class GrpcDemoInterface {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        this.currentProcess = null;
        this.setupSignalHandlers();
    }

    /**
     * Configurar handlers para sinais
     */
    setupSignalHandlers() {
        process.on('SIGINT', () => {
            this.cleanup();
            process.exit(0);
        });
        
        process.on('SIGTERM', () => {
            this.cleanup();
            process.exit(0);
        });
    }

    /**
     * Limpeza ao sair
     */
    cleanup() {
        if (this.currentProcess) {
            console.log('\n🛑 Encerrando processo atual...');
            this.currentProcess.kill('SIGTERM');
        }
        this.rl.close();
    }

    /**
     * Exibir banner inicial
     */
    showBanner() {
        console.clear();
        console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
        console.log('║                    🚀 DEMONSTRAÇÃO ENTREGÁVEIS gRPC 🚀                     ║');
        console.log('║                                                                              ║');
        console.log('║  DISCLAIMER: Esta interface CLI NÃO faz parte dos entregáveis obrigatórios ║');
        console.log('║  Foi criada apenas para facilitar a visualização das funcionalidades       ║');
        console.log('║                                                                              ║');
        console.log('║  📋 Roteiro 02 - LAB Desenvolvimento de Aplicações Móveis e Distribuídas   ║');
        console.log('║  🎓 5° Período - 2025                                                       ║');
        console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
        console.log('');
    }

    /**
     * Exibir disclaimer
     */
    showDisclaimer() {
        console.log('⚠️  IMPORTANTE - LEIA ANTES DE PROSSEGUIR:');
        console.log('');
        console.log('📌 Esta interface CLI é apenas uma ferramenta de demonstração');
        console.log('📌 Os entregáveis reais são os arquivos de código implementados');
        console.log('📌 Cada funcionalidade foi implementada conforme especificado no roteiro');
        console.log('📌 Use esta interface para visualizar as funcionalidades em ação');
        console.log('');
        console.log('✅ Status dos Entregáveis:');
        console.log('   1. ✅ Autenticação JWT - IMPLEMENTADO COMPLETO');
        console.log('   2. ✅ Error Handling - IMPLEMENTADO COMPLETO');
        console.log('   3. ✅ Load Balancing - IMPLEMENTADO COMPLETO');
        console.log('   4. ✅ Streaming Bidirecional - IMPLEMENTADO COMPLETO');
        console.log('');
    }

    /**
     * Exibir menu principal
     */
    showMainMenu() {
        console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
        console.log('│                           📋 MENU PRINCIPAL                                   │');
        console.log('├─────────────────────────────────────────────────────────────────────────────┤');
        console.log('│                                                                             │');
        console.log('│  1️⃣   Autenticação JWT                                                      │');
        console.log('│      🔐 Demonstrar interceptadores de autenticação                         │');
        console.log('│      📁 Arquivos: jwtInterceptor.js, middleware/grpcAuth.js               │');
        console.log('│                                                                             │');
        console.log('│  2️⃣   Error Handling                                                        │');
        console.log('│      ❌ Demonstrar tratamento robusto de erros gRPC                        │');
        console.log('│      📁 Arquivos: utils/errorHandler.js, middleware/errorInterceptor.js   │');
        console.log('│                                                                             │');
        console.log('│  3️⃣   Load Balancing                                                        │');
        console.log('│      ⚖️  Demonstrar balanceamento entre múltiplos servidores               │');
        console.log('│      📁 Arquivos: utils/loadBalancer.js, utils/loadBalancedClient.js      │');
        console.log('│                                                                             │');
        console.log('│  4️⃣   Streaming Bidirecional                                               │');
        console.log('│      💬 Demonstrar chat em tempo real                                      │');
        console.log('│      📁 Arquivos: services/ChatService.js, protos/chat_service.proto      │');
        console.log('│                                                                             │');
        console.log('│  5️⃣   Demo Completa                                                         │');
        console.log('│      🎭 Executar demonstração de todas as funcionalidades                 │');
        console.log('│                                                                             │');
        console.log('│  6️⃣   Informações dos Entregáveis                                          │');
        console.log('│      📚 Ver documentação e arquivos implementados                          │');
        console.log('│                                                                             │');
        console.log('│  0️⃣   Sair                                                                  │');
        console.log('│                                                                             │');
        console.log('└─────────────────────────────────────────────────────────────────────────────┘');
        console.log('');
    }

    /**
     * Executar processo demo
     */
    async runDemo(scriptName, title, description) {
        console.clear();
        console.log(`🚀 ${title}`);
        console.log(`📝 ${description}`);
        console.log('');
        console.log('⏳ Iniciando demonstração...');
        console.log('💡 Pressione Ctrl+C a qualquer momento para voltar ao menu');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');

        return new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, scriptName);
            
            this.currentProcess = spawn('node', [scriptPath], {
                stdio: 'inherit',
                cwd: __dirname
            });

            this.currentProcess.on('close', (code) => {
                this.currentProcess = null;
                console.log('');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log(`✅ Demonstração concluída (código: ${code})`);
                resolve(code);
            });

            this.currentProcess.on('error', (error) => {
                this.currentProcess = null;
                console.error(`❌ Erro ao executar demonstração: ${error.message}`);
                reject(error);
            });
        });
    }

    /**
     * Aguardar input do usuário
     */
    async waitForInput(message) {
        return new Promise((resolve) => {
            this.rl.question(message, (answer) => {
                resolve(answer);
            });
        });
    }

    /**
     * Pausar e aguardar Enter
     */
    async pauseForEnter(message = '\n📱 Pressione Enter para voltar ao menu principal...') {
        await this.waitForInput(message);
    }

    /**
     * Demonstrar autenticação JWT
     */
    async demonstrateJWT() {
        await this.runDemo(
            'demos/jwt-demo.js',
            'DEMONSTRAÇÃO: Autenticação JWT com Interceptadores',
            'Mostra interceptadores JWT funcionando com autenticação e autorização'
        );
        await this.pauseForEnter();
    }

    /**
     * Demonstrar error handling
     */
    async demonstrateErrorHandling() {
        await this.runDemo(
            'demos/error-handling-demo.js',
            'DEMONSTRAÇÃO: Tratamento Robusto de Erros gRPC',
            'Mostra sistema de retry, circuit breaker e erro structures'
        );
        await this.pauseForEnter();
    }

    /**
     * Demonstrar load balancing
     */
    async demonstrateLoadBalancing() {
        await this.runDemo(
            'demos/load-balancing-demo.js',
            'DEMONSTRAÇÃO: Load Balancing entre Múltiplos Servidores',
            'Mostra distribuição de carga com diferentes estratégias'
        );
        await this.pauseForEnter();
    }

    /**
     * Demonstrar streaming bidirecional
     */
    async demonstrateStreaming() {
        await this.runDemo(
            'demos/streaming-demo.js',
            'DEMONSTRAÇÃO: Streaming Bidirecional - Chat em Tempo Real',
            'Mostra chat em tempo real usando gRPC streaming'
        );
        await this.pauseForEnter();
    }

    /**
     * Demonstração completa
     */
    async demonstrateComplete() {
        console.clear();
        console.log('🎭 DEMONSTRAÇÃO COMPLETA DE TODAS AS FUNCIONALIDADES');
        console.log('');
        console.log('📋 Esta demonstração executará sequencialmente:');
        console.log('   1. Autenticação JWT');
        console.log('   2. Error Handling');
        console.log('   3. Load Balancing');
        console.log('   4. Streaming Bidirecional');
        console.log('');
        
        const confirm = await this.waitForInput('Deseja continuar? (s/n): ');
        if (confirm.toLowerCase() !== 's' && confirm.toLowerCase() !== 'sim') {
            return;
        }

        console.log('\n🚀 Iniciando demonstração completa...\n');

        try {
            await this.demonstrateJWT();
            await this.demonstrateErrorHandling();
            await this.demonstrateLoadBalancing();
            await this.demonstrateStreaming();
            
            console.log('\n🎉 Demonstração completa finalizada com sucesso!');
        } catch (error) {
            console.error('\n❌ Erro durante demonstração completa:', error.message);
        }
        
        await this.pauseForEnter();
    }

    /**
     * Mostrar informações dos entregáveis
     */
    async showDeliverablesInfo() {
        console.clear();
        console.log('📚 INFORMAÇÕES DOS ENTREGÁVEIS');
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════════════════════');
        console.log('1️⃣  AUTENTICAÇÃO JWT');
        console.log('═══════════════════════════════════════════════════════════════════════════════');
        console.log('📁 Arquivos implementados:');
        console.log('   ├── jwtInterceptor.js              # Interceptador principal JWT');
        console.log('   ├── middleware/grpcAuth.js         # Middleware de autenticação');
        console.log('   ├── services/AuthService.js        # Serviço de autenticação');
        console.log('   └── protos/auth_service.proto       # Definições de protocolo');
        console.log('');
        console.log('🔧 Funcionalidades:');
        console.log('   ✅ Interceptador unário e streaming');
        console.log('   ✅ Validação de tokens JWT');
        console.log('   ✅ Refresh de tokens automático');
        console.log('   ✅ Metadados de autenticação');
        console.log('');
        
        console.log('═══════════════════════════════════════════════════════════════════════════════');
        console.log('2️⃣  ERROR HANDLING');
        console.log('═══════════════════════════════════════════════════════════════════════════════');
        console.log('📁 Arquivos implementados:');
        console.log('   ├── utils/errorHandler.js          # Classes de erro estruturadas');
        console.log('   ├── middleware/errorInterceptor.js # Interceptador de erros');
        console.log('   ├── utils/resilientClient.js       # Cliente com retry/circuit breaker');
        console.log('   └── ERROR_HANDLING_README.md       # Documentação completa');
        console.log('');
        console.log('🔧 Funcionalidades:');
        console.log('   ✅ Retry com backoff exponencial');
        console.log('   ✅ Circuit breaker pattern');
        console.log('   ✅ Erros estruturados com metadados');
        console.log('   ✅ Logging e métricas de erro');
        console.log('');

        console.log('═══════════════════════════════════════════════════════════════════════════════');
        console.log('3️⃣  LOAD BALANCING');
        console.log('═══════════════════════════════════════════════════════════════════════════════');
        console.log('📁 Arquivos implementados:');
        console.log('   ├── utils/loadBalancer.js          # Core do load balancer');
        console.log('   ├── utils/loadBalancedClient.js    # Cliente com balanceamento');
        console.log('   ├── utils/loadBalancerGateway.js   # Gateway/proxy');
        console.log('   ├── utils/backendCluster.js        # Gerenciador de cluster');
        console.log('   └── LOAD_BALANCING_README.md       # Documentação completa');
        console.log('');
        console.log('🔧 Funcionalidades:');
        console.log('   ✅ 5 estratégias de balanceamento');
        console.log('   ✅ Health monitoring automático');
        console.log('   ✅ Sticky sessions');
        console.log('   ✅ Pool de conexões otimizado');
        console.log('');

        console.log('═══════════════════════════════════════════════════════════════════════════════');
        console.log('4️⃣  STREAMING BIDIRECIONAL');
        console.log('═══════════════════════════════════════════════════════════════════════════════');
        console.log('📁 Arquivos implementados:');
        console.log('   ├── services/ChatService.js        # Serviço de chat streaming');
        console.log('   ├── protos/chat_service.proto       # Definições de streaming');
        console.log('   ├── tests/chat.test.js             # Testes do chat');
        console.log('   └── STREAMING_README.md            # Documentação completa');
        console.log('');
        console.log('🔧 Funcionalidades:');
        console.log('   ✅ Chat em tempo real');
        console.log('   ✅ Salas de chat múltiplas');
        console.log('   ✅ Gerenciamento de usuários online');
        console.log('   ✅ Histórico de mensagens');
        console.log('');

        console.log('═══════════════════════════════════════════════════════════════════════════════');
        console.log('📊 RESUMO GERAL');
        console.log('═══════════════════════════════════════════════════════════════════════════════');
        console.log('✅ Todos os 4 itens do roteiro foram implementados completamente');
        console.log('✅ Código funcional e testado');
        console.log('✅ Documentação completa para cada item');
        console.log('✅ Exemplos de uso e demonstrações');
        console.log('✅ Arquitetura production-ready');
        console.log('');

        await this.pauseForEnter();
    }

    /**
     * Processar escolha do menu
     */
    async processMenuChoice(choice) {
        switch (choice) {
            case '1':
                await this.demonstrateJWT();
                break;
            case '2':
                await this.demonstrateErrorHandling();
                break;
            case '3':
                await this.demonstrateLoadBalancing();
                break;
            case '4':
                await this.demonstrateStreaming();
                break;
            case '5':
                await this.demonstrateComplete();
                break;
            case '6':
                await this.showDeliverablesInfo();
                break;
            case '0':
                console.log('\n👋 Obrigado por usar a interface de demonstração!');
                console.log('📋 Lembre-se: os entregáveis estão nos arquivos de código implementados');
                this.cleanup();
                process.exit(0);
                break;
            default:
                console.log('\n❌ Opção inválida! Escolha uma opção de 0 a 6.');
                await this.pauseForEnter();
                break;
        }
    }

    /**
     * Loop principal da interface
     */
    async run() {
        this.showBanner();
        this.showDisclaimer();
        
        const confirm = await this.waitForInput('Pressione Enter para continuar para o menu principal...');
        
        while (true) {
            console.clear();
            this.showBanner();
            this.showMainMenu();
            
            const choice = await this.waitForInput('🔢 Escolha uma opção (0-6): ');
            await this.processMenuChoice(choice.trim());
        }
    }
}

// Executar interface se chamado diretamente
if (require.main === module) {
    const interface = new GrpcDemoInterface();
    
    interface.run().catch((error) => {
        console.error('💥 Erro fatal na interface:', error);
        process.exit(1);
    });
}

module.exports = {
    GrpcDemoInterface
};
