---
title: "Facturación"
description: "Saldos, cargos pendientes, crédito promocional y datos de facturación de tu workspace."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: invoices
---

# Facturación

La facturación es por workspace. Estos endpoints leen la situación de la cuenta del workspace y mantienen sus datos de facturación:

- `GET /api/v1/billing/public/balances` — los cargos pospago pendientes, el crédito promocional disponible y el saldo prepago en efectivo, en una sola instantánea.
- `GET /api/v1/billing/public/accrued_charges` — el total cargado hasta ahora que aún no se ha liquidado.
- `GET /api/v1/billing/public/cash_balance` — el saldo prepago en efectivo, con la fecha de su último cambio.
- `GET /api/v1/billing/public/promotion_grants` — el crédito promocional activo, con lo que queda de cada concesión y cuándo caduca.
- `GET` y `PATCH /api/v1/billing/public/billing_info` — la dirección de facturación, el nombre de la empresa y las direcciones de email que reciben los extractos y los recibos.

Las facturas en sí no están disponibles a través de la API.

Estas llamadas necesitan una sesión iniciada, enviada como `Authorization: Bearer` o como la cookie de sesión. Una clave de API no puede hacerlas.

## Próximos pasos {#next-steps}

- [Métodos de pago](/docs/api/payment-methods) — las tarjetas que recargan el saldo prepago.
- [Datos de precios](/docs/api/pricing-data) — los precios por recurso que hay detrás de los cargos.
