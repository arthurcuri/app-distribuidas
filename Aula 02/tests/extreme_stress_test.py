import asyncio
import aiohttp
import time
import json
from datetime import datetime
import threading
import subprocess
import signal
import os

class ExtremeStressTest:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
        self.token = None
        self.results = {
            'total_requests': 0,
            'successful': 0,
            'failed': 0,
            'rate_limited': 0,
            'timeouts': 0,
            'connection_errors': 0,
            'response_times': [],
            'errors': []
        }
    
    async def login(self, session):
        try:
            async with session.post(
                f"{self.base_url}/api/auth/login",
                json={"identifier": "testuser", "password": "123456"},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    self.token = data['data']['token']
                    return True
                return False
        except Exception as e:
            print(f"Login error: {e}")
            return False
    
    async def make_request(self, session, endpoint, method="GET", data=None, timeout=1):
        headers = {}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        start_time = time.time()
        try:
            if method == "GET":
                async with session.get(
                    f"{self.base_url}{endpoint}", 
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=timeout)
                ) as response:
                    await response.text()
                    status = response.status
            elif method == "POST":
                async with session.post(
                    f"{self.base_url}{endpoint}", 
                    headers=headers, 
                    json=data,
                    timeout=aiohttp.ClientTimeout(total=timeout)
                ) as response:
                    await response.text()
                    status = response.status
            
            response_time = time.time() - start_time
            self.results['response_times'].append(response_time)
            self.results['total_requests'] += 1
            
            if status == 200 or status == 201:
                self.results['successful'] += 1
            elif status == 429:
                self.results['rate_limited'] += 1
            else:
                self.results['failed'] += 1
                self.results['errors'].append(f"Status {status}")
                
        except asyncio.TimeoutError:
            self.results['total_requests'] += 1
            self.results['timeouts'] += 1
            self.results['errors'].append("Timeout")
        except aiohttp.ClientConnectorError as e:
            self.results['total_requests'] += 1
            self.results['connection_errors'] += 1
            self.results['errors'].append(f"Connection Error: {str(e)}")
        except Exception as e:
            self.results['total_requests'] += 1
            self.results['failed'] += 1
            self.results['errors'].append(str(e))
    
    async def extreme_load_test(self):
        """Teste extremo com timeout muito baixo para forçar perda de pacotes"""
        print("🔥 TESTE EXTREMO - TENTANDO FORÇAR PERDA DE PACOTES")
        print("="*60)
        
        # Conectores com limites muito altos
        connector = aiohttp.TCPConnector(
            limit=1000,           # Máximo de conexões
            limit_per_host=500,   # Por host
            ttl_dns_cache=0,      # Sem cache DNS
            use_dns_cache=False,  # Forçar resolução DNS
            keepalive_timeout=1   # Timeout baixo para keep-alive
        )
        
        async with aiohttp.ClientSession(connector=connector) as session:
            # Login primeiro
            if not await self.login(session):
                print("❌ Falha no login")
                return
            
            print("Executando teste com:")
            print("- 500 requisições concorrentes")
            print("- 2000 requisições totais")
            print("- Timeout de 0.5 segundos")
            print("- Múltiplos endpoints simultâneos")
            
            # Criar tarefas para múltiplos endpoints
            tasks = []
            endpoints = ["/health", "/api/tasks", "/api/users/profile"]
            
            # Distribuir requisições entre endpoints
            for i in range(2000):
                endpoint = endpoints[i % len(endpoints)]
                # Timeout muito baixo para forçar timeouts
                task = self.make_request(session, endpoint, timeout=0.5)
                tasks.append(task)
            
            # Executar com concorrência muito alta
            semaphore = asyncio.Semaphore(500)  # 500 concurrent
            
            async def limited_request(task):
                async with semaphore:
                    await task
            
            limited_tasks = [limited_request(task) for task in tasks]
            
            start_time = time.time()
            print("🚀 Iniciando bombardeio...")
            
            # Executar todas as tarefas
            await asyncio.gather(*limited_tasks, return_exceptions=True)
            
            duration = time.time() - start_time
            return duration
    
    async def memory_exhaustion_test(self):
        """Teste para esgotar memória e forçar falhas"""
        print("\n🧠 TESTE DE ESGOTAMENTO DE MEMÓRIA")
        print("="*60)
        
        # Reset results
        self.reset_results()
        
        connector = aiohttp.TCPConnector(limit=100, limit_per_host=100)
        async with aiohttp.ClientSession(connector=connector) as session:
            await self.login(session)
            
            # Criar requisições POST com dados grandes
            large_data = {
                "title": "X" * 10000,  # 10KB title
                "description": "Y" * 50000,  # 50KB description
                "category": "stress_test",
                "tags": ["large"] * 1000  # Array grande
            }
            
            print("Enviando 100 requisições com payload de ~65KB cada...")
            
            tasks = []
            for i in range(100):
                task = self.make_request(session, "/api/tasks", "POST", large_data, timeout=2)
                tasks.append(task)
            
            start_time = time.time()
            await asyncio.gather(*tasks, return_exceptions=True)
            duration = time.time() - start_time
            
            return duration
    
    def flood_server_with_curl(self):
        """Usar curl para bombardear o servidor simultaneamente"""
        print("\n💥 TESTE DE FLOOD COM CURL")
        print("="*60)
        
        def run_curl_flood():
            # Executar múltiplos curl simultaneamente
            processes = []
            for i in range(50):
                cmd = f"curl -s -m 0.1 http://localhost:3000/health > /dev/null 2>&1"
                proc = subprocess.Popen(cmd, shell=True)
                processes.append(proc)
            
            # Aguardar todos terminarem
            for proc in processes:
                proc.wait()
        
        # Executar flood em threads separadas
        threads = []
        for i in range(10):  # 10 threads, 50 curl cada = 500 simultâneos
            thread = threading.Thread(target=run_curl_flood)
            threads.append(thread)
        
        print("Executando 500 requisições curl simultâneas com timeout 0.1s...")
        start_time = time.time()
        
        for thread in threads:
            thread.start()
        
        for thread in threads:
            thread.join()
        
        duration = time.time() - start_time
        print(f"Flood curl completado em {duration:.2f} segundos")
    
    def print_results(self, test_name, duration=None):
        avg_response_time = sum(self.results['response_times']) / len(self.results['response_times']) if self.results['response_times'] else 0
        max_response_time = max(self.results['response_times']) if self.results['response_times'] else 0
        
        print(f"\n{'='*60}")
        print(f"🔥 RESULTADOS EXTREMOS: {test_name}")
        print(f"{'='*60}")
        print(f"Total enviadas: {self.results['total_requests']}")
        print(f"✅ Sucessos: {self.results['successful']}")
        print(f"❌ Falhas: {self.results['failed']}")
        print(f"⏰ Timeouts: {self.results['timeouts']}")
        print(f"🔌 Erros de conexão: {self.results['connection_errors']}")
        print(f"🛡️ Rate Limited: {self.results['rate_limited']}")
        
        # Cálculo REAL de perda de pacotes
        real_packet_loss = self.results['timeouts'] + self.results['connection_errors']
        if self.results['total_requests'] > 0:
            loss_rate = (real_packet_loss / self.results['total_requests']) * 100
            success_rate = (self.results['successful'] / self.results['total_requests']) * 100
            print(f"📊 Taxa de sucesso: {success_rate:.1f}%")
            print(f"📉 Taxa de PERDA REAL: {loss_rate:.1f}%")
            
            if loss_rate > 0:
                print(f"🎯 SUCESSO: Conseguimos forçar {loss_rate:.1f}% de perda de pacotes!")
            else:
                print("⚠️ Sistema muito robusto - sem perda de pacotes detectada")
        
        if avg_response_time > 0:
            print(f"⏱️ Tempo médio: {avg_response_time:.3f}s")
            print(f"⏱️ Tempo máximo: {max_response_time:.3f}s")
        
        if duration:
            rps = self.results['total_requests'] / duration if duration > 0 else 0
            print(f"🚀 RPS: {rps:.1f}")
        
        # Mostrar erros específicos
        if self.results['errors']:
            print(f"\n🔍 Tipos de erros encontrados:")
            error_counts = {}
            for error in self.results['errors'][:20]:  # Primeiros 20
                error_counts[error] = error_counts.get(error, 0) + 1
            
            for error, count in error_counts.items():
                print(f"  • {error}: {count}x")
        
        print(f"{'='*60}\n")
    
    def reset_results(self):
        self.results = {
            'total_requests': 0,
            'successful': 0,
            'failed': 0,
            'rate_limited': 0,
            'timeouts': 0,
            'connection_errors': 0,
            'response_times': [],
            'errors': []
        }

async def main():
    print("🔥🔥🔥 TESTE EXTREMO PARA FORÇAR PERDA DE PACOTES 🔥🔥🔥")
    print("="*70)
    print("OBJETIVO: Sobrecarregar o sistema até forçar timeouts e falhas")
    print("="*70)
    
    test = ExtremeStressTest()
    
    # Teste 1: Carga extrema com timeout baixo
    print("TESTE 1: BOMBARDEIO EXTREMO")
    duration = await test.extreme_load_test()
    test.print_results("Bombardeio Extremo", duration)
    
    # Teste 2: Payload grande para esgotar memória
    print("TESTE 2: ESGOTAMENTO DE MEMÓRIA")
    duration = await test.memory_exhaustion_test()
    test.print_results("Esgotamento de Memória", duration)
    
    # Teste 3: Flood com curl
    test.flood_server_with_curl()
    
    print("🏁 TESTE EXTREMO CONCLUÍDO!")
    print("Se não houve perda de pacotes, o sistema é MUITO robusto!")

if __name__ == "__main__":
    asyncio.run(main())
