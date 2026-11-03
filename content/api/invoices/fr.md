---
title: "Facturation"
description: "Soldes, frais non réglés, crédit promotionnel et coordonnées de facturation de votre espace de travail."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: invoices
---

# Facturation

La facturation se fait par espace de travail. Ces endpoints lisent la situation du compte de l’espace de travail et tiennent à jour ses coordonnées de facturation :

- `GET /api/v1/billing/public/balances` — les frais postpayés restant dus, le crédit promotionnel disponible et le solde des fonds prépayés, en un seul instantané.
- `GET /api/v1/billing/public/accrued_charges` — le total facturé jusqu’à présent qui n’a pas encore été réglé.
- `GET /api/v1/billing/public/cash_balance` — le solde des fonds prépayés, avec la date de sa dernière modification.
- `GET /api/v1/billing/public/promotion_grants` — le crédit promotionnel actif, avec ce qui reste de chaque octroi et sa date d’expiration.
- `GET` et `PATCH /api/v1/billing/public/billing_info` — l’adresse de facturation, le nom de la société et les adresses e-mail qui reçoivent les relevés et les reçus.

Les factures elles-mêmes ne sont pas disponibles via l’API.

Ces appels exigent une session connectée, transmise par `Authorization: Bearer` ou par le cookie de session. Une clé API ne peut pas les effectuer.

## Étapes suivantes {#next-steps}

- [Moyens de paiement](/docs/api/payment-methods) — les cartes qui rechargent le solde prépayé.
- [Données tarifaires](/docs/api/pricing-data) — les tarifs par ressource à l’origine des frais.
