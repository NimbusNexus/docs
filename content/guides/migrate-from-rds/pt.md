---
title: "Migrar do AWS RDS"
description: "Migre um banco de dados Postgres ou MySQL do RDS ao vivo, sem perda de dados e com ~30 s de downtime."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Migrar do AWS RDS

Este guia move um banco de dados Postgres ou MySQL de produção do AWS RDS para os bancos de dados gerenciados da NimbusNexus usando replicação lógica. O padrão: faça a cópia em massa ao vivo (sem downtime), transmita as mudanças contínuas via WAL/binlog e, então, faça o cutover com uma breve pausa nas conexões.

Downtime esperado: **~30 segundos** para o cutover. Tempo total: depende do volume de dados (8–30 minutos para a cópia inicial em tamanhos típicos).

Funciona para:

- Postgres 12+
- MySQL 8.0+

## Pré-requisitos {#prereqs}

Do lado da AWS:

- A instância RDS precisa estar com a replicação lógica ativada (`rds.logical_replication = 1` para Postgres; `binlog_format = ROW` para MySQL).
- Um usuário com permissão de replicação (ou você pode usar o usuário master).
- Acesso de rede de entrada a partir dos IPs da NimbusNexus (vamos obter os CIDRs específicos daqui a pouco).
- Um backup recente da instância RDS. Só por precaução.

Do lado da NimbusNexus:

- Uma chave de API.
- Uma região escolhida. A latência entre o host de migração e a instância RDS de origem importa — escolha a região mais próxima da região do RDS (por exemplo, `us-east-1` para um RDS em `us-east-1`).

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · Provisionar o cluster de destino {#provision}

Crie o cluster de destino com o mesmo mecanismo + versão da origem:

```bash
curl -X POST {{API_BASE_URL}}/v1/databases \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "app-prod-migrated",
    "engine": "postgres",
    "engine_version": "16",
    "tier": "production-4-16",
    "region": "us-east-1",
    "high_availability": true,
    "tls_required": true
  }'
```

Escolha uma classe de instância o mais próxima possível da origem. Usar uma bem menor traz o risco de o destino ficar para trás durante a fase de streaming do WAL/binlog. Você pode redimensionar depois que a migração terminar.

Salve o id do cluster:

```bash
export DB_ID="db_01HG7..."
```

Aguarde `state: running` (4–7 minutos).

## 2 · Incluir os IPs da NimbusNexus na allow-list do RDS {#allowlist}

Obtenha os CIDRs de egress dos nossos workers de migração na sua região:

```bash
curl {{API_BASE_URL}}/v1/databases/migration-source-cidrs?region=us-east-1 \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

A resposta é uma lista de blocos `/24`. Adicione-os às regras de entrada do grupo de segurança do RDS na porta do Postgres ou do MySQL. Restrinja o acesso apenas a esses CIDRs — não abra `0.0.0.0/0`.

## 3 · Iniciar a migração {#kick-off}

```bash
curl -X POST {{API_BASE_URL}}/v1/databases/$DB_ID/migrate \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "host": "mydb.abc123.us-east-1.rds.amazonaws.com",
      "port": 5432,
      "database": "app",
      "username": "migration_user",
      "password": "••••",
      "tls_required": true
    },
    "mode": "logical-replication"
  }'
```

A resposta inclui um `migration_id`:

```bash
export MIG_ID="mig_01HG7Y3..."
```

A migração passa por três fases, que a API expõe explicitamente:

1. **`copying`** — a cópia em massa. Lê cada linha da origem e grava no destino. Toma a maior parte do tempo. A origem continua totalmente operacional durante essa fase; leituras + gravações continuam normalmente.
2. **`streaming`** — quando a cópia termina, o destino começa a acompanhar o WAL (Postgres) ou o binlog (MySQL) da origem. Nesse ponto, o atraso normalmente é < 1 segundo.
3. **`cutover-ready`** — a cópia terminou e o streaming alcançou a origem. Você está pronto para o cutover.

## 4 · Acompanhar o progresso {#progress}

```bash
while true; do
  curl -s {{API_BASE_URL}}/v1/databases/migrations/$MIG_ID \
    -H "Authorization: Bearer $NIMBUS_KEY" \
    | jq '{ phase, rows_copied, rows_total, lag_seconds }'
  sleep 30
