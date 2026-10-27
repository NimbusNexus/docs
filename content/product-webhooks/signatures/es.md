---
title: "Verificación de firmas"
description: "El contrato de firma de los webhooks entregados — cabeceras, cómo se construye el HMAC y las tres reglas para comprobarlo."
publishedAt: 2026-08-05
updatedAt: 2026-08-05
kind: concept
---

# Verificación de firmas

Cada entrega se firma con el secreto de firma del endpoint que la recibe. Verificar esa firma es lo que distingue "ha llegado un POST a mi URL" de "NimbusNexus me ha enviado este evento" — la URL de un webhook no es un secreto, y cualquier cosa en internet puede encontrarla.

Esta página es el contrato. Si usas uno de los [SDKs](/docs/product-webhooks/sdks), su helper `verify` ya lo implementa todo y puedes saltar a [qué hacer después de verificar](#responding).

## Las cabeceras {#headers}

| Cabecera | Contenido |
|---|---|
| `X-Webhook-Signature` | `sha256=<hex>` — el HMAC que verificas. **Varios tokens separados por comas durante una rotación del secreto**; consulta las [reglas](#rules) |
| `X-Webhook-Timestamp` | Segundos Unix; forma parte de la firma y de la ventana de replay |
| `X-Webhook-Event-Id` | El id del evento, igual que `id` en el cuerpo — úsalo para deduplicar |
| `X-Webhook-Event-Type` | El tipo de evento |
| `X-Webhook-Delivery-Id` | El id de esta entrega; indícalo en las solicitudes de soporte |

> Estas **no** son las cabeceras que usan los [webhooks de la plataforma](/docs/webhooks), que firman las notificaciones de infraestructura con el prefijo `NN-`. Los dos productos son sistemas independientes. Un handler escrito con los nombres de cabecera equivocados no encontrará nada que verificar y rechazará todas las entregas.

## La construcción {#construction}

```text
signature = "sha256=" + hex( HMAC_SHA256( secret, "<timestamp>." + raw_body ) )
```

El timestamp, un `.` literal y después el cuerpo en bruto de la petición — concatenados, pasados por HMAC con el secreto de firma de tu endpoint, codificados en hexadecimal y con el prefijo `sha256=`.

Incluir el timestamp en lo que se firma es lo que permite aplicar la ventana de replay. Si el timestamp fuera solo una cabecera junto a la firma, un atacante que reenviara una entrega capturada podría reescribirlo libremente; al firmarlo, cualquier modificación invalida el HMAC.

El cuerpo en sí es JSON compacto con las claves ordenadas, serializado una sola vez al publicar y guardado. Cada reintento de una entrega envía **bytes idénticos** — así que una entrega que por fin funciona en el cuarto intento se verifica exactamente igual que lo habría hecho el primero. Cada intento se vuelve a firmar con un timestamp nuevo, y por eso un reintento muy retrasado sigue cayendo dentro de una ventana de replay estricta.

## Las tres reglas {#rules}

**1. Firma los bytes en bruto.** Lee el cuerpo una vez, como bytes, y verifica eso. Analizar el JSON y volver a serializarlo cambia el orden de las claves y los espacios en blanco, y la firma se calcula sobre lo que enviamos, no sobre un objeto equivalente. Esta es, con diferencia, la causa más habitual de "la firma nunca coincide" — el payload está bien y la comparación se hace con bytes distintos.

Los frameworks que analizan el JSON de forma anticipada suelen exponer el original por separado: `request.body` en Flask, `req.rawBody` con un hook de verificación de Express, `await request.body()` en FastAPI.

**2. Compara en tiempo constante — con cada token.** Usa `hmac.compare_digest`, `crypto.timingSafeEqual` o `hmac.Equal` — no `==`. Una comparación byte a byte que termina antes de tiempo revela, a través de los tiempos de respuesta, qué parte de una firma adivinada era correcta, lo que convierte la falsificación en una búsqueda abordable. Hacerlo bien no cuesta nada; el coste de hacerlo mal no se ve en las pruebas, porque una implementación incorrecta pasa todos los tests funcionales.

Primero divide la cabecera por `,` y acepta si coincide **cualquier** token. Normalmente hay exactamente un token, así que parece redundante — pero durante una rotación del secreto de firma firmamos con el secreto nuevo y con el anterior y enviamos `sha256=<a>,sha256=<b>`. Un verificador que compara el valor completo de la cabecera con un único token esperado no coincide con ninguno, y rechaza **todas** las entregas mientras dura el solapamiento. Todos los SDKs oficiales dividen la cabecera; es el verificador hecho a mano el que se equivoca en esto.

**3. Rechaza los timestamps antiguos.** Si `X-Webhook-Timestamp` se aleja más de **300 segundos** de tu reloj, rechaza la entrega aunque el HMAC sea correcto. Sin esto, una entrega capturada se puede reenviar indefinidamente. Con ello, la exposición se limita a cinco minutos aunque se intercepte un payload.

La regla 3 depende de que el reloj de tu servidor sea más o menos correcto. Si las entregas empiezan a fallar la verificación de forma masiva tras un cambio de infraestructura, revisa NTP antes que tu código.

## Un handler completo {#example}

```python
import hashlib, hmac, time

WINDOW_SECONDS = 300

def verify(secret: str, raw_body: bytes, signature: str, timestamp: str) -> bool:
    # Rule 3 — replay window, checked first because it is the cheapest rejection.
    try:
        if abs(int(time.time()) - int(timestamp)) > WINDOW_SECONDS:
            return False
    except (TypeError, ValueError):
        return False  # absent or non-numeric header

    # Rule 1 — the raw bytes, exactly as received.
    expected = "sha256=" + hmac.new(
        secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()

    # Rule 2 — constant-time comparison against EVERY token. One token normally; several,
    # comma-separated, while a rotation overlap is in effect.
    return any(
        hmac.compare_digest(expected, token.strip())
        for token in signature.split(",")
    )
```

## Cómo responder {#responding}

Devuelve un `2xx` y consideramos hecha la entrega. Cualquier otra cosa — o ninguna respuesta dentro del timeout — cuenta como fallo y entra en el calendario de reintentos.

Confirma rápido y haz el trabajo después. Un handler que termina una tarea lenta antes de responder mantiene la entrega abierta, y si supera el timeout el trabajo se hace *y* la entrega se reintenta, lo que te da el duplicado que intentabas evitar. Ponlo en cola, devuelve `200` y procésalo aparte.

Sé idempotente de todos modos. La entrega es al menos una vez, así que cuenta con ver el mismo evento dos veces: deduplica por `X-Webhook-Event-Id`, que se mantiene igual en todos los reintentos de una entrega.

## Cómo rotar un secreto {#rotation}

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a/rotate-secret \
  -H "Authorization: Bearer $ADMIN_KEY"
```

El nuevo secreto se devuelve una sola vez. **No** necesitas manejar dos secretos en tu handler: durante unas 24 horas después de una rotación, firmamos cada entrega con el secreto nuevo y con el anterior, y enviamos ambos tokens en una sola cabecera, `sha256=<new>,sha256=<previous>`. Un verificador que sigue la [regla 2](#rules) y comprueba cada token sigue funcionando todo ese tiempo, tenga el secreto que tenga, así que puedes pasar al nuevo de inmediato.

El corolario es la trampa: un verificador que compara el valor completo de la cabecera funciona bien justo hasta la primera rotación, y después lo rechaza todo durante un día. Si rotas y las entregas empiezan a fallar la verificación de forma masiva, esa comparación es lo primero que debes revisar.

## Próximos pasos {#next-steps}

- [SDKs](/docs/product-webhooks/sdks) — helpers `verify` que implementan esta página.
- [Inicio rápido](/docs/product-webhooks/quickstart) — el flujo completo en el que encaja esto.
- [Resumen de Webhooks](/docs/product-webhooks) — la semántica de entrega y la cola dead-letter.
- [Webhooks de la plataforma](/docs/webhooks) — las notificaciones de infraestructura, independientes y firmadas con `NN-`.
