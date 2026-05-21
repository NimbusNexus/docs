---
title: Subscriptions
description: Plan tier, billing cycle, upgrade and downgrade endpoints.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: subscriptions
---

# Subscriptions

Your subscription is the plan tier + billing cycle + payment configuration that drives everything billable on the account. Plan tiers (free, starter, production, enterprise) determine support SLA, default quotas, included credit, and access to certain regions. Billing cycle (monthly, annual) sets the invoice cadence; annual billing carries a discount versus monthly.

Plan upgrades take effect immediately; downgrades take effect at the end of the current billing cycle to avoid mid-month proration disputes. Enterprise plans are negotiated and provisioned manually; the API supports up-to-production but routes enterprise requests to the sales contact.

## What's next {#next-steps}

- [Invoices](/docs/api/invoices) — what subscriptions produce.
- [Payment methods](/docs/api/payment-methods) — what's billed against the subscription.
- [Account overview](/docs/api/account-overview) — the broader account context.
