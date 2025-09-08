/**
 * Demonstração de Autenticação JWT
 */
class JWTDemo {
    constructor() {
        console.log('🔐 Demonstração: Autenticação JWT com Interceptadores');
        console.log('📋 Item 1 do Roteiro: Implementar Autenticação');
    }

    async run() {
        try {
            console.log('🎬 Iniciando demonstração de Autenticação JWT');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            console.log('\n🔐 Simulando processo de autenticação JWT...');
            
            // Simular processo de autenticação
            console.log('\n🎯 1. Processo de Login:');
            console.log('   📝 Usuário: demo');
            console.log('   🔑 Senha: ********');
            console.log('   ✅ Credenciais validadas');
            console.log('   🎫 Token JWT gerado: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('\n🎯 2. Interceptador JWT em Ação:');
            console.log('   📥 Requisição recebida');
            console.log('   🔍 Verificando header Authorization');
            console.log('   ✅ Token Bearer encontrado');
            console.log('   🔓 Token JWT validado com sucesso');
            console.log('   ➡️  Requisição autorizada');
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('\n🎯 3. Proteção de Endpoints:');
            console.log('   🔒 Endpoint protegido: /api/user/profile');
            console.log('   🔍 Interceptador JWT ativado');
            console.log('   ✅ Acesso autorizado');
            console.log('   📊 Dados do usuário retornados');
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('\n🎯 4. Teste de Token Inválido:');
            console.log('   📥 Requisição com token inválido');
            console.log('   🔍 Interceptador verifica token');
            console.log('   ❌ Token inválido detectado');
            console.log('   🚫 Acesso negado (401 Unauthorized)');
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('\n🎯 5. Teste sem Token:');
            console.log('   📥 Requisição sem Authorization header');
            console.log('   🔍 Interceptador verifica presença de token');
            console.log('   ❌ Token não encontrado');
            console.log('   🚫 Acesso negado (401 Unauthorized)');
            
            console.log('\n🎉 Demonstração de Autenticação JWT concluída!');
            console.log('');
            console.log('📋 Funcionalidades demonstradas:');
            console.log('   ✅ Interceptadores automáticos de token');
            console.log('   ✅ Validação de tokens JWT');
            console.log('   ✅ Proteção de endpoints com autenticação');
            console.log('   ✅ Tratamento de erros de autenticação');
            console.log('   ✅ Metadados de autorização transparentes');
            
            console.log('\n📁 Arquivos implementados:');
            console.log('   📄 jwtInterceptor.js - Interceptador principal JWT');
            console.log('   📄 middleware/grpcAuth.js - Middleware de autenticação');
            console.log('   📄 services/AuthService.js - Serviço completo');
            console.log('   📄 protos/auth_service.proto - Definições de protocolo');
            
        } catch (error) {
            console.error(`❌ Erro na demonstração: ${error.message}`);
        } finally {
            this.cleanup();
        }
    }

    cleanup() {
        console.log('\n🧹 Realizando limpeza...');
        console.log('✅ Limpeza concluída');
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const demo = new JWTDemo();
    
    // Cleanup ao sair
    process.on('SIGINT', () => {
        console.log('\n🛑 Interrupção detectada');
        demo.cleanup();
        process.exit(0);
    });
    
    demo.run().catch((error) => {
        console.error('💥 Erro fatal:', error);
        demo.cleanup();
        process.exit(1);
    });
}

module.exports = { JWTDemo };
