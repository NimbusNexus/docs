---
title: "Fuentes"
description: "Recibe webhooks de Stripe, GitHub, Clerk, Resend o cualquier emisor que firme con HMAC y entrégalos a tus endpoints como eventos."
publishedAt: 2026-10-19
updatedAt: 2026-10-28
kind: concept
---

# Fuentes

Una fuente es una URL que le das a un proveedor — Stripe, GitHub, un emisor de Standard Webhooks como Clerk o Resend, o cualquier otro que firme sus webhooks — para que pueda enviarnos webhooks. Comprobamos la firma de cada petición, la convertimos en un evento y la entregamos a tus endpoints exactamente igual que un evento que [hubieras publicado tú](/docs/product-webhooks/quickstart#publish): las mismas suscripciones, los mismos reintentos, la misma cola dead-letter.

Usa una fuente cuando quieras un único sitio para el tráfico de webhooks en ambos sentidos, o cuando quieras que varios de tus servicios reciban los eventos de un proveedor sin que cada uno verifique por su cuenta la firma de Stripe.

## Cómo se convierte una petición en entregas {#flow}

1. El proveedor hace un POST a la URL de ingesta de la fuente, `{{WEBHOOKS_BASE_URL}}/v1/ingest/{source_id}`.
2. Verificamos la firma sobre los bytes exactos recibidos, con el secreto de firma de la fuente.
3. El cuerpo debe ser un objeto JSON. Leemos de él el tipo de evento (consulta [Tipos de evento de una fuente](#event-types)).
4. El evento se publica en el proyecto de la fuente y se compara con las suscripciones de tus endpoints, lo que crea una entrega por cada endpoint que coincide.
5. El proveedor recibe `202`. Tus endpoints reciben el evento firmado con *su* secreto, no con el del proveedor.

La URL de ingesta es la única parte de Webhooks que acepta peticiones sin clave de API: la firma del proveedor es la credencial.

## Proveedores y sus firmas {#providers}

| Proveedor | Cabecera que comprobamos | Bytes firmados | Ventana de replay |
|---|---|---|---|
| `stripe` | `Stripe-Signature: t=…,v1=…` | `{t}.{body}` | 5 minutos |
| `github` | `X-Hub-Signature-256: sha256=…` | `{body}` | ninguna (GitHub no envía timestamp) |
| `generic` | `X-Webhook-Signature: sha256=…` con `X-Webhook-Timestamp` | `{timestamp}.{body}` | 5 minutos |
| `standardwebhooks` | `webhook-signature: v1,…` con `webhook-id` y `webhook-timestamp`, o las mismas tres como `svix-*` | `{id}.{timestamp}.{body}` | 5 minutos |

Los cuatro son HMAC-SHA256. `generic` es el mismo esquema con el que firmamos nuestras propias entregas, así que el endpoint de un workspace de Webhooks puede alimentar la fuente de otro, y cualquier emisor que controles puede firmar así en unas pocas líneas. `standardwebhooks` es el esquema de [Standard Webhooks](https://www.standardwebhooks.com/), el que usa todo emisor basado en Svix, entre ellos Clerk y Resend.

## Crea una fuente {#create}

En la consola: **Sources → New source** (también en la página Overview). O por la API:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/sources \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "provider": "stripe",
        "name": "Stripe live",
        "secret": "whsec_…",
        "event_type_prefix": "stripe."
      }'
```

- **Stripe, GitHub y Standard Webhooks**: pega el secreto de firma que te muestra el proveedor (para un emisor de Standard Webhooks, el valor `whsec_…` de su configuración de webhooks). Una fuente creada sin él empieza desactivada; añade el secreto más tarde con `rotate-secret` y actívala.
- **Generic**: omite `secret` y generamos uno, que se devuelve una sola vez en esta respuesta.

La respuesta incluye `ingest_url`. Pégala en la configuración de webhooks del proveedor, y añade un endpoint suscrito a los tipos que esperas (`prefix` `stripe.` en el ejemplo anterior).

## Tipos de evento de una fuente {#event-types}

Cada petición necesita un tipo de evento al que puedan suscribirse los endpoints. Una fuente lo busca en este orden:

1. Donde le hayas dicho que mire: una **cabecera** de la petición, o una **ruta JSON** con puntos en el cuerpo (`data.object.type`).
2. Si no, el sitio propio del proveedor: el `type` del cuerpo para Stripe, generic y Standard Webhooks, la cabecera `X-GitHub-Event` para GitHub.
3. Si ninguno da un valor: el **tipo por defecto** de la fuente y, si no lo hay, `webhook.received`.

El **prefijo** de la fuente va delante (`stripe.` + `invoice.paid` → `stripe.invoice.paid`), lo que mantiene separados los tipos de dos proveedores en un mismo proyecto. Si tu lista de tipos de evento muestra `webhook.received`, una fuente recibió peticiones sin un tipo que pudiera leer: configura un tipo por defecto o una ruta JSON en esa fuente.

El id de evento propio del proveedor (el `evt_…` de Stripe, el id de entrega de GitHub, la cabecera `webhook-id` de Standard Webhooks) es la clave de idempotencia, así que cuando un proveedor reintenta un evento que ya aceptamos, vuelve a recibir `202` y no se entrega nada dos veces.

## Lo que ve el proveedor {#responses}

| Estado | Cuándo |
|---|---|
| `202` | Aceptada y publicada. |
| `400` | El cuerpo no es JSON, o no es un objeto JSON. |
| `401` | La firma no se verificó — falta, está mal formada, el secreto es incorrecto o está fuera de la ventana de replay. Una sola respuesta para todos los casos, a propósito. |
| `402` | El workspace ha agotado su cupo mensual de entregas. |
| `404` | No existe esa fuente, o la fuente está desactivada. |
| `409` | El id de evento del proveedor ya se aceptó con un cuerpo distinto. |
| `413` | La petición supera los 512 KiB, o el payload supera los 256 KiB. |
| `422` | El tipo no está registrado y la [política de tipos de evento](/docs/product-webhooks/event-types#policy) es Strict, o el payload no cumple el JSON Schema del tipo. |
| `429` | Demasiadas peticiones: 600 por minuto por fuente antes de comprobar la firma, y después la tasa de publicación de tu plan. |

Los proveedores reintentan ante cualquier respuesta que no sea 2xx, así que un rechazo no se pierde por su lado — pero para ver *por qué* lo rechazamos, activa el registro en la fuente y consulta [Peticiones capturadas](/docs/product-webhooks/captured-requests).

## Cómo rotar un secreto {#rotate}

Cuando el proveedor cambie su secreto, envía el nuevo:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/sources/src_…/rotate-secret \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"secret": "whsec_new…"}'
```

El secreto anterior sigue verificando durante 24 horas, así que se aceptan las peticiones firmadas con cualquiera de los dos mientras el proveedor hace el cambio. Para una fuente genérica, envía un cuerpo vacío y generamos el nuevo secreto.

## Próximos pasos {#next-steps}

- [Peticiones capturadas](/docs/product-webhooks/captured-requests) — consulta las peticiones en bruto que recibió una fuente, rechazos incluidos.
- [Fuentes en la referencia de la API](/docs/reference/webhooks#ref-sources) — todas las operaciones de fuentes, con las llamadas del SDK y de la CLI.
- [Tipos de evento](/docs/product-webhooks/event-types) — el catálogo de tipos y qué pasa con uno desconocido.
- [Entregas y reintentos](/docs/product-webhooks/deliveries) — qué pasa después de publicar un evento.
- [Resumen de Webhooks](/docs/product-webhooks) — los objetos y cómo encajan entre sí.
