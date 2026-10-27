---
title: "Inicio rápido de Webhooks"
description: "Registra un endpoint, publica un evento y verifica la entrega firmada — tres peticiones y un handler."
publishedAt: 2026-08-05
updatedAt: 2026-10-19
kind: quickstart
---

# Inicio rápido de Webhooks

De cero a una entrega verificada. Vas a registrar un endpoint receptor, publicarle un evento y comprobar la firma del webhook que llega.

## Antes de empezar {#before}

Necesitas dos cosas:

- **Una clave de API con alcance admin.** Emite una en tu consola de la cuenta de NimbusNexus, en **API keys**, eligiendo **Webhooks** como producto y `admin` como alcance. El [resumen del producto](/docs/product-webhooks#access) explica los alcances. Ponla en tu shell:

  ```bash
  export ADMIN_KEY="eyJ…"
  ```

- **Una URL HTTPS pública que ejecute tu handler.** Entregamos por internet, así que `localhost` no sirve. Para una primera prueba, sirve un túnel a tu portátil (`cloudflared tunnel --url http://localhost:3000`, o ngrok).

Todas las rutas siguientes son relativas a `{{WEBHOOKS_BASE_URL}}`.

## 1. Registra un endpoint {#endpoint}

Un endpoint es la URL HTTPS a la que entregamos, más las suscripciones que deciden qué tipos de evento recibe. Este recibe todo lo que empieza por `order.`:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "url": "https://your-app.example/webhooks",
        "subscriptions": [{"match_kind": "prefix", "pattern": "order."}]
      }'
```

La respuesta incluye el endpoint y su **secreto de firma**:

```json
{
  "id": "ep_3f9a…",
  "url": "https://your-app.example/webhooks",
  "status": "enabled",
  "health": "healthy",
  "subscriptions": [{ "match_kind": "prefix", "pattern": "order." }],
  "secret": "whsec_…"
}
```

El secreto se muestra **una sola vez**. Guárdalo ahora en tu gestor de secretos — es con lo que verificas las entregas, y no se puede volver a consultar. Si lo pierdes, rótalo y actualiza tu handler.

`match_kind` acepta `exact`, `prefix`, `suffix` o `all`. Empieza por algo acotado: una suscripción `all` en un receptor que solo entiende dos tipos de evento te obliga a escribir en tu handler un filtro que la suscripción podría haber hecho por ti.

**Si tu workspace exige la verificación de endpoints**, el endpoint no recibe nada hasta que supera un desafío de un solo uso: enviamos por POST una petición `webhook.verify` con un token, y tu handler responde 2xx con el token en el cuerpo. Un plan puede exigirla, y cualquier workspace puede activarla; la página **Settings** de la consola muestra si el tuyo la exige. Añade a tu handler las pocas líneas de [Verificación de endpoints](/docs/product-webhooks/endpoint-verification#handler) y después:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a…/verify \
  -H "Authorization: Bearer $ADMIN_KEY"
```

`"verified": true` en la respuesta significa que la ha superado.

## 2. Publica un evento {#publish}

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123-created" \
  -d '{
        "event_type": "order.created",
        "payload": {"order_id": "ord_123", "total": 4200}
      }'
