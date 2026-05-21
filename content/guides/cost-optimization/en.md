---
title: Optimizing your monthly bill
description: The five highest-leverage things to do if your NimbusNexus invoice is bigger than you expected.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Optimizing your monthly bill

If your NimbusNexus bill is bigger than expected, in our experience 90 % of the overspend comes from the same five places. Walking through them in order takes about 30 minutes and typically saves 30–60 % of the invoice.

Order matters — the highest-leverage things first.

## 1 · Stopped VMs you forgot about {#stopped-vms}

Stopped VMs still cost ~10 % of their running cost (you're paying for the disk + reserved IP). Three months of a stopped `gp-8-32` is about as expensive as a month of running one.

Find them:

```bash
curl "{{API_BASE_URL}}/v1/vms?state=stopped" \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { id, name, stopped_at, size }'
```

For each one, decide:

- **Stopped < 1 week ago and you remember why** → leave alone, it's a rollback candidate.
- **Stopped > 2 weeks ago, can't remember why** → snapshot it (so you have the disk image), then `DELETE`.
- **Stopped > 1 month ago** → delete. Whatever was on it isn't a rollback candidate anymore.

```bash
# Snapshot first
curl -X POST {{API_BASE_URL}}/v1/snapshots \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"source_vm_id\": \"$VM_ID\", \"name\": \"archive-$(date +%Y-%m-%d)\" }"

# Then delete the VM
curl -X DELETE {{API_BASE_URL}}/v1/vms/$VM_ID \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

The snapshot is much cheaper than the stopped VM (snapshot storage is $0.04/GB; reserved IPs and reserved disk on a stopped VM is higher).

## 2 · Unattached floating IPs {#unattached-ips}

Unattached floating IPs cost $2.50/month each — the same as an attached-to-a-stopped-VM IP. The bill line item is small per-IP, but accounts that have been around a while accumulate them.

```bash
curl "{{API_BASE_URL}}/v1/floating-ips?state=detached" \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { id, ipv4, region, allocated_at }'
```

Release every one you don't have an active use for:

```bash
curl -X DELETE {{API_BASE_URL}}/v1/floating-ips/$IP_ID \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

If you might want the same IPv4 back later (because something's allowlisted it elsewhere), keep a record of which IPs were yours before you release. We don't reserve released IPs — they go back into the regional pool. There's no way to "freeze" an IP without keeping it allocated.

## 3 · Over-provisioned VMs {#over-provisioned}

A VM running at 5–10 % CPU all the time is paying 10× what it needs. Run `node_exporter` (or just check the dashboard's per-VM graph) and look for VMs whose 90-day P99 CPU is under ~30 %.

For each over-provisioned VM, the right move depends on traffic shape:

- **Steady low traffic** → resize down. `POST /v1/vms/$ID/resize` to a smaller tier. Takes ~30 seconds. Live-resize is supported within the same family (`gp-4-16` → `gp-2-8` works; `gp-4-16` → `co-4-8` requires a stop-resize-start because the architecture changes).
- **Bursty traffic** → consider compute-optimized (`co-` family) sizes; they have higher CPU/RAM ratios. Cheaper per-vCPU for CPU-bound workloads.
- **GPU VMs with nothing on the GPU** → resize off the `gx-` family entirely. GPU VMs are 5–10× more expensive; if you're not using the GPU, you're burning money.

## 4 · Object-storage class mismatch {#storage-class}

Object storage has three classes:

| Class | Storage price | Retrieval price | Use for |
|---|---|---|---|
| Standard | $0.013/GB-mo | Free | Hot data (read often) |
| Infrequent Access (IA) | $0.007/GB-mo | $0.005/GB | Warm data (read monthly) |
| Cold | $0.004/GB-mo | Higher per-class (Expedited, Standard, Bulk) | Archive (read rarely) |

Most accounts default to Standard for everything and never revisit. The leverage:

```bash
# What buckets do you have, and what class?
curl {{API_BASE_URL}}/v1/buckets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { name, region, storage_class, size_gb }'
```

For each bucket, look at the last access timestamp on the largest objects (the dashboard's "object explorer" shows this). Anything not read in the last month should be IA; anything not read in 6 months should probably be Cold.

You don't have to move per-object manually — set a lifecycle rule:

```bash
curl -X PUT {{API_BASE_URL}}/v1/buckets/$BUCKET/lifecycle \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {
        "id": "tier-warm",
        "filter": { "prefix": "archive/" },
        "transitions": [
          { "after_days": 30,  "storage_class": "infrequent-access" },
          { "after_days": 180, "storage_class": "cold" }
        ]
      }
    ]
  }'
```

This auto-tiers as data ages. Cheapest for "I produce this data once and rarely re-read it" workloads (logs, build artifacts, old reports).

## 5 · Snapshots you don't need anymore {#stale-snapshots}

Snapshots cost $0.04/GB-month — much cheaper than VM disk, but they accumulate fast if you take one nightly and never delete. A 200 GB snapshot kept for a year is $96.

```bash
curl "{{API_BASE_URL}}/v1/snapshots?older_than_days=180" \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { id, name, size_gb, created_at, source_vm_id }'
```

Three rules of thumb for snapshot retention:

- **Daily snapshots** of a production VM → keep 14, delete the rest.
- **Weekly snapshots** → keep 8 (two months).
- **Monthly snapshots** → keep 12 (one year). Beyond that, only keep the year-end ones.

Set up a [scheduled-backup policy](/docs/api/backups) with those retention rules baked in so this never grows unbounded again.

## Pricing model reminders {#reminders}

A few things that catch first-time customers:

- **In-region traffic between NimbusNexus resources is free.** Two VMs in `us-east-1` talking to each other don't pay egress. Cross-region traffic between NimbusNexus resources is also free (a deliberate differentiator from AWS where this is the most surprising line item).
- **Outbound traffic to the internet is $0.01/GB after the first 100 GB/month.** Compared to AWS (where it's $0.09/GB), this matters once you serve any non-trivial public-facing content.
- **Per-second billing for VMs.** A VM running for 90 seconds costs 1.5 minutes. No partial-hour rounding. Means short-lived workloads (CI runners, batch jobs) are genuinely cheap — don't over-engineer to "minimize runs" if the runs are short.
- **The starter credit is one-time.** New accounts get a credit; it doesn't replenish. If you're testing extensively, watch the dashboard's credit balance.

## Looking at the bill itself {#invoice}

The dashboard's billing page breaks down the invoice line items per resource per day. The "top 10 costs" filter is the right starting point if you don't know what's expensive yet — it's almost always one or two outsized line items, not a death-by-a-thousand-cuts pattern.

If you want the bill rendered as JSON:

```bash
curl {{API_BASE_URL}}/v1/billing/invoices/current \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

The response has per-resource cost projections for the rest of the month, so you can act on what's expensive *now* rather than discovering it at month-end.

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — `resize` for the over-provisioned-VM case.
- [Object storage](/docs/api/object-storage) — lifecycle rules in full.
- [Snapshots](/docs/api/snapshots) and [Backups](/docs/api/backups) — retention policy syntax.
- [Quotas](/docs/api/quotas) — the per-project limit table (separate from billing but related).
