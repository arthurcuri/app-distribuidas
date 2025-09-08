# Relatório Comparativo: REST vs gRPC - Latência e Throughput

## Resumo Executivo

Este relatório apresenta uma análise comparativa entre REST e gRPC, duas arquiteturas de comunicação amplamente utilizadas em sistemas distribuídos, com foco específico em métricas de performance: latência e throughput.

## Características Técnicas Fundamentais

**REST (Representational State Transfer)**
- Protocolo: HTTP/1.1 ou HTTP/2
- Formato de dados: JSON (texto)
- Modelo de comunicação: Request-Response síncrono
- Overhead: Headers HTTP + parsing JSON

**gRPC (gRPC Remote Procedure Calls)**
- Protocolo: HTTP/2 obrigatório
- Formato de dados: Protocol Buffers (binário)
- Modelo de comunicação: Unário, streaming bidirecional
- Overhead: Headers menores + serialização binária

## Análise de Performance

### Latência

**gRPC apresenta menor latência devido a:**
- **Serialização binária**: Protocol Buffers são 3-10x mais rápidos que JSON para serializar/deserializar
- **HTTP/2 nativo**: Multiplexing elimina bloqueio de requisições
- **Headers compactos**: Redução significativa no overhead de cabeçalhos
- **Conexões persistentes**: Reutilização de conexões TCP reduz handshake

**REST tem maior latência por:**
- **Parsing JSON**: Processamento textual mais lento
- **HTTP/1.1 comum**: Bloqueio head-of-line em muitas implementações
- **Headers verbosos**: Maior overhead por requisição

**Diferença típica**: gRPC pode ser 20-40% mais rápido em latência comparado ao REST tradicional.

### Throughput

**gRPC oferece maior throughput através de:**
- **Multiplexing**: Múltiplas requisições simultâneas na mesma conexão
- **Compressão eficiente**: Protocol Buffers resultam em payloads menores (até 50% de redução)
- **Streaming**: Capacidade de enviar dados contínuos sem overhead de requisições separadas
- **Connection pooling**: Melhor gerenciamento de conexões

**REST limita throughput por:**
- **Serialização ineficiente**: JSON ocupa mais bandwidth
- **Overhead HTTP**: Headers repetitivos em cada requisição
- **Limitações de concorrência**: Especialmente em HTTP/1.1

**Diferença típica**: gRPC pode alcançar 2-5x maior throughput em cenários de alta concorrência.

## Cenários de Aplicação

**gRPC é superior quando:**
- Comunicação interna entre microsserviços
- Alto volume de requisições
- Necessidade de baixa latência
- Streaming de dados em tempo real
- APIs com contratos bem definidos

**REST permanece vantajoso quando:**
- APIs públicas para desenvolvedores externos
- Integração com sistemas web tradicionais
- Prototipagem rápida
- Simplicidade de debugging é prioritária
- Compatibilidade com proxies/load balancers HTTP

## Considerações de Implementação

O desempenho real depende de fatores como:
- Qualidade da implementação
- Configurações de rede
- Tamanho e complexidade dos payloads
- Padrões de acesso (rajadas vs. constante)

## Conclusão

gRPC demonstra superioridade clara em termos de latência e throughput, especialmente em comunicações internas de sistemas distribuídos. A redução de 20-40% na latência e o aumento de 2-5x no throughput fazem dele a escolha ideal para cenários de alta performance. Contudo, REST mantém sua relevância em contextos onde simplicidade, compatibilidade e facilidade de integração são mais importantes que performance pura.

A escolha entre as tecnologias deve considerar não apenas performance, mas também complexidade de implementação, necessidades de debugging e requisitos de interoperabilidade do sistema.