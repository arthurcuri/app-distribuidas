class LoadBalancingDemo {
    constructor() {
        this.servers = [
            { id: 1, name: 'Server-A', load: 0, active: true },
            { id: 2, name: 'Server-B', load: 0, active: true },
            { id: 3, name: 'Server-C', load: 0, active: true }
        ];
        this.strategies = ['round-robin', 'least-connections', 'weighted'];
        this.currentStrategy = 'round-robin';
        this.roundRobinIndex = 0;
    }

    async run() {
        console.log('🔄 === DEMONSTRAÇÃO DE LOAD BALANCING ===');
        console.log('   Estratégias: Round Robin, Least Connections, Weighted');
        console.log('   Servidores: 3 instâncias simuladas\n');

        // Demonstrar diferentes estratégias
        for (const strategy of this.strategies) {
            console.log(`📊 Testando estratégia: ${strategy.toUpperCase()}`);
            this.currentStrategy = strategy;
            
            // Simular 5 requisições
            for (let i = 1; i <= 5; i++) {
                const server = this.selectServer();
                server.load++;
                console.log(`   Requisição ${i} → ${server.name} (Load: ${server.load})`);
                await this.delay(200);
            }
            
            console.log(`   Estado final: ${this.servers.map(s => `${s.name}(${s.load})`).join(', ')}\n`);
            this.resetServers();
        }

        // Demonstrar cenário de falha
        console.log('⚠️  Simulando falha do Server-B...');
        this.servers[1].active = false;
        this.currentStrategy = 'round-robin';
        
        for (let i = 1; i <= 4; i++) {
            const server = this.selectServer();
            console.log(`   Requisição ${i} → ${server.name} (Server-B inativo)`);
            await this.delay(200);
        }
        
        console.log('\n✅ Demonstração de Load Balancing concluída!');
    }

    selectServer() {
        const activeServers = this.servers.filter(s => s.active);
        
        switch (this.currentStrategy) {
            case 'round-robin':
                const server = activeServers[this.roundRobinIndex % activeServers.length];
                this.roundRobinIndex++;
                return server;
                
            case 'least-connections':
                return activeServers.reduce((min, server) => 
                    server.load < min.load ? server : min
                );
                
            case 'weighted':
                // Peso baseado no ID (Server-A = 50%, Server-B = 30%, Server-C = 20%)
                const weights = { 1: 0.5, 2: 0.3, 3: 0.2 };
                const random = Math.random();
                let cumulative = 0;
                
                for (const server of activeServers) {
                    cumulative += weights[server.id] || 0.2;
                    if (random <= cumulative) return server;
                }
                return activeServers[0];
                
            default:
                return activeServers[0];
        }
    }

    resetServers() {
        this.servers.forEach(server => {
            server.load = 0;
            server.active = true;
        });
        this.roundRobinIndex = 0;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = LoadBalancingDemo;
