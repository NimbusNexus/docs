---
title: "Reenvío"
description: "Un bin puede reenviar a tu propio servidor cada petición que registra y guardar lo que respondió tu servidor — qué se envía, los reintentos, los límites y la dirección de la que vienen los reenvíos."
publishedAt: 2026-10-26
updatedAt: 2026-10-26
kind: concept
---

# Reenvío

Dale a un bin una URL de reenvío y cada petición que registra se reenvía también a tu propio servidor, tal como llegó. El emisor sigue recibiendo al instante el `200` del bin. El bin reenvía la petición por su cuenta, vuelve a intentarlo cuando tu servidor falla y guarda la respuesta de tu servidor junto a la petición, así que un solo sitio muestra lo que envió un emisor y lo que hizo con ello tu endpoint.

## Quién puede reenviar y adónde {#target}

El reenvío está incluido en Starter, Pro y Custom. En Free, fijar una URL de reenvío responde `402` `not_entitled`, con `details.feature` `forwarding`.

Un bin reenvía a una sola URL, y esa URL debe ser:

- **https**, en cualquier puerto. El certificado se comprueba contra el nombre de host de la URL.
- **Sin nombre de usuario ni contraseña.**
- **De la internet pública.** Todas las direcciones a las que resuelve su host deben ser públicas: se rechaza una dirección privada, de loopback, link-local o reservada por cualquier otro motivo, y también un host que no resuelve.
- **Ajena a nosotros.** Se rechazan `nnbin.net`, `nimbusnexus.net` y todos los nombres bajo ellos, igual que cualquier nombre que resuelva a una de nuestras propias direcciones: un bin no puede reenviar a un bin, ni a los propios servicios de NimbusNexus.
- **De 2.048 caracteres como máximo.**

La URL se comprueba cuando la fijas y otra vez antes de cada envío, y cada envío va solo a las direcciones que encontró esa comprobación, así que un cambio de DNS entretanto no puede dirigirlo a ningún otro sitio. No se siguen las redirecciones: una respuesta `3xx` se guarda como la respuesta de tu servidor y el reenvío cuenta como enviado, porque una redirección podría llevar a cualquier sitio que la comprobación nunca vio.

La ruta y la query de cada petición se añaden a la URL de reenvío. Con la URL de reenvío `https://api.example.com/hooks`, una petición a `https://nnbin.net/b/k7xq2mbn9tfa/stripe/events?x=1` va a `https://api.example.com/hooks/stripe/events?x=1`. Una petición a la URL del bin sin nada más va a la URL de reenvío tal como la fijaste, y una query que lleve la URL de reenvío va primero.

Fija la URL con **Set up forwarding** en la tarjeta **Forwarding** del bin en la consola, o con `forward_url` en `PATCH /v1/bins/{id}`:

```bash
curl -X PATCH https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17 \
  -H "Authorization: Bearer $BINS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"forward_url": "https://api.example.com/hooks"}'
```

