---
title: "Verificación de endpoints"
description: "Demuestra que un endpoint quiere tus eventos antes de que reciba ninguno — un desafío firmado de un solo uso que debe devolver."
publishedAt: 2026-10-19
updatedAt: 2026-10-28
kind: concept
---

# Verificación de endpoints

La verificación demuestra que la URL de un endpoint es tuya y está lista para recibir webhooks. Le enviamos un desafío firmado; la supera devolviendo ese desafío. Hasta que la supera, un workspace que exige verificación no le entrega nada — lo que detecta una URL mal escrita o un receptor a medio construir antes de que los eventos reales se acumulen en la cola dead-letter, e impide que cualquiera dirija nuestras entregas a un servidor que nunca las pidió.

## El desafío {#challenge}

Al iniciar una verificación se envía un POST a la URL del endpoint, firmado con el secreto del endpoint exactamente igual que una entrega (las mismas `X-Webhook-Signature` y `X-Webhook-Timestamp`, las cabeceras personalizadas de tu endpoint y `X-Webhook-Event-Type: webhook.verify`):

```json
{"type": "webhook.verify", "data": {"endpoint_id": "ep_3f9a…", "challenge": "Xb9kQ2…"}}
```

El endpoint la supera cuando responde **2xx con el valor de `challenge` en cualquier parte del cuerpo de la respuesta**. Un 2xx sin el token falla con `challenge_not_echoed`; cualquier otra cosa falla igual que fallaría una entrega.

## Cómo responderlo {#handler}

Comprueba la firma como haces con cada entrega y después devuelve el desafío:

```python
from nn_webhooks import challenge_response

if (challenge := challenge_response(raw_body)) is not None:  # after the signature check
    return Response(challenge, status=200)
```

```ts
import { challengeResponse } from "@nimbusnexus/webhooks-sdk";

const challenge = challengeResponse(rawBody); // after the signature check
if (challenge !== null) return res.status(200).send(challenge);
```

```go
if challenge, ok := webhooks.ChallengeResponse(rawBody); ok { // after the signature check
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(challenge))
    return
}
```

Son los ayudantes de los SDK que lo resuelven en una sola llamada (desde la 0.8.0). Con cualquier otro evento no devuelven nada, así que el resto de tu handler funciona como antes. Sin SDK, analiza el cuerpo y responde con `data.challenge` cuando `type` sea `webhook.verify`.

## Cómo lanzarla {#run}

En la consola, abre el menú del endpoint en la página **Endpoints** y elige **Verify**. Por la API:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a…/verify \
  -H "Authorization: Bearer $ADMIN_KEY"
```

```json
{ "verified": true, "challenge_echoed": true, "status_code": 200, "error": null, "duration_ms": 142, "failure_reason": null }
```

Un endpoint sigue verificado hasta que cambia su URL; una URL nueva tiene que volver a verificarse.

## Cuándo es obligatoria {#required}

La verificación es obligatoria para un endpoint cuando está activado cualquiera de estos:

- el interruptor del **workspace** — **Settings → Endpoint verification** en la consola, o `PATCH /v1/workspace` con `{"require_endpoint_verification": true}`;
- el interruptor del **proyecto** — `PUT /v1/verification-policy?project_id=…` con `{"required": true}`, para un proyecto que la necesita cuando otros no;
- tu **plan**, si el plan la exige. En ese caso, la consola muestra el interruptor bloqueado en activado.

`GET /v1/verification-policy` devuelve la regla tal como la aplica la entrega (`required`), junto con los dos interruptores.

## Lo que se pierde un endpoint sin verificar {#gated}

Cuando la verificación es obligatoria, un endpoint sin verificar se deja fuera al repartir un evento: la respuesta de la publicación lo cuenta en `skipped_unverified`, la consola marca el endpoint como *gated* y no se crea ninguna entrega para él — así que no queda nada esperando a enviarse cuando se verifique. Vuelve a publicar o a [reenviar](/docs/product-webhooks/deliveries#replay) cuando la supere.

Volver a enviar queda bloqueado de la misma forma. Volver a entregar una entrega a ese endpoint, o reenviarle un evento, se rechaza con `409 endpoint_not_verified`; volver a entregar en bloque o por intervalo de tiempo lo deja fuera y lo cuenta en `skipped_unverified`. Una entrega que ya estaba en cola o reintentándose cuando el endpoint pasa a necesitar verificación — porque se activó el requisito o cambió la URL del endpoint — va a la cola dead-letter sin enviarse, con un `last_error` que empieza por "not verified:". Verifica el endpoint y después vuelve a entregarla.

## Receptores que no pueden responder {#cannot-echo}

Algunos receptores aceptan cualquier POST pero nunca devuelven un cuerpo que elijas tú — entre ellos, los catch hooks de Zapier. No pueden superar la verificación. Si tu plan te lo permite, deja la verificación desactivada para el proyecto que les entrega; si no, pon delante un pequeño intermediario propio que responda al desafío.

Los incoming webhooks de Slack son un caso aparte. Solo aceptan un mensaje de Slack, con un campo `text` o `blocks`, así que rechazan todos los eventos que entregamos, incluso con la verificación desactivada. Para llevar eventos a Slack, apunta el endpoint a algo que convierta cada evento en un mensaje, como un receptor propio o un catch hook de Zapier.

## Próximos pasos {#next-steps}

- [Verificación de firmas](/docs/product-webhooks/signatures) — la comprobación que hay que hacer antes de responder al desafío.
- [Entregas y reintentos](/docs/product-webhooks/deliveries) — qué pasa cuando el endpoint ya recibe eventos.
- [Inicio rápido](/docs/product-webhooks/quickstart) — de cero a una entrega verificada.
