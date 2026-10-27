---
title: "Suscripciones"
description: "Plan, ciclo de facturación y endpoints para subir o bajar de plan."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: subscriptions
---

# Suscripciones

Tu suscripción es el tier del plan + el ciclo de facturación + la configuración de pago que determina todo lo facturable en la cuenta. Los tiers del plan (free, starter, production, enterprise) determinan el SLA de soporte, las cuotas por defecto, el crédito incluido y el acceso a ciertas regiones. El ciclo de facturación (mensual, anual) fija la periodicidad de las facturas; la facturación anual tiene un descuento respecto a la mensual.

Las subidas de plan se aplican de inmediato; las bajadas, al final del ciclo de facturación en curso, para evitar disputas por prorrateos a mitad de mes. Los planes Enterprise se negocian y se provisionan manualmente; la API admite hasta el plan Production, pero deriva las solicitudes de Enterprise al contacto de ventas.

## Próximos pasos {#next-steps}

- [Facturas](/docs/api/invoices) — lo que generan las suscripciones.
- [Métodos de pago](/docs/api/payment-methods) — a lo que se carga la suscripción.
- [Resumen de la cuenta](/docs/api/account-overview) — el contexto más amplio de la cuenta.
