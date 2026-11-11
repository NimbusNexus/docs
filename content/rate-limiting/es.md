---
title: "Límites de tasa"
description: "Qué limita cada API, con qué cabeceras y errores responde un límite y cuál es la estrategia de backoff adecuada."
publishedAt: 2026-05-20
updatedAt: 2026-11-11
kind: concept
---

# Límites de tasa

La API de infraestructura limita cuántas peticiones recibe en un minuto. Las APIs de las apps limitan acciones concretas, como publicar un evento. En ambos casos, una petición que supera un límite responde `429`, normalmente con una cabecera `Retry-After` que indica cuántos segundos esperar.

## La API de infraestructura {#defaults}

Cada petición a `{{API_HOST}}` cuenta para un presupuesto por minuto:

| Quién llama | Peticiones por minuto | Se cuenta por |
|---|---|---|
| Una sesión iniciada (`Authorization: Bearer` o la cookie de sesión) | 120 | Usuario |
| Una clave de API, o ninguna credencial | 60 | Dirección IP |

Una clave de API no tiene un presupuesto propio. Las claves que se usan desde una misma dirección comparten sus 60 peticiones por minuto, junto con cualquier otra cosa que llame desde allí. `GET /api/v1/notifications/list` tiene un límite más bajo, de 30 por minuto, medido sobre el mismo recuento.

El minuto empieza con tu primera petición y no se desplaza: cuando termina, el recuento vuelve a empezar desde cero.

## Cabeceras de respuesta {#headers}

Las respuestas de la API de infraestructura llevan el límite que se ha aplicado y lo que queda de él:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
```

Por encima del límite, la respuesta es `429`, con `X-RateLimit-Remaining: 0` y una cabecera `Retry-After`, en segundos, con lo que queda del minuto:

```json
{
  "success": false,
  "message": "Too many requests. Please try again later."
}
```

## Las APIs de las apps {#apps}

Las APIs de las apps no envían cabeceras `X-RateLimit` y no limitan todas las peticiones. Lo que limitan lo rechazan con `429` `rate_limited`, como describe [Errores](/docs/errors#codes-rate):

- **Webhooks:** la publicación (`POST /v1/events`) se limita a la tasa de publicación de tu plan, por workspace. Volver a entregar y reenviar (`POST /v1/deliveries/{delivery_id}/redeliver`, `POST /v1/deliveries/redeliver`, `POST /v1/deliveries/replay` y `POST /v1/events/{event_id}/replay`) se limita a la misma tasa, con un recuento propio. Los eventos entrantes a `POST /v1/ingest/{source_id}` están limitados a 600 por minuto por fuente y, después, a la tasa de publicación de tu plan ([Lo que ve el proveedor](/docs/product-webhooks/sources#responses)). Guardar y probar scripts está limitado a 60 por minuto por workspace ([Transformaciones](/docs/product-webhooks/transformations#errors)).
- **Inboxes:** cada inbox acepta correo hasta un límite por minuto que fija tu plan ([Límites por plan](/docs/product-inboxes#limits)).
- **Request Bins:** un bin puede enviar 10 pruebas de reenvío por minuto ([Prueba una URL de reenvío](/docs/product-bins/reference#forward-test)). La URL de un bin recibe 120 peticiones por minuto de un mismo emisor y 600 por minuto en total ([Qué responde la URL de un bin](/docs/product-bins/reference#edge-answers)).
- **Transforms:** las ejecuciones y las pruebas comparten las ejecuciones por minuto de tu plan, por workspace, y en cada proceso del servidor un workspace puede tener como máximo dos en curso a la vez ([Planes y límites](/docs/product-transforms/reference#limits)).
- **Códigos QR:** un workspace puede enviar 10 pruebas de webhook por minuto.

## Estrategia de backoff {#backoff}

El patrón adecuado cuando recibes un `429`:

```ts
async function callWithBackoff(fn: () => Promise<Response>) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fn()
    if (res.status !== 429) return res

    const retryAfter = Number(res.headers.get('Retry-After') ?? '1')
    // Jitter prevents the thundering-herd problem if many clients
    // hit the limit at the same moment and all retry exactly together
    const jitter = Math.random() * 0.5 * retryAfter
    await new Promise(r => setTimeout(r, (retryAfter + jitter) * 1000))
  }
  throw new Error('Rate limit exceeded after 5 retries')
}
```

Dos notas:

- **Respeta siempre `Retry-After`.** No reintentes antes: solo conseguirás otro `429`.
- **Añade jitter** si llamas desde varios workers. Sin él, todos reintentan en el mismo instante y vuelven a chocar con el límite a la vez.

## Qué cuenta como una petición {#counted}

En la API de infraestructura, cuenta cada llamada HTTP, incluidas:

- Los `GET`, como `GET /api/v1/instance/`
- Cada página de una [lista paginada](/docs/pagination) y cada consulta mientras esperas a que una VM llegue a `ACTIVE`
- Las llamadas que fallan, como un `401`, y los propios `429`

Para no superar el límite desde una misma dirección, reparte el trabajo: haz polling con menos frecuencia y no listes lo que podrías leer una vez y guardar.

## Cómo aumentar tus límites {#raising}

Ninguna llamada a la API ni ningún ajuste del plan aumenta estos límites. Si el tuyo es un obstáculo para una carga de trabajo real, [contacta con el soporte]({{BASE_URL}}/contact/support).

## Próximos pasos {#next-steps}

- [Convenciones](/docs/conventions) — el formato de las peticiones, los códigos de estado y los patrones generales de la API.
- [Idempotencia](/docs/idempotency) — cómo reintentar una escritura sin riesgo.
- [Cuotas](/docs/api/quotas) — los límites de *recursos* (VMs, vCPU, almacenamiento), que no son lo mismo que los límites de tasa de peticiones.
