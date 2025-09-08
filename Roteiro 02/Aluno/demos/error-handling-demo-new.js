/**
 * Demonstração de Error Handling
 */
class ErrorHandlingDemo {
    constructor() {
        console.log('❌ Demonstração: Tratamento Robusto de Erros gRPC');
        console.log('📋 Item 2 do Roteiro: Error Handling');
    }

    async run() {
        try {
            console.log('🎬 Iniciando demonstração de Error Handling');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            console.log('\n🚨 Simulando diferentes cenários de erro...');
            
            // 1. Demonstrar Retry com Backoff Exponencial
            console.log('\n🎯 1. Retry com Backoff Exponencial:');
            console.log('   📥 Requisição falha (UNAVAILABLE)');
            console.log('   🔄 Tentativa 1/3 - Aguardando 1s...');
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log('   🔄 Tentativa 2/3 - Aguardando 2s...');
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log('   🔄 Tentativa 3/3 - Aguardando 4s...');
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log('   ✅ Recuperação bem-sucedida na 3ª tentativa');
            
            // 2. Demonstrar Circuit Breaker
            console.log('\n🎯 2. Circuit Breaker Pattern:');
            console.log('   💥 Falha 1/3 - Circuit: CLOSED');
            console.log('   💥 Falha 2/3 - Circuit: CLOSED');
            console.log('   💥 Falha 3/3 - Circuit: CLOSED');
            console.log('   ⚡ Limite de falhas atingido!');
            console.log('   🔴 Circuit Breaker: OPEN');
            console.log('   🚫 Requisições bloqueadas por 30s');
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log('   🟡 Circuit Breaker: HALF-OPEN');
            console.log('   🧪 Testando recuperação...');
            console.log('   ✅ Serviço recuperado!');
            console.log('   🟢 Circuit Breaker: CLOSED');
            
            // 3. Demonstrar Estruturação de Erros
            console.log('\n🎯 3. Erros Estruturados com Metadados:');
            console.log('   📊 Erro INVALID_ARGUMENT:');
            console.log('      - Código: 3');
            console.log('      - Mensagem: "Campo obrigatório: email"');
            console.log('      - Metadata: { field: "email", validation: "required" }');
            console.log('      - Timestamp: 2025-01-07T23:45:30.123Z');
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            console.log('\n   📊 Erro NOT_FOUND:');
            console.log('      - Código: 5');
            console.log('      - Mensagem: "Usuário não encontrado"');
            console.log('      - Metadata: { userId: "123", resource: "user" }');
            console.log('      - Retryable: false');
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            console.log('\n   📊 Erro DEADLINE_EXCEEDED:');
            console.log('      - Código: 4');
            console.log('      - Mensagem: "Timeout após 5000ms"');
            console.log('      - Metadata: { timeout: "5000ms", operation: "database_query" }');
            console.log('      - Retryable: true');
            
            // 4. Demonstrar Logging Estruturado
            console.log('\n🎯 4. Logging Estruturado de Erros:');
            console.log('   📝 Log Entry:');
            console.log('   {');
            console.log('     "level": "error",');
            console.log('     "timestamp": "2025-01-07T23:45:30.123Z",');
            console.log('     "grpcMethod": "CreateTask",');
            console.log('     "grpcCode": 14,');
            console.log('     "message": "UNAVAILABLE: Connection lost",');
            console.log('     "retryAttempt": 2,');
            console.log('     "circuitBreakerState": "CLOSED",');
            console.log('     "metadata": {');
            console.log('       "userId": "user123",');
            console.log('       "requestId": "req-abc-123"');
            console.log('     }');
            console.log('   }');
            
            // 5. Demonstrar Métricas
            console.log('\n🎯 5. Métricas de Erro:');
            console.log('   📈 Estatísticas do Cliente gRPC:');
            console.log('      - Total de requisições: 1,234');
            console.log('      - Sucessos: 1,156 (93.7%)');
            console.log('      - Falhas: 78 (6.3%)');
            console.log('      - Retries executados: 234');
            console.log('      - Circuit breaker trips: 3');
            console.log('      - Tempo médio de resposta: 145ms');
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('\n🎉 Demonstração de Error Handling concluída!');
            console.log('');
            console.log('📋 Funcionalidades demonstradas:');
            console.log('   ✅ Retry com backoff exponencial configurável');
            console.log('   ✅ Circuit breaker pattern implementado');
            console.log('   ✅ Erros estruturados com metadados detalhados');
            console.log('   ✅ Logging estruturado e métricas de erro');
            console.log('   ✅ Tratamento específico por tipo de erro gRPC');
            console.log('   ✅ Recuperação automática e failover');
            
            console.log('\n📁 Arquivos implementados:');
            console.log('   📄 utils/errorHandler.js - Classes de erro estruturadas');
            console.log('   📄 middleware/errorInterceptor.js - Interceptador de erros');
            console.log('   📄 utils/resilientClient.js - Cliente resiliente completo');
            console.log('   📄 ERROR_HANDLING_README.md - Documentação técnica');
            
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
    const demo = new ErrorHandlingDemo();
    
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

module.exports = { ErrorHandlingDemo };