La respuesta es el bin, con `forward_url` fijado. **Stop forwarding** en la tarjeta, o `"forward_url": null`, lo desactiva. Fijar la URL requiere el rol de miembro, o una clave con **Read & write**. Una URL que incumple alguna de las reglas anteriores se rechaza con `422`, y la [referencia](/docs/product-bins/reference#forwarding) enumera cada motivo.

## Cómo comprobar antes la URL {#test}

**Send a test** en la tarjeta Forwarding, o `POST /v1/bins/{id}/forward-test`, envía ahora a tu servidor un pequeño evento JSON y muestra lo que respondió, para que sepas que la URL funciona antes de que el tráfico real dependa de ella:

```bash
curl -X POST https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17/forward-test \
  -H "Authorization: Bearer $BINS_API_KEY"
```

```json
{
  "ok": true,
  "answer": {
    "status": 200,
    "headers": [
      {"name": "content-type", "value": "text/plain"}
    ],
    "body_base64": "b2s=",
    "truncated": false
  },
  "duration_ms": 142,
  "error": ""
}
```

Tu servidor recibe un `POST` cuyo cuerpo es `{"type":"request_bins.forward_test","bin":"<slug>","sent_at":"<when>"}`, con `Content-Type: application/json`, `User-Agent: NimbusNexus-Request-Bins (forward test)`, `X-Request-Bins-Request: test` y las cabeceras `Via` y `X-Forwarded-Host` que lleva todo reenvío. `ok` es `true` con una respuesta `2xx` o `3xx`. Cuando no llega ninguna respuesta, `answer` es `null` y `error` indica por qué, como un timeout. Un bin puede enviar 10 pruebas por minuto.

## Qué se envía {#sent}

Un reenvío es la petición tal como la registró el bin:

- **el método**, fuera cual fuera;
- **el cuerpo, byte a byte**;
- **las cabeceras, en el orden en que llegaron**, menos las de abajo, y después las nuestras.

**Se eliminan**, porque pertenecen a una conexión o a un salto y no a la petición: `Connection` y todas las cabeceras que nombra, `Keep-Alive`, `Proxy-Connection`, `Proxy-Authenticate`, `TE`, `Trailer`, `Transfer-Encoding` y `Upgrade`; `Host`, que pasa a ser el de tu servidor, y `Content-Length`, que se vuelve a contar; y `X-Real-IP`, `X-Forwarded-Proto`, `X-Forwarded-Host`, `CDN-Loop` y todas las cabeceras `CF-*`, que describen un salto anterior; el reenvío pone sus propias `X-Forwarded-Proto` y `X-Forwarded-Host`. También se elimina la `X-Request-Bins-Request` propia de un emisor, así que la que lee tu servidor es la nuestra.

**No se reenvían: las credenciales.** `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` y `X-Api-Key` nunca salen del bin. La URL de un bin es pública, así que un bin sustituye estos valores por `[redacted]` antes de guardar nada, y no se conserva nada de lo que un emisor puso en ellas, ni siquiera durante el momento en que un reenvío lo necesitaría. Las cabeceras de firma, como `Stripe-Signature` o `X-Hub-Signature-256`, no son credenciales y se reenvían. El cuerpo no cambia, así que siguen verificándose, aunque un reintento puede llegar cuando ya se ha agotado la tolerancia de una firma con timestamp. El coste: un servidor que autentica a quien lo llama con una de esas cinco cabeceras rechaza las peticiones reenviadas.

**Se añaden**, después de las cabeceras del emisor:

| Cabecera | Valor |
| --- | --- |
| `X-Forwarded-For` | Las entradas `X-Forwarded-For` propias del emisor, si envió alguna, y después la dirección del emisor, el `source_ip` de la petición. |
| `Forwarded` | Los elementos `Forwarded` propios del emisor, y después el nuestro: `for=<sender>;proto=https;host=nnbin.net`. |
| `Via` | `1.1 nnbin.net`, después de cualquier `Via` que hayan añadido los propios proxies del emisor. |
| `X-Forwarded-Proto` | `https` |
| `X-Forwarded-Host` | `nnbin.net` |
| `X-Request-Bins-Request` | El `id` de la petición, como `req_8d2e6b1f4a9c3e7d5b0f2a61`, para que los logs de tu servidor lleven de vuelta a ella. |

## Entrega y reintentos {#delivery}

El emisor recibe al instante `200` y `{"status":"accepted"}`, como de cualquier bin, haga lo que haga tu servidor, y nunca ve la respuesta de tu servidor. El bin envía el reenvío por su cuenta, normalmente a los pocos segundos de registrar la petición.

Un intento termina por timeout cuando tu servidor tarda más de 10 segundos en aceptar la conexión, o más de 10 segundos en responder. Lo que pasa después depende de cómo terminó el intento:

| El intento terminó con | Qué pasa |
| --- | --- |
| Una respuesta `2xx` o `3xx` | Enviado. No se sigue la redirección. |
| Un error de conexión, un timeout, `408`, `429` o un `5xx` | Se vuelve a intentar, hasta agotar los intentos del plan. |
| Cualquier otro `4xx` | Fallido al instante: volver a enviar la misma petición no cambiará un `400` ni un `404`. |
| Una URL de reenvío que ya no supera [las comprobaciones](#target) | Fallido al instante. |

Un intento fallido se reintenta 30 segundos después, y luego 2 minutos, 10 minutos y 30 minutos después de cada uno de los intentos que siguen, hasta agotar los intentos del plan: 3 en Starter, así que el último llega unos dos minutos y medio después del primero, y 5 en Pro y Custom, unos 43 minutos después. Cuando una respuesta `408`, `429` o `5xx` lleva `Retry-After` pidiendo una espera más larga, el bin espera ese tiempo en su lugar, hasta una hora.

Antes de cada intento, el bin vuelve a comprobar que puede enviar. Un reenvío se descarta, como no reenviado, en cuanto el bin se ha borrado o suspendido, el reenvío se ha detenido o [pausado](#paused), el workspace se ha suspendido o el plan ya no incluye el reenvío. Un reenvío va a la URL que estaba fijada cuando llegó su petición, así que cambiar la URL no mueve los reenvíos que ya están esperando.

Solo se envían las peticiones que llegan mientras un bin reenvía: activar el reenvío no envía nada de lo que el bin registró antes. Cada petición se reenvía por separado, así que una petición enviada dos veces se registra dos veces y se reenvía dos veces. Las peticiones no mantienen su orden: una que se reintenta puede llegar a tu servidor después de otra que llegó más tarde.

## Cómo ver lo que ha pasado {#forwards}

En la consola, abre una petición. Su sección **Forwarding** muestra adónde fue y en qué punto está (**Queued**, **Sending**, **Sent**, **Retrying**, **Failed** o **Not forwarded** con el motivo), los intentos hasta ahora, el último error y la respuesta de tu servidor: su estado, sus cabeceras y los primeros 8 KiB de su cuerpo. La tarjeta Forwarding del bin muestra el último envío que falló.

Por la API, `GET /v1/requests/{id}` lista los reenvíos de la petición en `forwards`, del más reciente al más antiguo. Uno de ellos:

```json
{
  "id": "fwd_5a1e8c3b7d2f9a4e6c0b1d83",
  "state": "sent",
  "reason": "",
  "url": "https://api.example.com/hooks/orders?source=quickstart",
  "attempts": 1,
  "max_attempts": 3,
  "next_attempt_at": null,
  "last_error": "",
  "answer": {
    "status": 200,
    "headers": [
      {"name": "content-type", "value": "application/json"}
    ],
    "body_base64": "eyJyZWNlaXZlZCI6dHJ1ZX0=",
    "truncated": false
  },
  "duration_ms": 142,
  "created_at": "2026-10-26T09:12:04Z",
  "sent_at": "2026-10-26T09:12:05Z"
}
```

La [referencia](/docs/product-bins/reference#forwards) tiene todos los campos, estados y motivos. La respuesta de tu servidor se guarda tanto tiempo como la petición, y se borra con ella. En el bin, `forward_last_error` y `forward_last_error_at` indican qué salió mal en el último envío que falló, como `HTTP 503` o un timeout, y nunca lo que contenía la petición.

## Límites {#limits}

| | Starter | Pro | Custom |
| --- | --- | --- | --- |
| Cuerpo más grande que se reenvía | 256 KiB | 1 MiB | 1 MiB |
| Reenvíos por minuto, por bin | 60 | 300 | 600 |
| Intentos por petición | 3 | 5 | 5 |

- **Un cuerpo mayor se registra y no se reenvía**, con el motivo `body_too_large`. Lo mismo pasa con un cuerpo de más de 1 MiB en cualquier plan, porque un bin solo guarda su primer MiB ([Qué registra un bin](/docs/product-bins/reference#edge-records)).
- **Superados los reenvíos por minuto de un bin**, los reenvíos esperan su turno. No se descarta ninguno por ello.
- **Un bin tiene como máximo 1.000 reenvíos sin terminar**: en cola, enviándose o esperando un nuevo intento. Una petición que llega mientras tiene tantos se registra y no se reenvía, con el motivo `queue_full`.
- **La URL de reenvío con la ruta y la query de una petición añadidas** debe caber en 8.192 caracteres, o la petición no se reenvía (`url_too_long`).
- **El reenvío no consume peticiones propias.** Una petición reenviada cuenta una vez para las peticiones del mes, cuando se registra, y sus intentos no cuentan. Una petición que el bin no registró, porque se habían agotado las peticiones del mes o el bin estaba suspendido, tampoco se reenvía.

## Cuando el reenvío se pausa {#paused}

Cuando tu servidor no deja de fallar, el bin deja de enviarle peticiones: el reenvío se pausa tras 20 intentos fallidos seguidos, o tras una hora en la que fallaron todos los intentos. Un intento que tenga éxito reinicia los dos recuentos.

Mientras el reenvío está pausado, el bin sigue registrando pero no envía nada: cada petición que llega, y cada reenvío que estaba esperando, se marca como no reenviado, con el motivo `paused`, y ninguno se envía más tarde. El bin muestra cuándo y por qué se pausó: **Paused** en su tarjeta Forwarding, y `forward_paused_at` y `forward_paused_reason` (`failed_in_a_row` o `failing_for_an_hour`) en la API.

**Se avisa al workspace**, una vez por cada pausa, igual que se le avisa de sus peticiones del mes: por email, que va al propietario del workspace salvo que elijas otra dirección, y con un webhook si configuras uno. Ambos están en **Notifications** en tu consola de la cuenta. Reanudar no envía nada.

El email, "Request Bins: forwarding was paused on one of your bins", nombra el bin por su etiqueta y su URL, y el host al que reenviaba, nunca la ruta ni la query. Indica por qué se pausó el bin, con el último error, y que las peticiones se siguen registrando pero no se reenvía ninguna, así que las que se registren entretanto no se reenviarán más tarde. Termina explicando cómo reanudarlo.

El tipo de evento del webhook es `bind.forwarding.paused`, y su cuerpo es:

```json
{
  "type": "bind.forwarding.paused",
  "workspace_id": "{{WORKSPACE_ID}}",
  "data": {
    "bin_id": "bin_3f9a1c7e5b2d8f4a6c0e9b17",
    "label": "Quickstart",
    "url": "https://nnbin.net/b/w4tz8hcv2qnd",
    "forward_host": "api.example.com",
    "reason": "failed_in_a_row",
    "paused_at": "2026-10-26T14:05:12.345678Z",
    "failures": 20,
    "last_error": "HTTP 503"
  }
}
```

`reason` es `failed_in_a_row` o `failing_for_an_hour`, `failures` es cuántos envíos seguidos habían fallado, y `last_error` es qué salió mal en el último de ellos. `forward_host` es solo el host de la URL de reenvío: un aviso nunca lleva la ruta ni la query de la URL, que pueden contener un secreto.

Para reanudarlo cuando tu servidor esté arreglado, elige **Resume** en la tarjeta Forwarding, o vuelve a fijar `forward_url` con `PATCH /v1/bins/{id}`, con la misma URL o con una nueva. El reenvío vuelve a empezar con la siguiente petición que registre el bin, y **Send a test** muestra si tu servidor responde.

## De dónde vienen los reenvíos {#source-address}

Los reenvíos y los envíos de prueba llegan a tu servidor desde `23.247.240.155`, por IPv4, así que un servidor cuyo host solo tiene direcciones IPv6 no puede recibirlos. Esa es la dirección actual, y puede cambiar: esta página lo dirá antes de que cambie. Si tu servidor solo acepta peticiones de direcciones que conoce, permite esta.

## Lo que no es el reenvío {#not}

- **Un proxy.** El emisor recibe el `200` del bin, nunca la respuesta de tu servidor, y un bin no puede responder con un estado, unas cabeceras o un cuerpo a tu elección.
- **Repetición.** Una petición registrada no se puede volver a enviar bajo demanda: cada una se reenvía una vez, según llega, con sus reintentos.
- **Reparto.** Un bin reenvía a una sola URL. Para comprobar las firmas de un proveedor y entregar sus webhooks a varios endpoints tuyos, con una cola dead-letter y la posibilidad de volver a entregarlos, usa una [fuente de Webhooks](/docs/product-webhooks/sources).

## Próximos pasos {#next-steps}

- [Referencia de Request Bins](/docs/product-bins/reference#forwarding) — `forward_url`, el envío de prueba y todos los campos de un reenvío.
- [Resumen del producto](/docs/product-bins) — qué registra un bin y los límites de cada plan.
- [Fuentes de Webhooks](/docs/product-webhooks/sources) — los webhooks de un proveedor, verificados y entregados a tus endpoints.
