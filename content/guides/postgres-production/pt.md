---
title: "Postgres de produção em 10 minutos"
description: "Provisione um Postgres gerenciado com HA, backups e upgrades sem downtime — em três chamadas de API."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Postgres de produção em 10 minutos

No final deste guia, você terá um cluster Postgres 16 gerenciado com:

- Três nós (um primário e duas réplicas) distribuídos entre zonas de disponibilidade
- Backups diários automáticos + 7 dias de recuperação para um ponto no tempo
- Pooler de conexões ativado
- Acesso somente via TLS a partir de um IP na allow-list
- Uma string de conexão pronta para colocar no seu app

Tempo total: cerca de 10 minutos (a maior parte na etapa de provisionamento do cluster).

## Pré-requisitos {#prereqs}

- Uma conta na NimbusNexus com uma chave de API. Veja o [Início rápido](/docs/quickstart) se você ainda não tiver uma.
- A região que você quer — Virgínia (`us-east-1`), Los Angeles (`us-west-1`), Frankfurt (`eu-central-1`) ou Singapura (`ap-southeast-1`).
- O `psql` instalado localmente, se você quiser se conectar no final.

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · Criar o cluster {#create}

```bash
curl -X POST {{API_BASE_URL}}/v1/databases \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "app-prod",
    "engine": "postgres",
    "engine_version": "16",
    "tier": "production-4-16",
    "region": "us-east-1",
    "high_availability": true,
    "backup_retention_days": 7,
    "connection_pooler": true,
    "tls_required": true
  }'
```

O que cada opção faz:

- `tier: 'production-4-16'` — 4 vCPU, 16 GB de RAM, 200 GB de SSD. O tamanho certo para apps de tráfego baixo a médio (~1.000 QPS). Veja [a tabela de tiers](/docs/api/managed-databases) para a lista completa de tamanhos.
- `high_availability: true` — primário + duas réplicas distribuídas entre AZs. Acrescenta ~80% ao custo; elimina muitos incidentes de plantão.
- `backup_retention_days: 7` — backup completo diário + streaming contínuo do WAL, restaurável para qualquer ponto dos últimos 7 dias.
- `connection_pooler: true` — PgBouncer ativado na porta 6432. Use-o em qualquer app em que o dimensionamento do pool de conexões esteja sob seu controle (a maioria está).
- `tls_required: true` — conexões sem TLS são rejeitadas no listener. Sempre defina isso.

A resposta inclui o `id` do cluster. Salve-o:

```bash
export DB_ID="db_01HG7..."
```

## 2 · Aguardar até que fique pronto {#wait}

O provisionamento leva 4–7 minutos. Faça polling até que `state` seja `running`:

```bash
while true; do
  state=$(curl -s {{API_BASE_URL}}/v1/databases/$DB_ID \
    -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.state')
  echo "state: $state"
  [ "$state" = "running" ] && break
  sleep 10
done
```

Ou, se preferir receber um webhook, [inscreva-se em `database.created`](/docs/webhooks#events) e dispense o loop de polling.

## 3 · Incluir seu IP na allow-list {#allowlist}

Por padrão, o cluster aceita conexões de qualquer origem para a qual ele consiga rotear. Em produção, você quer uma allow-list explícita:

```bash
MY_IP=$(curl -s ifconfig.me)/32

curl -X POST {{API_BASE_URL}}/v1/databases/$DB_ID/allowlist \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"cidr\": \"$MY_IP\", \"description\": \"my laptop\" }"
```

Adicione uma entrada para cada CIDR que você quer liberar. Para uma VM que precisa alcançar este banco de dados, adicione o CIDR do IP flutuante da VM (ou o CIDR do NAT de saída, se ela estiver atrás de um). As entradas da allow-list são stateful — remover uma corta as novas conexões; as conexões existentes continuam ativas até expirarem por inatividade ou até você reiniciar o cluster.

## 4 · Conectar {#connect}

Busque os detalhes de conexão:

```bash
curl -s {{API_BASE_URL}}/v1/databases/$DB_ID/connection \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Resposta:

```json
{
  "host": "{{DB_HOST_DEMO}}",
  "port": 5432,
  "pooler_port": 6432,
  "database": "app",
  "username": "app",
  "password": "•••• (one-time view in dashboard)",
  "tls_root_cert_url": "{{BASE_URL}}/ca-certs/nimbusnexus-root.pem"
}
```

Baixe o certificado raiz uma vez:

```bash
curl -o ~/.postgresql/nn-root.crt {{BASE_URL}}/ca-certs/nimbusnexus-root.pem
```

Conecte-se:

```bash
psql "postgresql://app:••••@{{DB_HOST_DEMO}}:6432/app?sslmode=verify-full&sslrootcert=~/.postgresql/nn-root.crt"
```

Use a porta `6432` (pooler) a partir dos servidores de aplicação; a porta `5432` só para ferramentas de administração/migração que precisam de acesso direto ao primário (por exemplo, `pg_dump`, `pg_restore`, ferramentas de migração de schema que usam advisory locks).

`sslmode=verify-full` confere o certificado com o hostname — o padrão certo. `verify-ca` também é aceitável; `require` é aceitável fora de produção, mas pula a verificação do hostname (e, portanto, deixa de barrar uma classe de ataques MITM). Nunca use `prefer` nem `disable`.

## O que você fez {#summary}

Agora você tem um cluster Postgres com qualidade de produção:

- Três nós, failover automático
- Backups diários + PITR de 7 dias
- Pooler de conexões ativado (porta 6432)
- TLS obrigatório, com allow-list
- Custo: cerca de $200/mês para o tier `production-4-16` com HA + backups de 7 dias em us-east-1

O mesmo formato funciona para MySQL, MongoDB, Redis, Kafka e OpenSearch — troque `engine`, troque `engine_version`, e o restante das opções continua valendo, com padrões adequados a cada mecanismo.

## Próximos passos {#next-steps}

- [Referência de bancos de dados gerenciados](/docs/api/managed-databases) — todas as opções da chamada de criação e todos os endpoints para gerenciar o cluster.
- [Guia de migração do AWS RDS](/docs/guides/migrate-from-rds) — a mesma configuração, com uma migração de dados única a partir de um cluster RDS existente.
- [Webhooks da plataforma](/docs/webhooks) — conecte os eventos `database.created`, `database.upgrade_completed` e `backup.completed` ao seu monitoramento.
- [Snapshots](/docs/api/snapshots) — cópias pontuais sob demanda para verificações de segurança antes do deploy.
