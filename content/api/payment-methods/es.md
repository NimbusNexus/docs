---
title: "Métodos de pago"
description: "Tarjetas guardadas y la tarjeta por defecto para las recargas."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: payment-methods
---

# Métodos de pago

Los métodos de pago son las tarjetas que tu workspace tiene guardadas. Una de ellas es la tarjeta por defecto para las recargas, que añaden fondos al saldo prepago del workspace.

- `POST /api/v1/payment/payment_methods/setup-intent` empieza a guardar una tarjeta. Devuelve el `client_secret` de un SetupIntent de Stripe, y la tarjeta se confirma con Stripe, incluido 3-D Secure.
- `GET /api/v1/payment/payment_methods/` lista las tarjetas guardadas, con la marca, los últimos cuatro dígitos, la caducidad y cuál es la tarjeta por defecto.
- `POST /api/v1/payment/payment_methods/{payment_method_id}/set_default` convierte una tarjeta en la tarjeta por defecto para las recargas, y `DELETE /api/v1/payment/payment_methods/{payment_method_id}` borra una.
- `POST /api/v1/payment/payment_methods/{payment_method_id}/add_funds` hace un cargo en una tarjeta para recargar el saldo. Cuando el banco pide una confirmación, el resultado es `requires_action` con un `client_secret` con el que confirmar; después, `POST /api/v1/payment/payment_methods/topups/{attempt_id}/sync` recoge el resultado.

Los datos de las tarjetas nunca pasan directamente por NimbusNexus — la creación de métodos de pago pasa por nuestro procesador de pagos, que cumple con PCI (hoy, Stripe), y solo guardamos la referencia tokenizada + los metadatos de visualización (marca, últimos cuatro dígitos, caducidad). No tienes que preocuparte del alcance de PCI por tu parte mientras uses la API; los números de tarjeta en claro nunca aparecen en ninguna petición a NimbusNexus.

Estas llamadas necesitan una sesión iniciada, enviada como `Authorization: Bearer` o como la cookie de sesión. Una clave de API no puede hacerlas.

## Próximos pasos {#next-steps}

- [Facturación](/docs/api/invoices) — los saldos que recargan estas tarjetas y tus datos de facturación.
- [Datos de precios](/docs/api/pricing-data) — los precios por recurso que hay detrás de los cargos.