```

El campo es `event_type`, no `type` — `type` es el nombre del campo dentro del sobre *entregado*, que es un objeto distinto. Enviar `type` aquí da un `422`.

La respuesta te dice qué ha producido la publicación:

```json
{
  "id": "evt_0b6e2c8f4a1d4e7b9c3f5a8d2e6b1c4f",
  "event_uid": "8f1c2e4a9b7d4c3e8a6f5b2d1c0e9a7b",
  "event_type": "order.created",
  "source": null,
  "project_id": "prj_5d2a9c7e1b4f4a8d9e3c6b1a7f2e8d4c",
  "deliveries_created": 1,
  "skipped_unverified": 0
}
```

`id` es el id del evento en la API (`GET /v1/events/{id}`). `event_uid` es el id que recibe tu endpoint, como `id` del sobre y en la cabecera `X-Webhook-Event-Id` — deduplica por él.

`deliveries_created: 0` es la sorpresa más habitual en la primera ejecución, y tiene dos causas:

- **Ningún endpoint está suscrito a ese tipo.** Compara el patrón de suscripción del endpoint con el tipo que enviaste.
- **Los endpoints que coinciden no están verificados**, y tu workspace exige verificación. `skipped_unverified` los cuenta; [verifica el endpoint](/docs/product-webhooks/endpoint-verification) y vuelve a publicar.

La cabecera `Idempotency-Key` es lo que permite reintentar la publicación sin riesgo: volver a enviar la misma clave devuelve el evento original en lugar de repartirlo otra vez.

## 3. Verifica la entrega {#verify}

El webhook llega a tu URL como un POST cuyo cuerpo es el evento dentro de un sobre:

```json
{"created_at":"2026-10-19T15:04:12.483211+00:00","data":{"order_id":"ord_123","total":4200},"id":"8f1c2e4a9b7d4c3e8a6f5b2d1c0e9a7b","type":"order.created","version":"1"}
```

`data` es el payload que publicaste, `id` el `event_uid` y `type` el tipo de evento. Comprueba la firma antes de hacer cualquier trabajo — un handler que se la salta procesará cualquier cosa que encuentre tu URL.

```python
import hashlib, hmac, time

def handle(request):
    secret = ENDPOINT_SIGNING_SECRET          # from step 1
    timestamp = request.headers["X-Webhook-Timestamp"]
    signature = request.headers["X-Webhook-Signature"]
    raw_body = request.body                   # RAW bytes — never re-serialize the JSON

    # 1. Reject anything outside the replay window.
    if abs(int(time.time()) - int(timestamp)) > 300:
        return Response(status_code=400)

    # 2. Recompute and compare in constant time. The header carries one token normally, but
    #    several comma-separated ones during a secret rotation — accept if ANY matches.
    expected = "sha256=" + hmac.new(
        secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()
    if not any(hmac.compare_digest(expected, t.strip()) for t in signature.split(",")):
        return Response(status_code=400)

    # 3. Only now is the payload trustworthy.
    process(request.json())
    return Response(status_code=200)          # 2xx = delivered; anything else retries
```

Firmar los bytes en bruto, y no un objeto recodificado, es el detalle que hace tropezar a la gente: analizar y volver a serializar el JSON reordena las claves y cambia los espacios en blanco, y la firma se calcula sobre los bytes que enviamos. Lee el cuerpo una vez, guárdalo, verifica y después analízalo.

El contrato completo — todas las cabeceras, y por qué existe cada regla — está en [Verificación de firmas](/docs/product-webhooks/signatures). Los [SDKs](/docs/product-webhooks/sdks) incluyen un helper `verify` que lo implementa todo, y es la vía recomendada.

## 4. Confirma que ha llegado {#confirm}

```bash
curl -s "{{WEBHOOKS_BASE_URL}}/v1/deliveries?status=dead" \
  -H "Authorization: Bearer $ADMIN_KEY"
```

Un `items` vacío significa que nada ha agotado sus reintentos. Si tu handler estaba caído durante el paso 2, la entrega estará aquí — arregla el handler y después reenvíala:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/deliveries/dlv_456/redeliver \
  -H "Authorization: Bearer $ADMIN_KEY"
```

## Próximos pasos {#next-steps}

- [Verificación de firmas](/docs/product-webhooks/signatures) — el contrato de firma completo.
- [Entregas y reintentos](/docs/product-webhooks/deliveries) — qué pasa cuando tu handler está caído.
- [Fuentes](/docs/product-webhooks/sources) — recibe de la misma forma webhooks de Stripe, GitHub y otros.
- [SDKs](/docs/product-webhooks/sdks) — olvídate del HMAC hecho a mano.
- [CLI](/docs/product-webhooks/cli) — las mismas operaciones sin curl.
- [Resumen de Webhooks](/docs/product-webhooks) — objetos, semántica de entrega e idempotencia.
