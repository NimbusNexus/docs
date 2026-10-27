---
title: "Failover entre regiões"
description: "Failover no nível do DNS entre duas regiões, com roteamento por verificação de integridade. RTO de ~30 s."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Failover entre regiões

IPs flutuantes têm escopo de região — não podem se mover entre regiões. Para failover entre regiões (queda de uma região inteira, degradação de latência regional), a primitiva certa é o roteamento no nível do DNS com verificações de integridade. O direcionamento por latência envia cada usuário para a região saudável mais próxima; em uma falha regional, a camada de DNS tira aquela região de rotação.

RTO-alvo com esta configuração: **20–60 segundos**, dependendo do TTL e da rapidez com que seus resolvedores DNS refazem a consulta.

## O que você vai configurar {#overview}

```text
                    your customers
                          │
                  app.example.com  ← DNS A record set
                          │
            ┌─────────────┴─────────────┐
            ↓                           ↓
       us-east-1                   eu-central-1
   (203.0.113.5/32)             (198.51.100.5/32)
        VM-A                        VM-B
        │                            │
        └─ replicated DB ───────────┘
              (logical replication)
```

O DNS resolve para a região que estiver mais próxima do resolvedor. Se uma região falhar na verificação de integridade, o DNS deixa de retornar o IP dessa região até ela se recuperar.

## Pré-requisitos {#prereqs}

