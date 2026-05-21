---
title: Managed databases
description: Managed Postgres, MySQL, MongoDB, Redis, Kafka, and OpenSearch — provision, snapshot, restore.
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Managed databases

NimbusNexus runs six database engines as managed services. We handle the operational work — failover, backups, minor-version upgrades, OS patching — and you get a connection string and the engine's native protocol on the other end. **No proprietary wire format, no special client library required**: connect with `psql`, `mongo`, the official Kafka client, etc.

## Engines {#engines}

| Engine       | What it's for                                                                           | Starting size |
| ------------ | --------------------------------------------------------------------------------------- | ------------- |
| `postgres`   | Transactional workload, the safe default for "I need a database."                       | `db-1-4`      |
| `mysql`      | When the app or team is already on MySQL. PostgreSQL is the right default for new work. | `db-1-4`      |
| `mongodb`    | Document workload, dynamic schemas, replica-set semantics.                              | `db-2-8`      |
| `redis`      | Cache, session store, pub/sub, queues. No SQL surface.                                  | `db-1-2`      |
| `kafka`      | Event streaming, log aggregation, durable pub/sub. Three brokers minimum.               | `db-2-8` × 3  |
| `opensearch` | Full-text search, log analytics.                                                        | `db-4-16`     |

Size codes follow the same convention as VMs (`db-<vCPU>-<RAM_GB>`), with a separate price multiplier per engine — Redis is cheaper than Postgres on the same hardware because there's no on-disk WAL; MongoDB is more expensive because of replica-set licensing overhead.

## Lifecycle {#lifecycle}

Databases move through five states:

- `provisioning` — instance(s) coming up. 60–120 seconds for single-node engines (Postgres, MySQL, Redis), 90–180 seconds for replicated ones (MongoDB, Kafka, OpenSearch).
- `running` — accepting connections on the published connection string.
- `maintenance` — applying a minor upgrade or patch. Connections survive; the database is briefly unavailable during the cutover (typically <5 seconds for Postgres/MySQL, longer for Kafka).
- `stopping` → `stopped` — paused. You stop being billed for compute; storage still bills. Restart at any time.
- `terminated` — destroyed.

State is reported in every GET response under the `state` field. Long-running transitions (initial provision, version upgrade) report progress in an embedded `operation` object — see [Conventions](/docs/conventions).

## Backups and snapshots {#backups}

Two backup mechanisms run side by side:

- **Continuous WAL backup** (Postgres, MySQL only). Default-on. We ship the write-ahead log to object storage every ~5 seconds and can restore to any moment in the last 7 days. **Point-in-time recovery**.
- **On-demand snapshots** (every engine). Triggered by `POST /v1/databases/{id}/snapshots`. Consistent (no I/O quiescing required), stored in object storage, restorable to a new database in the same region.

Snapshots are independent of the source database — destroying the source preserves the snapshots. Retention is 7 days by default; bump it via the dashboard or by passing `retention_days` on the snapshot request.

## Connections {#connections}

Each database's GET response includes a `connection` object:

```json
{
  "connection": {
    "host": "{{DB_HOST_DEMO}}",
    "port": 5432,
    "database": "main",
    "username": "nimbus",
    "password_secret": "secret://projects/.../database-passwords/db_01H8FZ...",
    "ssl": "require"
  }
}
```

The password is referenced as a secret URL, not inlined — fetch it from `GET /v1/secrets/{secret-id}` and cache it for the connection lifetime. This keeps password values out of any logs that capture full database records.

All databases enforce TLS for client connections. Self-signed certs are not accepted; we publish the CA bundle at `/v1/databases/ca-bundle.pem`. Postgres / MySQL clients should use `sslmode=verify-full` and point `sslrootcert` at the bundle.

## Versions and upgrades {#versions}

- **Minor versions** auto-apply during the weekly maintenance window (Sunday 02:00–04:00 in the database's region, configurable). Zero-downtime for Postgres/MySQL with continuous WAL; replica-set engines see a brief failover.
- **Major versions** require an explicit `POST /v1/databases/{id}/upgrade` call. We test the upgrade against your data on a snapshot before flipping the primary, so a failed upgrade is a rollback, not a corruption.

Major versions are supported for at least 24 months past upstream release. We post end-of-life timelines in the changelog with at least 90 days' notice.

## Pricing notes {#pricing}

- Compute: per-second, per-vCPU-equivalent, with an engine multiplier (see [pricing page]({{BASE_URL}}/managed-databases)).
- Storage: \$0.18/GB-month (Performance NVMe, the default).
- Backups: \$0.04/GB-month for the snapshot tier.
- Cross-region replication (where supported): metered at standard inter-region egress (\$0.005/GB).
- No per-connection fee, no IOPS-billed fee, no charge for failover events.

The headline starting price is \$19/mo for a `db-1-4` Postgres in Virginia — that's a 1 vCPU / 4 GB / 50 GB instance, the smallest size that's reasonable for production workloads.

## What's next {#next-steps}

- [Authentication](/docs/authentication) for the bearer-token pattern every endpoint shares.
- [Conventions](/docs/conventions) for how operations, pagination, errors work.
- [Block storage](/docs/api/block-storage) — if you're running your own database on a VM, this is the disk it lives on.
- The **Postgres / MySQL / Mongo / Redis: when to reach for which one** article in [Resources](/resources/postgres-mysql-mongo-redis-when-to-use) — engine selection guide.
