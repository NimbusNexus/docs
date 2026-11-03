---
title: Pricing data
description: Programmatic access to the canonical price list. Read-only.
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: pricing-data
---

# Pricing data

The pricing-data endpoints are a read-only feed of what NimbusNexus charges, one endpoint per kind of resource:

- `GET /api/v1/pricing/vm` — VM sizes. `architecture` and `vm_class` are required; `cpu` and `ram` narrow the list.
- `GET /api/v1/pricing/storage` — block storage, for one `volume_type`.
- `GET /api/v1/pricing/port`, `/api/v1/pricing/floating_ip` and `/api/v1/pricing/image` — network ports, floating IPs and image storage.
- `GET /api/v1/pricing/bandwidth` — outbound bandwidth.

Each price comes with its billing period: once, hourly, daily, monthly or yearly. You don't need to sign in to read them. A caller scoped to one of your projects sees the prices that apply to your workspace; anyone else sees the list prices.

Use cases: integrating real-time cost estimates into your provisioning workflow (show "this VM will cost $X/month" before the user clicks Launch), building internal cost-attribution tooling, or just keeping your own spreadsheet of "what does NimbusNexus charge for X right now."

Prices are quoted in USD.

## What's next {#next-steps}

- [Billing](/docs/api/invoices) — your balances and the charges not yet settled.
- [Optimizing your monthly bill](/docs/guides/cost-optimization) — the strategy guide for getting your bill down.
- The [pricing page on the marketing site]({{BASE_URL}}/pricing) — the human-readable version of this data.
