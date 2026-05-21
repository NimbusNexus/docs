---
title: Run a production Postgres in 10 minutes
description: Provision a managed Postgres with HA, backups, and zero-downtime upgrades — three API calls.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Run a production Postgres in 10 minutes

By the end of this guide you'll have a managed Postgres 16 cluster with:

- Three nodes (one primary, two replicas) across availability zones
- Automated daily backups + 7-day point-in-time recovery
- Connection pooler enabled
- TLS-only access from an allowlisted IP
- A connection string ready to drop into your app

Total time: about 10 minutes (mostly the cluster provisioning step).

## Prereqs {#prereqs}

- A NimbusNexus account with an API key. See [Quickstart](/docs/quickstart) if you don't have one yet.
- The region you want — Virginia (`us-east-1`), Los Angeles (`us-west-1`), Frankfurt (`eu-central-1`), or Singapore (`ap-southeast-1`).
- `psql` installed locally if you want to connect at the end.

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · Create the cluster {#create}

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

What each option does:

- `tier: 'production-4-16'` — 4 vCPU, 16 GB RAM, 200 GB SSD. Right sizing for low-to-mid traffic apps (~1,000 QPS). See [the tier table](/docs/api/managed-databases) for the full size list.
- `high_availability: true` — primary + two replicas across AZs. Adds ~80 % to the cost; subtracts a lot of pager incidents.
- `backup_retention_days: 7` — daily full backup + continuous WAL streaming, restorable to any point in the last 7 days.
- `connection_pooler: true` — PgBouncer enabled on port 6432. Use this from any app that has connection-pool sizing under your control (most do).
- `tls_required: true` — connections without TLS get rejected at the listener. Always set this.

The response includes the cluster `id`. Save it:

```bash
export DB_ID="db_01HG7..."
```

## 2 · Wait for it to be ready {#wait}

Provisioning takes 4–7 minutes. Poll until `state` is `running`:

```bash
while true; do
  state=$(curl -s {{API_BASE_URL}}/v1/databases/$DB_ID \
    -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.state')
  echo "state: $state"
  [ "$state" = "running" ] && break
  sleep 10
done
```

Or, if you'd rather get a webhook, [subscribe to `database.created`](/docs/webhooks#events) and skip the polling loop.

## 3 · Allowlist your IP {#allowlist}

By default the cluster accepts connections from any source the cluster can route to. For production you want an explicit allowlist:

```bash
MY_IP=$(curl -s ifconfig.me)/32

curl -X POST {{API_BASE_URL}}/v1/databases/$DB_ID/allowlist \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"cidr\": \"$MY_IP\", \"description\": \"my laptop\" }"
```

Add an entry per CIDR you want to let in. For a VM that needs to reach this DB, add the VM's floating-IP CIDR (or its outbound NAT CIDR if behind one). Allowlist entries are stateful — removing one cuts new connections; existing connections stay up until they idle out or you restart the cluster.

## 4 · Connect {#connect}

Fetch the connection details:

```bash
curl -s {{API_BASE_URL}}/v1/databases/$DB_ID/connection \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Response:

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

Download the root cert once:

```bash
curl -o ~/.postgresql/nn-root.crt {{BASE_URL}}/ca-certs/nimbusnexus-root.pem
```

Connect:

```bash
psql "postgresql://app:••••@{{DB_HOST_DEMO}}:6432/app?sslmode=verify-full&sslrootcert=~/.postgresql/nn-root.crt"
```

Use port `6432` (pooler) from app servers; port `5432` only for admin/migration tools that need direct access to the primary (e.g. `pg_dump`, `pg_restore`, schema migration tools that take advisory locks).

`sslmode=verify-full` checks the cert against the hostname — the right default. `verify-ca` is acceptable too; `require` is acceptable for non-production but skips the hostname check (and therefore a class of MITM). Never use `prefer` or `disable`.

## What you've done {#summary}

You now have a production-quality Postgres cluster:

- Three nodes, automated failover
- Daily backups + 7-day PITR
- Connection-pooler-enabled (port 6432)
- TLS-required, allowlisted
- Cost: about $200/month for the `production-4-16` tier with HA + 7-day backups in us-east-1

Same shape works for MySQL, MongoDB, Redis, Kafka, OpenSearch — change `engine`, change `engine_version`, the rest of the options carry over with engine-appropriate defaults.

## Next steps {#next-steps}

- [Managed databases reference](/docs/api/managed-databases) — every option for the create call, every endpoint for managing the cluster.
- [AWS RDS migration guide](/docs/guides/migrate-from-rds) — same setup, with a one-shot data migration from an existing RDS cluster.
- [Webhooks](/docs/webhooks) — wire up `database.created`, `database.upgrade_completed`, `backup.completed` events to your monitoring.
- [Snapshots](/docs/api/snapshots) — on-demand point-in-time copies for pre-deploy safety checks.