- Duas VMs em regiões diferentes, cada uma atrás de um [IP flutuante](/docs/api/floating-ips).
- Sua aplicação rodando nas duas VMs, pronta para servir tráfego.
- Um banco de dados ou armazenamento com estado que exista nas duas regiões, com replicação entre elas. Para Postgres, a [replicação lógica no estilo da migração do RDS](/docs/guides/migrate-from-rds) é a mesma primitiva. Para Redis, espelhe os cache misses; para armazenamento de objetos, use a [replicação entre regiões](/docs/api/object-storage#cross-region).
- Uma zona DNS hospedada no DNS da NimbusNexus (ou em qualquer provedor de DNS que suporte conjuntos de registros com verificação de integridade — Route53, Cloudflare etc.).
- Um endpoint de verificação de integridade que realmente confirme que sua aplicação consegue servir tráfego (não apenas um `200 OK` em `/healthz`).

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export ZONE_ID="zone_01HG7..."
export EAST_IP_ID="ip_01HG7Y3..."      # floating IP in us-east-1
export WEST_IP_ID="ip_01HG7Y4..."      # floating IP in eu-central-1
```

## 1 · Criar o conjunto de registros com vários valores {#record-set}

Adicione um conjunto de registros A com os IPs das duas regiões, roteado por latência:

```bash
EAST_IPV4=$(curl -s {{API_BASE_URL}}/v1/floating-ips/$EAST_IP_ID \
  -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.ipv4')

WEST_IPV4=$(curl -s {{API_BASE_URL}}/v1/floating-ips/$WEST_IP_ID \
  -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.ipv4')

curl -X POST {{API_BASE_URL}}/v1/dns/zones/$ZONE_ID/records \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"app.example.com\",
    \"type\": \"A\",
    \"routing_policy\": \"latency\",
    \"ttl\": 60,
    \"values\": [
      { \"value\": \"$EAST_IPV4\", \"region\": \"us-east-1\" },
      { \"value\": \"$WEST_IPV4\", \"region\": \"eu-central-1\" }
    ]
  }"
```

Campos principais:

- `routing_policy: 'latency'` — os resolvedores DNS recebem o IP que corresponde à região geograficamente mais próxima. Alternativas: `'weighted'` (divisão por porcentagem), `'failover'` (primário/secundário, nunca round-robin), `'geo'` (roteamento pelo país do cliente).
- `ttl: 60` — TTL de 60 segundos. TTL menor = failover mais rápido (os resolvedores refazem a consulta mais cedo), ao custo de mais consultas DNS. Para um serviço com necessidade de alta disponibilidade, 60 é o certo; para configurações com SLA menor, 300 está bom.

## 2 · Adicionar verificações de integridade {#health-checks}

Cada valor do conjunto de registros recebe uma verificação de integridade. Verificações que falham tiram aquele valor de rotação:

```bash
curl -X POST {{API_BASE_URL}}/v1/dns/zones/$ZONE_ID/records/$RECORD_ID/health-checks \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "value_index": 0,
    "type": "https",
    "path": "/healthz",
    "expected_status": 200,
    "interval_seconds": 10,
    "failure_threshold": 3,
    "success_threshold": 2
  }'
```

Repita para `value_index: 1` (a segunda região). O que cada campo faz:

- `interval_seconds: 10` — verifica a cada 10 segundos.
- `failure_threshold: 3` — três falhas consecutivas antes de considerar o valor fora do ar. Combinado com `interval_seconds`, isso dá 30 segundos até uma região sair — um pouco acima do limiar de instabilidades passageiras da rede e bem abaixo de "já estamos vendo isso no PagerDuty".
- `success_threshold: 2` — dois sucessos consecutivos antes de considerar o valor de volta. Evita oscilações durante uma recuperação instável.

O endpoint de verificação de integridade importa. Não o implemente como um `return 200 OK` incondicional — isso anula o propósito. Faça com que ele realmente verifique as dependências downstream (conexão com o banco de dados, cache, a fila), para que falhe quando a aplicação falharia.

## 3 · Testar {#test}

Force uma "falha" bloqueando a sonda de verificação de integridade em uma região:

```bash
# On the us-east-1 VM, drop traffic from the health-check source CIDR
sudo iptables -A INPUT -s <healthcheck-cidr> -j DROP
```

(Obtenha os CIDRs de origem das verificações de integridade em `GET /v1/dns/healthcheck-source-cidrs`.)

Em até 30 segundos, o conjunto de registros deve parar de retornar o IP de us-east-1:

```bash
dig +short app.example.com
# Should return only the eu-central-1 IP for the next several seconds
```

Desfaça a regra do iptables para restaurar a região. Em até 20 segundos (`2 * interval_seconds`), ela deve voltar à rotação.

## 4 · Replicação do banco de dados {#db}

A camada de DNS cuida de onde o tráfego chega; a camada de dados é mais difícil. Os padrões:

**Para cargas de trabalho predominantemente de leitura:**

- Banco de dados primário em uma região, réplica de leitura na outra.
- O app lê da região local (da réplica, quando está na região secundária).
- As gravações sempre vão para o primário (por isso a região secundária tem uma latência de gravação maior).
- Em caso de falha da região primária: promova a réplica a primário e faça o failover de leituras + gravações para o novo primário.

**Para cargas de trabalho com muitas gravações que toleram multi-master:**

- Use um banco de dados que suporte replicação ativo-ativo (CockroachDB, YugabyteDB).
- As duas regiões leem + gravam localmente; os conflitos são resolvidos pelo mecanismo.
- Mais complexo de operar; só se justifica quando a latência de gravação com um único master é um problema real.

**Para cache e fila:**

- Cache: conte com o cache frio depois do failover. A maioria dos apps se recupera em minutos; o impacto no SLA é tolerável.
- Fila: mantenha filas por região; a aplicação aceita que uma fila regional pode ficar indisponível até a região se recuperar.

A NimbusNexus ainda não oferece um produto de banco de dados ativo-ativo em várias regiões. Por enquanto, gerencie a replicação você mesmo via replicação lógica (Postgres), binlog (MySQL) ou change streams (MongoDB).

## O que isto não é {#not}

- **Não é failover ativo-ativo para o estado**: as gravações continuam concentradas em um primário. A camada de DNS direciona os usuários; a camada de banco de dados continua, na maior parte do tempo, com um único master.
- **Não é transparente para os clientes**: as conexões TCP com o IP da região que falhou são redefinidas; os clientes se reconectam (a maioria dos clientes HTTP lida bem com isso; alguns clientes de long polling ou SSE precisam de um handler de retentativa).
- **Não é RTO zero**: 20–60 segundos é o mínimo com TTL = 60. Um TTL menor ajuda, mas ao custo de um volume maior de consultas DNS.

## Próximos passos {#next-steps}

- [Zonas DNS](/docs/api/dns-zones) — a API de zonas onde o conjunto de registros fica.
- [Registros DNS](/docs/api/dns-records) — todas as políticas de roteamento + a semântica dos campos.
- [IPs flutuantes](/docs/api/floating-ips) — a primitiva de failover dentro da região sobre a qual isto se apoia.
- [Deploys blue/green](/docs/guides/blue-green) — a mesma ideia, dentro de uma região.
