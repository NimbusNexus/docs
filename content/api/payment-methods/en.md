---
title: Payment methods
description: Saved cards, and the default card for top-ups.
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: payment-methods
---

# Payment methods

Payment methods are the cards your workspace has saved. One of them is the default for top-ups, which add funds to the workspace's prepaid balance.

- `POST /api/v1/payment/payment_methods/setup-intent` starts saving a card. It returns a Stripe SetupIntent `client_secret`, and the card is confirmed with Stripe, 3-D Secure included.
- `GET /api/v1/payment/payment_methods/` lists the saved cards, with brand, last four digits, expiry, and which one is the default.
- `POST /api/v1/payment/payment_methods/{payment_method_id}/set_default` makes a card the default for top-ups, and `DELETE /api/v1/payment/payment_methods/{payment_method_id}` removes one.
- `POST /api/v1/payment/payment_methods/{payment_method_id}/add_funds` charges a card to top up the balance. When the bank asks for confirmation, the result is `requires_action` with a `client_secret` to confirm; `POST /api/v1/payment/payment_methods/topups/{attempt_id}/sync` then picks up the outcome.

Card data never touches NimbusNexus directly — payment-method creation routes through our PCI-compliant payment processor (Stripe today), and we store only the tokenized reference + display metadata (brand, last four, expiration). You don't need to worry about PCI scope on your end as long as you're using the API; raw card numbers never appear in any request to NimbusNexus.

These calls take a signed-in session, sent as `Authorization: Bearer` or the session cookie. An API key can't make them.

## What's next {#next-steps}

- [Billing](/docs/api/invoices) — the balances these cards top up, and your billing details.
- [Pricing data](/docs/api/pricing-data) — the per-resource prices behind the charges.
