---
title: Migrate from AWS RDS
description: Live-migrate a Postgres or MySQL database from RDS with zero data loss and ~30s downtime.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Migrate from AWS RDS

This guide moves a production Postgres or MySQL database from AWS RDS to NimbusNexus managed databases using logical replication. The pattern: do the bulk copy live (no downtime), stream ongoing changes via WAL/binlog, then cut over with a brief connection-pause.

Expected downtime: **~30 seconds** for the cutover. Total elapsed time: depends on data size (8–30 minutes for the initial copy at typical sizes).

Works for:

- Postgres 12+
- MySQL 8.0+

## Prereqs {#prereqs}

On the AWS side:

- The RDS instance must have logical replication enabled (`rds.logical_replication = 1` for Postgres; `binlog_format = ROW` for MySQL).
- A replication-capable user (or you can use the master user).
- Inbound network access from NimbusNexus IPs (we'll get the specific CIDRs in a moment).
- Recent backup of the RDS instance. Just in case.

On the NimbusNexus side:

- An API key.
- Decided on a region. Latency between the migration host and the source RDS instance matters — pick the closest region to the RDS region (e.g. `us-east-1` for RDS in `us-east-1`).

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · Provision the target cluster {#provision}

Create the destination cluster with the same engine + version as the source:

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

Match the source's instance class as closely as possible. Going significantly smaller risks the target falling behind during the WAL/binlog streaming phase. You can resize after the migration completes.

Save the cluster ID:

```bash
export DB_ID="db_01HG7..."
```

Wait for `state: running` (4–7 minutes).

## 2 · Allowlist NimbusNexus IPs on RDS {#allowlist}

Get the egress CIDRs for our migration workers in your region:

```bash
curl {{API_BASE_URL}}/v1/databases/migration-source-cidrs?region=us-east-1 \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Response is a list of `/24` blocks. Add them to your RDS security group's inbound rules on the Postgres or MySQL port. Restrict to those CIDRs only — don't open `0.0.0.0/0`.

## 3 · Kick off the migration {#kick-off}

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

The response includes a `migration_id`:

```bash
export MIG_ID="mig_01HG7Y3..."
```

The migration runs in three phases the API surfaces explicitly:

1. **`copying`** — the bulk copy. Reads every row from the source, writes to the target. Takes most of the time. The source is fully operational during this; reads + writes continue normally.
2. **`streaming`** — once the copy is done, the target starts following WAL (Postgres) or binlog (MySQL) from the source. Lag at this point is typically < 1 second.
3. **`cutover-ready`** — copy is done, streaming has caught up. You're ready to cut over.

## 4 · Watch progress {#progress}

```bash
while true; do
  curl -s {{API_BASE_URL}}/v1/databases/migrations/$MIG_ID \
    -H "Authorization: Bearer $NIMBUS_KEY" \
    | jq '{ phase, rows_copied, rows_total, lag_seconds }'
  sleep 30
done
```

Watch for:

- `phase: 'copying'` → `phase: 'streaming'` (initial copy done)
- `lag_seconds` dropping to 0–2 (caught up)
- `phase: 'cutover-ready'` (you can cut over)

For sizable databases (~100 GB+), subscribe to the [`database.migration.cutover_ready` webhook](/docs/webhooks#events) so you get pinged when it's time.

## 5 · The cutover {#cutover}

Once you're at `cutover-ready`, the cutover window is:

1. **Pause writes on the source.** Stop your app, or set the RDS instance to read-only. Critical step — anything that writes to the source after this point won't make it to the target.
2. **Wait for `lag_seconds: 0`.** Should be near-instant since writes are paused.
3. **Promote the target:**

   ```bash
   curl -X POST {{API_BASE_URL}}/v1/databases/migrations/$MIG_ID/cut-over \
     -H "Authorization: Bearer $NIMBUS_KEY"
   ```

4. **Repoint your app at the new connection string.** Pull the new connection string from `GET /v1/databases/$DB_ID/connection`.
5. **Resume traffic.** Your app now writes to the new cluster.

Total elapsed during steps 1–5: typically 20–40 seconds.

The promote call is also a confirmation step — until you make it, the target continues following the source. So if something goes wrong mid-cutover, the original RDS instance is still authoritative; just resume traffic there. You can re-run the migration anytime.

## 6 · Verify {#verify}

After the cutover, query something quick to confirm:

```bash
psql "postgresql://app:••••@{{DB_HOST_DEMO}}:5432/app?sslmode=verify-full" \
  -c "SELECT count(*) FROM users;"
```

Compare counts against your records from before the migration. Spot-check a few rows.

## 7 · Tear down the migration job + decommission RDS {#cleanup}

```bash
curl -X DELETE {{API_BASE_URL}}/v1/databases/migrations/$MIG_ID \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

The migration job stops following the source and releases its resources. The target cluster keeps running normally; only the migration plumbing goes away.

Decommission RDS on AWS's side — snapshot first, then delete the instance. Keep the snapshot for a week as a safety net.

## Common gotchas {#gotchas}

- **Sequences out of sync.** Postgres logical replication doesn't replicate sequence advances. After cutover, run `SELECT pg_catalog.setval(seq_name, max(id)) FROM ...` on every sequence to advance them past the max value in the corresponding table.
- **Roles + permissions don't replicate.** Recreate them on the target before the cutover. Use `pg_dumpall --roles-only` (Postgres) or equivalent.
- **Extensions don't replicate.** If your source uses `pgvector`, `postgis`, etc., enable them on the target before starting the migration.
- **Don't forget `pg_stat_statements` history.** Logical replication doesn't copy this. Run `SELECT pg_stat_statements_reset()` on the target after cutover so your monitoring sees a clean baseline.

## Next steps {#next-steps}

- [Managed databases reference](/docs/api/managed-databases) — every option for the destination cluster.
- [Run a production Postgres in 10 minutes](/docs/guides/postgres-production) — the same setup without the migration.
- [Backups](/docs/api/backups) — schedule daily backups + 7-day PITR on the new cluster.
