---
title: Payment methods
description: Saved cards, ACH accounts, and default-payment configuration.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: payment-methods
---

# Payment methods

Payment methods are the bank cards, ACH accounts, and (for enterprise) wire-transfer profiles attached to an account. One method is designated as the default — that's what gets charged on the monthly invoice. The others sit as fallbacks (we'll try them in order if the default fails).

Card data never touches NimbusNexus directly — payment-method creation routes through our PCI-compliant payment processor (Stripe today), and we store only the tokenized reference + display metadata (brand, last four, expiration). You don't need to worry about PCI scope on your end as long as you're using the API; raw card numbers never appear in any request to NimbusNexus.

## What's next {#next-steps}

- [Invoices](/docs/api/invoices) — what payment methods get charged for.
- [Subscriptions](/docs/api/subscriptions) — the plan-tier context.
- [Account overview](/docs/api/account-overview) — the billing-contact configuration.
