---
title: "Métodos de pago"
description: "Tarjetas guardadas, cuentas ACH y configuración del método de pago por defecto."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: payment-methods
---

# Métodos de pago

Los métodos de pago son las tarjetas bancarias, las cuentas ACH y (en Enterprise) los perfiles de transferencia bancaria asociados a una cuenta. Uno de los métodos se designa como el método por defecto — es al que se carga la factura mensual. Los demás quedan como alternativas (los probamos en orden si falla el método por defecto).

Los datos de las tarjetas nunca pasan directamente por NimbusNexus — la creación de métodos de pago pasa por nuestro procesador de pagos, que cumple con PCI (hoy, Stripe), y solo guardamos la referencia tokenizada + los metadatos de visualización (marca, últimos cuatro dígitos, caducidad). No tienes que preocuparte del alcance de PCI por tu parte mientras uses la API; los números de tarjeta en claro nunca aparecen en ninguna petición a NimbusNexus.

## Próximos pasos {#next-steps}

- [Facturas](/docs/api/invoices) — lo que se cobra a los métodos de pago.
- [Resumen de la cuenta](/docs/api/account-overview) — la configuración del contacto de facturación.
