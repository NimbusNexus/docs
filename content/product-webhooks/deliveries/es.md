---
title: "Entregas y reintentos"
description: "Lo que le pasa a cada evento después de repartirse — los estados de una entrega, el calendario de reintentos, la cola dead-letter y cómo volver a enviar."
publishedAt: 2026-10-19
updatedAt: 2026-10-30
kind: concept
---

# Entregas y reintentos

Publicar un evento crea una **entrega** por cada endpoint suscrito a su tipo. Una entrega es la unidad que enviamos, reintentamos y registramos: puedes ver cada intento que hizo y lo que se recibió, y volver a enviarla siempre que lo necesites.

## Estados de una entrega {#states}

| Estado | Significado |
|---|---|
| `queued` | Esperando su primer intento. |
| `sending` | Hay un intento en curso. |
| `sent` | El endpoint respondió 2xx. Terminado. Una entrega que la [transformación](/docs/product-webhooks/transformations#dropped) de su endpoint decidió no enviar también es `sent`, con `"dropped": true`. |
| `failed` | El último intento falló y hay otro programado (`next_attempt_at`). También una entrega a la espera de la [transformación pausada](/docs/product-webhooks/transformations#versions) de su endpoint. |
| `dead` | Sin intentos restantes, retenida sin enviar porque su endpoint debe pasar antes la [verificación](/docs/product-webhooks/endpoint-verification#gated), o fallida en la [transformación](/docs/product-webhooks/transformations#failures) de su endpoint. Se guarda en la cola dead-letter hasta que vuelvas a enviarla. |

Cualquier cosa que no sea un 2xx cuenta como fallo: un estado 4xx o 5xx, un timeout, un error de conexión o de TLS. Cada intento espera una respuesta hasta 10 segundos, o el `delivery_timeout_ms` propio del endpoint (de 100 ms a 60 s).

## El calendario de reintentos {#retries}

Una entrega fallida se reintenta a los 30 segundos, después a 1, 2, 4 y 8 minutos, duplicando la espera cada vez hasta una hora entre intentos, hasta llegar al `max_attempts` del endpoint. Tu plan pone un tope a `max_attempts` (5 en Free, 8 en Starter, 10 en Pro).

Si la curva por defecto no le va bien al receptor, dale al endpoint un `retry_schedule` — la espera en segundos antes de cada reintento:

```bash
curl -sX PATCH {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a… \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"retry_schedule": [10, 60, 300, 1800]}'
```

Cada intento envía los mismos bytes, firmados de nuevo con un timestamp nuevo, así que una entrega que llega con una hora de retraso sigue verificándose.

## Cuando un endpoint no deja de fallar {#auto-disable}

Tras 20 fallos seguidos, un endpoint se desactiva automáticamente, se registra el motivo y enviamos un [webhook operativo](#operational) `endpoint.disabled` para que te enteres. Los eventos nuevos ya no se reparten a él. Arregla el receptor, activa después el endpoint (`POST /v1/endpoints/{id}/enable`, o **Enable** en la consola) y vuelve a entregar lo que se perdió.

## Cómo ver lo que ha pasado {#attempts}

En la consola, **Deliveries** lista todas las entregas con su estado, sus intentos y su último error; abre una para ver cada intento — código de estado, error, duración — y el payload que se envió. Por la API:

```bash
curl -s "{{WEBHOOKS_BASE_URL}}/v1/deliveries?status=failed&endpoint_id=ep_3f9a…" \
  -H "Authorization: Bearer $READ_KEY"

curl -s {{WEBHOOKS_BASE_URL}}/v1/deliveries/dlv_…/attempts \
  -H "Authorization: Bearer $READ_KEY"
```

Cuando el despliegue los registra, un intento también incluye la primera parte del cuerpo de la respuesta del endpoint y las cabeceras que enviamos (con las credenciales enmascaradas).

Cuando el endpoint tiene una [transformación](/docs/product-webhooks/transformations#deliveries), la entrega también muestra la ejecución que le dio forma — la versión, el cuerpo que se envió, sus logs o su error — y `GET /v1/deliveries/{id}/transform` la devuelve.

## Volver a enviar {#replay}

| Qué | Cómo |
|---|---|
| Una entrega | `POST /v1/deliveries/{id}/redeliver` — desde `dead`, `failed` o `sent`. |
| Todas las entregas muertas (o fallidas) | `POST /v1/deliveries/redeliver` con `{"status": "dead"}`, opcionalmente acotado por `endpoint_id` o `project_id`. |
| Entregas en una ventana de tiempo | `POST /v1/deliveries/replay` con `from`, `to` y `status` — para "el receptor estuvo caído de 02:00 a 04:00". Solo para claves admin; como máximo 10.000 por llamada. |
| Un evento, a un endpoint que elijas | `POST /v1/events/{id}/replay` con `{"endpoint_id": "ep_…"}` — incluso uno que no estaba suscrito. Solo para claves admin. |

Las cuatro crean nuevos intentos del evento guardado; no publican un evento nuevo, así que el id de evento por el que deduplica tu endpoint sigue siendo el mismo. Un endpoint que debe pasar la [verificación](/docs/product-webhooks/endpoint-verification#gated) y no la ha pasado se rechaza (`409 endpoint_not_verified`) o, en las dos formas en bloque, se deja fuera y se cuenta en `skipped_unverified`.

## Webhooks operativos {#operational}

Para enterarte de los problemas de entrega sin vigilar la consola, suscribe un endpoint propio a nuestros eventos operativos: `endpoint.disabled`, `endpoint.degraded`, `endpoint.recovered`, `message.attempt.exhausted` (una entrega ha pasado a `dead`) y `transformation.disabled` (una [transformación](/docs/product-webhooks/transformations#failures) se ha desactivado tras fallar). Añade uno en **Operational webhooks** en la consola, o con `POST /v1/operational-endpoints`. Se firman como cualquier otra entrega.

## Cuánto tiempo se guardan las entregas {#retention}

Los eventos, sus entregas y sus intentos se guardan durante 90 días.

## Próximos pasos {#next-steps}

- [Verificación de endpoints](/docs/product-webhooks/endpoint-verification) — por qué un endpoint que coincide puede no recibir ninguna entrega.
- [Verificación de firmas](/docs/product-webhooks/signatures) — cómo comprobar cada entrega por tu parte.
- [Resumen de Webhooks](/docs/product-webhooks) — eventos, endpoints y suscripciones.
