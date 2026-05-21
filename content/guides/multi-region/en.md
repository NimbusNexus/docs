---
title: Multi-region failover
description: DNS-level failover across two regions with health-checked routing. ~30s RTO.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Multi-region failover

Floating IPs are region-scoped — they can't move between regions. For cross-region failover (whole-region outage, regional latency degradation), the right primitive is DNS-level routing with health checks. Latency-based steering routes each user to their nearest healthy region; on a regional failure, the DNS layer takes that region out of rotation.

Target RTO with this setup: **20–60 seconds** depending on TTL and how quickly your DNS resolvers re-query.

## What you'll set up {#overview}

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

DNS resolves to whichever region is closer to the resolver. If a region fails its health check, DNS stops returning that region's IP until it recovers.

## Prereqs {#prereqs}

- Two VMs in different regions, each behind a [floating IP](/docs/api/floating-ips).
- Your application running on both VMs, ready to serve traffic.
- A database or stateful store that exists in both regions, with replication between them. For Postgres, [migrate-from-RDS-style logical replication](/docs/guides/migrate-from-rds) is the same primitive. For Redis, mirror cache misses; for object storage, use [cross-region replication](/docs/api/object-storage#cross-region).
- A DNS zone hosted on NimbusNexus DNS (or any DNS provider that supports health-checked record sets — Route53, Cloudflare, etc.).
- A health-check endpoint that genuinely verifies your application can serve traffic (not just `200 OK` on `/healthz`).

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export ZONE_ID="zone_01HG7..."
export EAST_IP_ID="ip_01HG7Y3..."      # floating IP in us-east-1
export WEST_IP_ID="ip_01HG7Y4..."      # floating IP in eu-central-1
```

## 1 · Create the multi-value record set {#record-set}

Add an A record set with both regions' IPs, latency-routed:

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

Key fields:

- `routing_policy: 'latency'` — DNS resolvers receive whichever IP corresponds to the geographically closest region. Alternatives: `'weighted'` (percentage split), `'failover'` (primary/secondary, never round-robin), `'geo'` (route by client country).
- `ttl: 60` — 60-second TTL. Lower TTL = faster failover (resolvers re-query sooner) at the cost of more DNS queries. For a service with high availability needs, 60 is right; for lower-SLA setups, 300 is fine.

## 2 · Add health checks {#health-checks}

Each value in the record set gets a health check. Failed checks remove that value from rotation:

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

Repeat for `value_index: 1` (the second region). What each field does:

- `interval_seconds: 10` — check every 10 seconds.
- `failure_threshold: 3` — three consecutive failures before considering the value down. Combined with `interval_seconds`, that's 30 seconds before a region drops out — slightly above the network-flake threshold, well below "we're noticing in PagerDuty already."
- `success_threshold: 2` — two consecutive successes before considering the value back up. Prevents thrashing during a flaky recovery.

The health-check endpoint matters. Don't make it `return 200 OK` unconditionally — that defeats the point. Make it actually check downstream dependencies (database connection, cache, the queue) so it fails when the application would fail.

## 3 · Test it {#test}

Force a "failure" by blocking the health-check probe on one region:

```bash
# On the us-east-1 VM, drop traffic from the health-check source CIDR
sudo iptables -A INPUT -s <healthcheck-cidr> -j DROP
```

(Get the health-check source CIDRs from `GET /v1/dns/healthcheck-source-cidrs`.)

Within 30 seconds, the record set should stop returning the us-east-1 IP:

```bash
dig +short app.example.com
# Should return only the eu-central-1 IP for the next several seconds
```

Reverse the iptables rule to restore the region. Within 20 seconds (`2 * interval_seconds`), it should return to rotation.

## 4 · Database replication {#db}

The DNS layer handles where traffic lands; the data layer is harder. The patterns:

**For read-mostly workloads:**

- Primary DB in one region, read-replica in the other.
- App reads from the local region (replica when in the secondary region).
- Writes always go to the primary (so the secondary region has a higher write latency).
- On primary-region failure: promote the replica to primary, fail over reads + writes to the new primary.

**For write-heavy workloads with multi-master tolerance:**

- Use a database that supports active-active replication (CockroachDB, YugabyteDB).
- Both regions read + write locally; conflicts resolved by the engine.
- More complex to operate; only justified when single-master write latency is a real problem.

**For cache and queue:**

- Cache: assume cold cache after failover. Most apps recover within minutes; the SLA hit is tolerable.
- Queue: keep queues per-region; the application accepts that a regional queue may be unavailable until the region recovers.

NimbusNexus doesn't yet ship a multi-region active-active database product. For now, manage replication yourself via logical replication (Postgres), binlog (MySQL), or change streams (MongoDB).

## What this isn't {#not}

- **Not active-active failover for state**: writes still concentrate on one primary. The DNS layer steers users; the database tier is still single-master most of the time.
- **Not transparent to clients**: TCP connections to the failed region's IP get reset; clients reconnect (most HTTP clients handle this fine; some long-polling or SSE clients need a retry handler).
- **Not zero RTO**: 20–60 seconds is the floor at TTL = 60. Lower TTL helps but at the cost of more DNS query volume.

## Next steps {#next-steps}

- [DNS zones](/docs/api/dns-zones) — the zone API the record set lives in.
- [DNS records](/docs/api/dns-records) — every routing policy + the field semantics.
- [Floating IPs](/docs/api/floating-ips) — the within-region failover primitive this builds on.
- [Blue/green deploys](/docs/guides/blue-green) — same idea, within a region.
