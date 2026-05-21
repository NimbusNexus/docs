---
title: Pricing data
description: Programmatic access to the canonical price list. Read-only.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: pricing-data
---

# Pricing data

The pricing-data endpoint is a read-only feed of the canonical NimbusNexus price list — VM sizes by family, block storage classes, object storage tiers, egress rates, managed-database engine multipliers, all of it. The same data drives the pricing pages on the marketing site and the cost projections in the dashboard.

Use cases: integrating real-time cost estimates into your provisioning workflow (show "this VM will cost $X/month" before the user clicks Launch), building internal cost-attribution tooling, or just keeping your own spreadsheet of "what does NimbusNexus charge for X right now."

Prices are quoted in USD and update whenever we adjust the published price list (rare — typically once or twice a year, and we email 30 days ahead of any increase).

## What's next {#next-steps}

- [Invoices](/docs/api/invoices) — what prices produce in practice.
- [Optimizing your monthly bill](/docs/guides/cost-optimization) — the strategy guide for getting your bill down.
- The [pricing page on the marketing site]({{BASE_URL}}/pricing) — the human-readable version of this data.
