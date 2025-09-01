import asyncio
import aiohttp
import time
import json
from datetime import datetime

class StressTestRunner:
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
    
    async def make_request(self, session, endpoint, method="GET", data=None):
        headers = {}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        start_time = time.time()
        try:
            if method == "GET":
                async with session.get(
                    f"{self.base_url}{endpoint}", 
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    await response.text()
                    status = response.status
            elif method == "POST":
                async with session.post(
                    f"{self.base_url}{endpoint}", 
                    headers=headers, 
                    json=data,
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    await response.text()
                    status = response.status
            
            response_time = time.time() - start_time
            self.results['response_times'].append(response_time)
            self.results['total_requests'] += 1
            
            if status == 200 or status == 201:
                self.results['successful'] += 1
            elif status == 429:  # Rate limited
                self.results['rate_limited'] += 1
            else:
                self.results['failed'] += 1
                self.results['errors'].append(f"Status {status}")
                
        except asyncio.TimeoutError:
            self.results['total_requests'] += 1
            self.results['timeouts'] += 1
            self.results['errors'].append("Timeout")
        except aiohttp.ClientConnectorError:
            self.results['total_requests'] += 1
            self.results['connection_errors'] += 1
            self.results['errors'].append("Connection Error")
        except Exception as e:
            self.results['total_requests'] += 1
            self.results['failed'] += 1
            self.results['errors'].append(str(e))
    
    async def stress_test_endpoint(self, endpoint, concurrent_requests=50, total_requests=500):
        connector = aiohttp.TCPConnector(limit=concurrent_requests, limit_per_host=concurrent_requests)
        async with aiohttp.ClientSession(connector=connector) as session:
            # Login first if needed
            if self.token is None and endpoint != "/health":
                await self.login(session)
            
            print(f"Iniciando teste: {concurrent_requests} requisições concorrentes, {total_requests} total")
            
            semaphore = asyncio.Semaphore(concurrent_requests)
            
            async def limited_request():
                async with semaphore:
                    await self.make_request(session, endpoint)
            
            tasks = [limited_request() for _ in range(total_requests)]
            start_time = time.time()
            await asyncio.gather(*tasks, return_exceptions=True)
            total_time = time.time() - start_time
            
            return total_time
    
    async def rate_limit_burst_test(self):
        """Teste específico para verificar rate limiting com rajadas"""
        connector = aiohttp.TCPConnector(limit=200, limit_per_host=200)
        async with aiohttp.ClientSession(connector=connector) as session:
            await self.login(session)
            
            print("Executando teste de rajada para rate limiting...")
            # Fazer 100 requisições muito rapidamente
            tasks = [self.make_request(session, "/api/tasks") for _ in range(100)]
            await asyncio.gather(*tasks, return_exceptions=True)
    
    def print_results(self, test_name, duration=None):
        avg_response_time = sum(self.results['response_times']) / len(self.results['response_times']) if self.results['response_times'] else 0
        max_response_time = max(self.results['response_times']) if self.results['response_times'] else 0
        min_response_time = min(self.results['response_times']) if self.results['response_times'] else 0
        
        print(f"\n{'='*60}")
        print(f"RESULTADOS DO TESTE: {test_name}")
        print(f"{'='*60}")
        print(f"Total de requisições enviadas: {self.results['total_requests']}")
        print(f"Sucessos (200/201): {self.results['successful']}")
        print(f"Falhas (4xx/5xx): {self.results['failed']}")
        print(f"Rate Limited (429): {self.results['rate_limited']}")
        print(f"Timeouts: {self.results['timeouts']}")
        print(f"Erros de conexão: {self.results['connection_errors']}")
        
        # Cálculo de pacotes perdidos
        packets_lost = self.results['timeouts'] + self.results['connection_errors']
        if self.results['total_requests'] > 0:
            loss_rate = (packets_lost / self.results['total_requests']) * 100
            success_rate = (self.results['successful'] / self.results['total_requests']) * 100
            print(f"Taxa de sucesso: {success_rate:.1f}%")
            print(f"Taxa de perda de pacotes: {loss_rate:.1f}%")
        
        print(f"Tempo médio de resposta: {avg_response_time:.3f}s")
        print(f"Tempo máximo de resposta: {max_response_time:.3f}s")
        print(f"Tempo mínimo de resposta: {min_response_time:.3f}s")
        
        if duration:
            rps = self.results['total_requests'] / duration if duration > 0 else 0
            print(f"Requisições por segundo: {rps:.1f}")
        
        # Análise de Rate Limiting
        if self.results['rate_limited'] > 0:
            print(f"✓ Sistema possui proteção Rate Limiting ({self.results['rate_limited']} bloqueios)")
        else:
            print("⚠ VULNERABILIDADE: Sistema SEM proteção Rate Limiting!")
        
        # Mostrar primeiros erros
        if self.results['errors']:
            print(f"\nPrimeiros 5 erros encontrados:")
            for i, error in enumerate(self.results['errors'][:5]):
                print(f"  {i+1}. {error}")
        
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
    print("INICIANDO TESTES DE ESTRESSE DA API")
    print("="*60)
    
    test = StressTestRunner()
    
    # Teste 1: Health Check (sem autenticação)
    print("1. TESTE DE HEALTH CHECK")
    duration = await test.stress_test_endpoint("/health", concurrent_requests=25, total_requests=200)
    test.print_results("Health Check", duration)
    
    # Reset para próximo teste
    test.reset_results()
    
    # Teste 2: Endpoint protegido com carga moderada
    print("2. TESTE DE LISTAGEM DE TAREFAS - CARGA MODERADA")
    duration = await test.stress_test_endpoint("/api/tasks", concurrent_requests=20, total_requests=150)
    test.print_results("Listagem de Tarefas - Moderada", duration)
    
    # Reset para próximo teste
    test.reset_results()
    
    # Teste 3: Carga alta
    print("3. TESTE DE CARGA ALTA")
    duration = await test.stress_test_endpoint("/api/tasks", concurrent_requests=50, total_requests=300)
    test.print_results("Carga Alta", duration)
    
    # Reset para próximo teste
    test.reset_results()
    
    # Teste 4: Teste específico de Rate Limiting
    print("4. TESTE DE RATE LIMITING (RAJADA)")
    await test.rate_limit_burst_test()
    test.print_results("Rate Limiting Burst")
    
    # Reset para próximo teste
    test.reset_results()
    
    # Teste 5: Carga extrema
    print("5. TESTE DE CARGA EXTREMA")
    duration = await test.stress_test_endpoint("/api/tasks", concurrent_requests=100, total_requests=500)
    test.print_results("Carga Extrema", duration)

if __name__ == "__main__":
    asyncio.run(main())
