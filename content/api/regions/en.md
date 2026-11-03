---
title: Regions
description: The regions NimbusNexus serves, and how your session picks one.
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Regions

A NimbusNexus region is a geographic location with at least one availability zone. Every resource you create — VMs, volumes, buckets — lives in exactly one region.

## Current regions {#current}

Production serves one region today, in Frankfurt, Germany.

`GET /api/v1/account/datacenters` lists the regions, each with its `region_name`, a display `label` and `order`, and a `healthy` flag; `current` is the region your session is in. `GET /api/v1/account/rescope?region=<region_name>` switches the session to another region. The API's answer is authoritative.

## How to pick a region {#picking}

Three things matter:

1. **Latency to your users.** Pick the region closest to where most of your requests come from. Round-trip times below 50 ms feel snappy; above 200 ms feel sluggish even with good code.

2. **Latency to your dependencies.** If you call other services (databases, third-party APIs, your own infra), put the VM in the region nearest to them. Compute-to-storage round trips happen on every request; user-to-compute round trips happen once per page load.

3. **Data residency requirements.** GDPR / DSGVO / state-level data laws may pin where customer data can rest. Today's one region is in Frankfurt, Germany.

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — a VM is created in your session's current region.
- [Account overview](/docs/api/account-overview) — where the region list and the session switch are documented.
- [Region requests](/docs/api/region-requests) — ask for a region that isn't served yet.
