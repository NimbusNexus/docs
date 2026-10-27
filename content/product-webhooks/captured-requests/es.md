---
title: "Peticiones capturadas"
description: "Registra las peticiones en bruto que llegan a una fuente — cabeceras, cuerpo y lo que respondimos — para depurar una integración con un proveedor."
publishedAt: 2026-10-19
updatedAt: 2026-10-22
kind: concept
---

# Peticiones capturadas

Cuando un proveedor dice que envió un webhook y a tus endpoints no llegó nada, las peticiones capturadas muestran lo que llegó de verdad a tu [fuente](/docs/product-webhooks/sources): todas las cabeceras, el cuerpo en bruto, de dónde vino y lo que respondimos — incluidas las peticiones que rechazamos, que no dejan rastro en ningún otro sitio.

## Activa el registro {#enable}

El registro se activa por fuente y está **desactivado por defecto**, porque una petición capturada contiene el cuerpo en bruto de un webhook real — en el caso de un proveedor de pagos, datos reales de clientes. Actívalo para la fuente que estás depurando, observa lo que llega y vuelve a desactivarlo.

- En la consola: **Captured requests** muestra un interruptor para cada fuente en la parte superior de la página.
- Por la API: `PATCH /v1/sources/{id}` con `{"capture_enabled": true}`.

A partir de entonces se registra cada petición a la URL de ingesta de esa fuente, se acepte o no.

## Qué contiene una captura {#contents}

| Campo | Qué es |
|---|---|
| Método, ruta, query | La línea de petición tal como se recibió. |
| Cabeceras | En bruto, en orden de llegada y conservando los duplicados — si un proveedor envía dos cabeceras `Stripe-Signature`, se muestran las dos. Las cabeceras de credenciales como `Authorization` y `Cookie` se ocultan; las de firma se conservan, porque son lo que estás comprobando. |
| Cuerpo | Los primeros 64 KiB, exactamente como se recibieron. Un cuerpo más largo se marca como *truncated*, y con un cuerpo truncado no se puede volver a verificar una firma. |
| Origen | La dirección IP del emisor. |
| Resultado | `accepted`, o por qué la rechazamos (más abajo). |
| Lo que recibió el emisor | El estado con el que respondimos, para que coincida con lo que muestra el panel del proveedor. |
| Evento | Para una petición aceptada, el evento en que se convirtió. |

Las repeticiones se agrupan: si vuelven a llegar el mismo método, la misma ruta y el mismo cuerpo, sube el contador **times seen** de la captura (Stripe, por sí solo, reintenta hasta ocho veces) en lugar de añadirse una fila.

## Resultados {#outcomes}

| Resultado | Lo que recibió el emisor | Significado |
|---|---|---|
| `accepted` | 202 | Verificada y publicada como evento. |
| `bad_signature` | 401 | La firma no se verificó con el secreto de la fuente. |
| `not_json` | 400 | El cuerpo no es un objeto JSON. |
| `rate_limited` | 429 | Supera la tasa de publicación del workspace. |
| `over_quota` | 402 | El workspace ha agotado su cupo mensual de entregas. |
| `too_large` | 413 | El payload supera los 256 KiB. |
| `unknown_event_type` | 422 | El tipo no está registrado y la [política de tipos de evento](/docs/product-webhooks/event-types#policy) es Strict. |
| `invalid_payload` | 422 | El payload no cumple el JSON Schema de su tipo de evento. |
| `duplicate` | 409 | El id de evento del proveedor ya se aceptó con un cuerpo distinto. |

`bad_signature` suele ser lo primero que se encuentra: el secreto equivocado pegado en la fuente, o un proxy delante de tu proveedor que ha reescrito el cuerpo. Compara las cabeceras capturadas con el propio log de entregas del proveedor.

Algunos rechazos no se registran: una petición a una fuente desconocida o desactivada (no hay ninguna fuente para la que guardarla), una que supera el límite de 512 KiB por petición y una rechazada por el límite contra saturación de cada fuente antes de comprobar su firma. La [tabla de estados de Fuentes](/docs/product-webhooks/sources#responses) indica lo que ve el emisor en cada caso.

## Cuánto duran las capturas {#retention}

Una fuente guarda sus 500 capturas más recientes, y cada una se borra 7 días después de la última vez que se vio. Para borrar una antes, hazlo desde la consola o con `DELETE /v1/captures/{id}`.

## Cómo leerlas por la API {#api}

```bash
# The latest captures for one source, refusals only
curl -s "{{WEBHOOKS_BASE_URL}}/v1/captures?source_id=src_…&outcome=bad_signature" \
  -H "Authorization: Bearer $READ_KEY"

# One capture with its headers and body (base64, since a body may not be UTF-8)
curl -s {{WEBHOOKS_BASE_URL}}/v1/captures/cap_… \
  -H "Authorization: Bearer $READ_KEY"
```

La lista no incluye los cuerpos; obtén una captura por su id para conseguir `headers_raw` y `body_base64`. Todas las operaciones de capturas están en la [referencia de la API](/docs/reference/webhooks#ref-captured-requests).

## Lo que no es {#not}

Las peticiones capturadas no son un request bin que creas y al que envías tráfico arbitrario — solo registran lo que llega a tus propias fuentes. Para una URL que registre cualquier petición HTTP que reciba, usa [Request Bins](/docs/product-bins).

## Próximos pasos {#next-steps}

- [Fuentes](/docs/product-webhooks/sources) — cómo crear la fuente y qué significa cada rechazo.
- [Tipos de evento](/docs/product-webhooks/event-types) — por qué una petición se puede rechazar como `unknown_event_type`.
- [Entregas y reintentos](/docs/product-webhooks/deliveries) — qué le pasa después a una petición aceptada.
