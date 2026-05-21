---
title: Invoices
description: Monthly invoices — list, fetch, view the breakdown.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: invoices
---

# Invoices

Invoices are generated monthly, on the first of the following month, covering all usage in the prior calendar month. Each invoice is itemized by resource and by day, so you can trace any line back to specific VMs / volumes / buckets / databases.

This endpoint provides programmatic access to the same data the dashboard shows. Use cases: feeding invoice line items into your own cost-attribution system, archiving invoices for tax purposes, reconciling against your purchase-order ledger.

Invoices are also available as PDF — the same format used for tax-deduction filing in most jurisdictions. The JSON shape is the canonical source; the PDF is rendered from the JSON.

## What's next {#next-steps}

- [Payment methods](/docs/api/payment-methods) — what invoices are charged against.
- [Subscriptions](/docs/api/subscriptions) — the plan / billing-cycle context.
- [Pricing data](/docs/api/pricing-data) — the per-resource prices that produce the invoice totals.