done
```

Fique de olho em:

- `phase: 'copying'` → `phase: 'streaming'` (cópia inicial concluída)
- `lag_seconds` caindo para 0–2 (alcançou a origem)
- `phase: 'cutover-ready'` (você pode fazer o cutover)

Para bancos de dados grandes (~100 GB+), inscreva-se no [webhook `database.migration.cutover_ready`](/docs/webhooks#events) para ser avisado quando chegar a hora.

## 5 · O cutover {#cutover}

Quando você chegar a `cutover-ready`, a janela de cutover é:

1. **Pause as gravações na origem.** Pare seu app ou coloque a instância RDS em somente leitura. Etapa crítica — qualquer coisa gravada na origem depois deste ponto não chega ao destino.
2. **Aguarde `lag_seconds: 0`.** Deve ser quase instantâneo, já que as gravações estão pausadas.
3. **Promova o destino:**

   ```bash
   curl -X POST {{API_BASE_URL}}/v1/databases/migrations/$MIG_ID/cut-over \
     -H "Authorization: Bearer $NIMBUS_KEY"
   ```

4. **Aponte seu app para a nova string de conexão.** Obtenha a nova string de conexão em `GET /v1/databases/$DB_ID/connection`.
5. **Retome o tráfego.** Agora seu app grava no novo cluster.

Tempo total das etapas 1–5: normalmente 20–40 segundos.

A chamada de promoção também é uma etapa de confirmação — até você fazê-la, o destino continua acompanhando a origem. Então, se algo der errado no meio do cutover, a instância RDS original continua sendo a fonte autoritativa; basta retomar o tráfego nela. Você pode executar a migração de novo a qualquer momento.

## 6 · Verificar {#verify}

Depois do cutover, faça uma consulta rápida para confirmar:

```bash
psql "postgresql://app:••••@{{DB_HOST_DEMO}}:5432/app?sslmode=verify-full" \
  -c "SELECT count(*) FROM users;"
```

Compare as contagens com os seus registros de antes da migração. Confira algumas linhas por amostragem.

## 7 · Remover o job de migração + desativar o RDS {#cleanup}

```bash
curl -X DELETE {{API_BASE_URL}}/v1/databases/migrations/$MIG_ID \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

O job de migração deixa de acompanhar a origem e libera seus recursos. O cluster de destino continua rodando normalmente; só a estrutura da migração é removida.

Desative o RDS do lado da AWS — faça um snapshot primeiro e depois exclua a instância. Mantenha o snapshot por uma semana como rede de segurança.

## Armadilhas comuns {#gotchas}

- **Sequências dessincronizadas.** A replicação lógica do Postgres não replica o avanço das sequências. Depois do cutover, execute `SELECT pg_catalog.setval(seq_name, max(id)) FROM ...` em cada sequência para avançá-las além do valor máximo da tabela correspondente.
- **Roles + permissões não são replicados.** Recrie-os no destino antes do cutover. Use `pg_dumpall --roles-only` (Postgres) ou equivalente.
- **Extensões não são replicadas.** Se a sua origem usa `pgvector`, `postgis` etc., ative-as no destino antes de iniciar a migração.
- **Não se esqueça do histórico do `pg_stat_statements`.** A replicação lógica não o copia. Execute `SELECT pg_stat_statements_reset()` no destino depois do cutover para que seu monitoramento parta de uma linha de base limpa.

## Próximos passos {#next-steps}

- [Referência de bancos de dados gerenciados](/docs/api/managed-databases) — todas as opções para o cluster de destino.
- [Postgres de produção em 10 minutos](/docs/guides/postgres-production) — a mesma configuração sem a migração.
- [Backups](/docs/api/backups) — agende backups diários + PITR de 7 dias no novo cluster.
