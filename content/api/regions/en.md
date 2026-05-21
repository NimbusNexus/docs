---
title: Regions
description: Geographic locations NimbusNexus serves, with live + pre-launch status.
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Regions

A NimbusNexus region is a geographic location with at least one availability zone. Every resource you create — VMs, managed databases, volumes, buckets — lives in exactly one region. Cross-region operations (replication, failover, traffic between resources) work but are explicit and metered.

## Current regions {#current}

| Code             | Location        | Status                 |
| ---------------- | --------------- | ---------------------- |
| `us-east-1`      | Virginia, US    | Live                   |
| `us-west-1`      | Los Angeles, US | Live                   |
| `eu-central-1`   | Frankfurt, DE   | Live                   |
| `ap-southeast-1` | Singapore       | Pre-launch (~2 months) |

The canonical list is also served at `GET /v1/regions`; the table above is illustrative. When you read this page, the API response is authoritative.

## How to pick a region {#picking}

Three things matter:

1. **Latency to your users.** Pick the region closest to where most of your requests come from. Round-trip times below 50 ms feel snappy; above 200 ms feel sluggish even with good code.

2. **Latency to your dependencies.** If you call other services (databases, third-party APIs, your own infra), put the VM in the region nearest to them. Compute-to-storage round trips happen on every request; user-to-compute round trips happen once per page load.

3. **Data residency requirements.** GDPR / DSGVO / state-level data laws may pin where customer data can rest. The Frankfurt region (`eu-central-1`) is the EU-resident option; `us-east-1` and `us-west-1` are both US-resident. We don't replicate data across regions without your explicit request.

If your users are global, **deploy to multiple regions**. A common pattern is `us-east-1` for Americas + `eu-central-1` for EMEA + `ap-southeast-1` for APAC, with DNS-based routing (latency-based, geolocation-based, or a CDN in front).

## Pre-launch regions {#preview}

Regions in `status: 'preview'` are accepting workloads ahead of general availability. Concretely:

- They accept all the same API calls as live regions.
- Pricing matches live regions.
- The SLA does **not** apply during preview — incidents may still cause outages while we burn in the region.
- General availability typically lands ~2 months after preview opens. We'll email account admins before flipping a region to `live`.

Singapore (`ap-southeast-1`) is the current preview region.

## What's next {#next-steps}

- See [Virtual machines](/docs/api/vms) for how to create a VM in a specific region.
- See [Managed databases](/docs/api/managed-databases) for region-specific database availability (Kafka and OpenSearch trail VM/Postgres availability by ~30 days in new regions).
- For multi-region architectures with replication, see the **Multi-region failover** guide (coming soon).
