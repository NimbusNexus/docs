---
title: Billing
description: Your workspace's balances, unsettled charges, promotional credit and billing details.
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: invoices
---

# Billing

Billing is per workspace. These endpoints read where the workspace's account stands, and keep its billing details:

- `GET /api/v1/billing/public/balances` — outstanding postpaid charges, available promotional credit and the prepaid cash balance, in one snapshot.
- `GET /api/v1/billing/public/accrued_charges` — the total charged so far that hasn't been settled yet.
- `GET /api/v1/billing/public/cash_balance` — the prepaid cash balance, with when it last changed.
- `GET /api/v1/billing/public/promotion_grants` — active promotional credit, with what's left of each grant and when it expires.
- `GET` and `PATCH /api/v1/billing/public/billing_info` — the billing address, the company name, and the email addresses that get statements and receipts.

Invoices themselves aren't available through the API.

These calls take a signed-in session, sent as `Authorization: Bearer` or the session cookie. An API key can't make them.

## What's next {#next-steps}

- [Payment methods](/docs/api/payment-methods) — the cards that top up the prepaid balance.
- [Pricing data](/docs/api/pricing-data) — the per-resource prices behind the charges.
