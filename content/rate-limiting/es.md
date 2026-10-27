---
title: "Límites de tasa"
description: "Presupuestos de peticiones por clave, las cabeceras que devolvemos y la estrategia de backoff adecuada."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: concept
---

# Límites de tasa

Cada clave de API tiene un presupuesto de peticiones por segundo y otro por hora. Los límites nos protegen tanto a ti como a nosotros — impiden que un bucle descontrolado dispare el gasto de tu tarjeta de crédito e impiden que un solo tenant sature una región.

## Los valores por defecto {#defaults}

| Tier | Por segundo | Por hora |
|---|---|---|
| Free | 5 | 1.000 |
| Starter | 25 | 10.000 |
| Production | 100 | 100.000 |
| Enterprise | Personalizado | Personalizado |

Se aplican por **clave de API**, no por proyecto — si tienes tres claves en un proyecto, cada una tiene su propio presupuesto. La mayoría de los equipos nunca se acercan al límite del tier Production; si tú lo haces, el apartado "rate limit usage" del panel muestra los puntos de llamada que más rápido consumen la cuota.

## Cómo funciona la limitación {#mechanics}

Un token bucket en cada clave. El bucket se rellena al ritmo por segundo; su tamaño está fijado para que una ráfaga breve que agote el presupuesto se recupere en ~10 segundos. El límite por hora es un tope estricto — una vez que lo alcanzas, ninguna petición tiene éxito hasta que la hora móvil avanza.

Los límites se evalúan en el gateway, antes de que la petición llegue al handler del recurso. Una petición limitada por tasa nunca toca los recursos de tu proyecto, así que nunca te cuesta nada más allá de la entrada de log de la petición fallida.

## Cabeceras de respuesta {#headers}

Cada respuesta de la API lleva cuatro cabeceras que describen tu presupuesto actual:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1763410812
X-RateLimit-Window: 1
```

- `X-RateLimit-Limit` — presupuesto total de la ventana actual
- `X-RateLimit-Remaining` — peticiones restantes
- `X-RateLimit-Reset` — epoch Unix en el que se rellena el presupuesto (o avanza la ventana por hora)
- `X-RateLimit-Window` — `1` para el límite por segundo, `3600` para el límite por hora. Mostramos el presupuesto que estés más cerca de agotar

Cuando `Remaining` llega a cero, la siguiente petición devuelve `429 Too Many Requests` con una cabecera `Retry-After` (en segundos) que te dice cuándo reintentar.

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

- **Respeta siempre `Retry-After`.** No reintentes antes — solo conseguirás volver a chocar con el límite y gastar tu presupuesto más deprisa.
- **Añade jitter** si llamas desde varios workers. Sin jitter, todos tus workers reintentan en el mismo instante y vuelven a chocar con el límite a la vez.

## Qué cuenta como una petición {#counted}

Cada llamada HTTP a la API cuenta como una petición, incluidas:

- Los `GET` (sí, incluso `GET /v1/regions`)
- Las llamadas de paginación (cada página es una petición)
- Los reintentos idempotentes (el acierto de caché sigue contando como una petición — pero es barato, y la deduplicación hace que no pagues dos veces la operación subyacente)

Lo que **no** cuenta:

- Los assets estáticos que sirve el sitio de marketing (CDN, no la API)
- Las entregas de webhooks a tu lado (las enviamos nosotros, no tú)
- Los intentos de conexión fallidos (no dejan entrada en el log del gateway)

## Cómo aumentar tus límites {#raising}

Los tiers Starter y Production suelen ser lo bastante generosos; menos del 5 % de las cuentas llega alguna vez al tope por hora. Si te ocurre, el camino es el formulario de contacto con el soporte, no la API — igual que para los [aumentos de cuota](/docs/api/quotas). Las migraciones de producción se resuelven en el mismo día.

Si chocas con los límites por segundo pero no con el de por hora, normalmente no necesitas un aumento — necesitas repartir la carga (agrupar peticiones, usar `Idempotency-Key` para deduplicar reintentos, paginar con tamaños de página razonables). El apartado "rate limit usage" del panel desglosa qué endpoints tienen picos.

## Próximos pasos {#next-steps}

- [Convenciones](/docs/conventions) — el formato de las peticiones, los códigos de estado y los patrones generales de la API.
- [Idempotencia](/docs/idempotency) — el patrón de reintento seguro cuando los fallos de red parecen límites de tasa.
- [Cuotas](/docs/api/quotas) — los límites de *recursos* (VMs, vCPU, almacenamiento), que no son lo mismo que los límites de tasa de peticiones.
