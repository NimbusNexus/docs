---
title: "SDKs de Webhooks"
description: "Clientes tipados para Python, TypeScript y Go — verifica los webhooks entrantes, publica eventos y gestiona endpoints desde tu código."
publishedAt: 2026-08-05
updatedAt: 2026-10-20
kind: sdk
---

# SDKs de Webhooks

> **Estado: publicado.** Python, TypeScript y Go están en sus registros públicos en la versión {{WEBHOOKS_SDK_VERSION}}. Java y PHP están escritos y probados, pero todavía no se han publicado — consulta [el estado actual](#status).

Clientes oficiales de [NimbusNexus Webhooks](/docs/product-webhooks). Todos cubren las mismas cuatro tareas, así que un equipo que usa dos lenguajes obtiene el mismo comportamiento en ambos. Elige un lenguaje en la parte superior de la página y todos los ejemplos lo seguirán; [Configura un SDK](/docs/setup/sdk) es la versión corta de la instalación, la autenticación y una primera llamada.

> **Estos son los clientes de Webhooks.** Los SDKs de Infraestructura (VMs, almacenamiento, red) todavía no están disponibles; llama a esa API [por REST](/docs/setup/rest). Los ejemplos de Go importan el paquete con el alias `nnwh` para que se vea de dónde viene.

La pieza más valiosa es `verify`. La comprobación de firmas es crítica para la seguridad, es fácil implementarla con errores sutiles y esos errores pasan todos los tests funcionales — los SDKs implementan [el contrato completo](/docs/product-webhooks/signatures), incluidas la comparación en tiempo constante y la ventana de replay.

## Instalación {#install}

```bash tab=python
pip install nn-webhooks-sdk
```

```bash tab=typescript
npm install @nimbusnexus/webhooks-sdk
```

```bash tab=go
go get github.com/NimbusNexus/webhooks-go@v{{WEBHOOKS_SDK_VERSION}}
```

## Verifica un webhook entrante {#verify}

Para quien *recibe* webhooks. Pasa los bytes del cuerpo en bruto — nunca un objeto vuelto a serializar.

```python
from nn_webhooks import verify

ok = verify(
    secret=ENDPOINT_SIGNING_SECRET,
    raw_body=request.body,
    signature=request.headers["X-Webhook-Signature"],
    timestamp=request.headers["X-Webhook-Timestamp"],
)
if not ok:
    return Response(status_code=400)   # forged, tampered, or outside the 300s window
```

```ts
import { verify } from "@nimbusnexus/webhooks-sdk";

const ok = verify(secret, rawBody, req.headers["x-webhook-signature"], {
  timestamp: req.headers["x-webhook-timestamp"],
});
if (!ok) return res.status(400).end();
```

```go
import nnwh "github.com/NimbusNexus/webhooks-go"

ts, _ := strconv.ParseInt(r.Header.Get("X-Webhook-Timestamp"), 10, 64)
ok := nnwh.Verify(secret, body, r.Header.Get("X-Webhook-Signature"),
    &nnwh.VerifyOptions{Timestamp: &ts})
```

Pasa siempre el timestamp. Si lo omites, la firma se calcula solo sobre el cuerpo, lo que nunca coincide con lo que enviamos — así que la verificación falla para *todo*, no solo para los replays. Si `verify` devuelve false para entregas que crees auténticas, lo primero que debes comprobar es si falta el timestamp.

## Publica un evento {#publish}

Para *productores*. Los fallos transitorios — errores de conexión, `429`, `5xx` — se reintentan con backoff, y un `429` respeta `Retry-After`. Los demás `4xx` lanzan una excepción.

La clave se emite en tu consola de la cuenta de NimbusNexus — consulta [Cómo obtener acceso](/docs/product-webhooks#access). Una clave `whsk_…` de antes del cambio se rechaza como credencial no reconocida, y ningún SDK comprueba el formato de la clave, así que el fallo aparece como un `403` `invalid_credential` de la API y no como un error al construir el cliente.

```python
from nn_webhooks import Client, WebhooksAPIError

with Client("{{WEBHOOKS_BASE_URL}}", api_key=WEBHOOKS_API_KEY) as wh:
    try:
        event = wh.publish(
            "order.created",
            {"order_id": "ord_123", "total": 4200},
            idempotency_key="order-123",     # makes the publish safe to retry
        )
        print(event.event_uid, event.deliveries_created)
    except WebhooksAPIError as e:
        print(e.status_code, e.code, e.message)
```

```ts
import { WebhooksClient } from "@nimbusnexus/webhooks-sdk";

const wh = new WebhooksClient({ baseUrl: "{{WEBHOOKS_BASE_URL}}", apiKey: WEBHOOKS_API_KEY });
const event = await wh.publish(
  "order.created",
  { order_id: "ord_123", total: 4200 },
  { idempotencyKey: "order-123" },   // makes the publish safe to retry
);
console.log(event.eventUid, event.deliveriesCreated);
```

```go
client := nnwh.New("{{WEBHOOKS_BASE_URL}}", webhooksAPIKey)
event, err := client.Publish(ctx, "order.created",
    map[string]any{"order_id": "ord_123", "total": 4200},
    &nnwh.PublishOptions{IdempotencyKey: "order-123"})
```

## Buffer duradero {#outbox}

`publish()` es síncrono — si la API no está accesible, lanza una excepción y el evento se pierde. El outbox de escritura previa desacopla ambas cosas: `enqueue()` guarda en un almacén y vuelve de inmediato sin ninguna llamada de red, y `drain()` envía lo pendiente más tarde.

```python
from nn_webhooks import Client, SQLiteStore

store = SQLiteStore("outbox.db")

# Construct for the process lifetime — NOT in a `with` block. Closing the client stops the
# drainer, so a `with` that exits immediately would shut down the thread you just started.
wh = Client("{{WEBHOOKS_BASE_URL}}", api_key=WEBHOOKS_API_KEY, store=store)
wh.start_drainer(interval_seconds=5)          # ships in the background

wh.enqueue("order.created", {"order_id": "ord_123"})   # returns at once, no network
...
wh.close()                                     # at shutdown; also stops the drainer
```

Cada envío lleva `Idempotency-Key = record.id`, así que volver a vaciar tras una caída nunca publica dos veces. Un registro que sigue fallando se reintenta con backoff exponencial con tope hasta `max_attempts` (10 por defecto), y después se marca como muerto y se pasa a un callback `on_dead` opcional.

| Almacén | Duradero | Dependencia adicional |
|---|---|---|
| `MemoryStore` | No — en el proceso | ninguna |
| `FileStore(dir)` | Sí | ninguna |
| `SQLiteStore(path)` | Sí, transaccional | ninguna |
| `RedisStore(url)` | Sí | `pip install 'nn-webhooks-sdk[redis]'` |
| `PostgresStore(dsn)` | Sí | `pip install 'nn-webhooks-sdk[postgres]'` |

Ningún almacén necesita una dependencia más allá del propio SDK — la única dependencia de ejecución de Python es `httpx` — y los almacenes de Redis y Postgres importan su controlador de forma diferida, solo cuando se construyen.

## Gestiona endpoints {#manage}

El mismo cliente envuelve el plano de control, con una clave de alcance admin:

```python
ep = wh.create_endpoint(
    "https://your-app.example/webhooks",
    subscriptions=[{"match_kind": "prefix", "pattern": "order."}],
)
endpoint_id, signing_secret = ep["id"], ep["secret"]   # secret returned once

wh.replace_subscriptions(endpoint_id, [                # replaces the whole set
    {"match_kind": "exact", "pattern": "order.paid"},
])
wh.rotate_endpoint_secret(endpoint_id)
wh.enable_endpoint(endpoint_id)                        # recover an auto-disabled endpoint

for d in wh.list_deliveries(status="dead")["items"]:   # drain the dead-letter queue
    wh.redeliver(d["id"])
```

Los métodos de listado devuelven `{"items": [...], "next_offset": int | None}`; los de borrado no devuelven nada con un `204`.

`update_endpoint` no puede cambiar las suscripciones, porque webhookd las ignora en un PATCH: `replace_subscriptions` (`replaceSubscriptions` en TypeScript, `ReplaceSubscriptions` en Go) fija la lista completa de una vez, y una lista vacía da de baja el endpoint de todo.

Los métodos de gestión de claves — `create_api_key`/`revoke_api_key` en Python, `createApiKey`/`revokeApiKey` en TypeScript, Java y PHP, `CreateAPIKey`/`RevokeAPIKey` en Go — siguen en el cliente, pero las rutas `/v1/api-keys` a las que llaman se eliminaron, así que llamar a uno ahora falla con un `404`; emite las claves en la consola de la cuenta.

## Cómo apuntar a un proyecto {#projects}

Un proyecto se identifica por su id (`prj_3f9a…`) — no hay slug ni nombre corto. Deja `project_id` sin definir para apuntar al proyecto por defecto del workspace, que es lo que siempre quiere un workspace con un solo proyecto:

```python
wh.publish("order.created", {...})                          # default project
wh.publish("order.created", {...}, project_id="prj_3f9a…")  # a specific one
```

Solo el servidor puede resolver "el proyecto por defecto", así que omitir el campo es la forma de pedirlo. Pasar una cadena inventada — `"default"`, o el nombre visible de un proyecto — da un `404`. El id real aparece en cualquier respuesta, o se obtiene con `GET /v1/projects`.

## Cómo mantenemos fieles los SDKs {#contract}

Todos los clientes implementan un único contrato de firma: `HMAC-SHA256(secret, "<timestamp>." + raw_body)`, enviado como `X-Webhook-Signature: sha256=<hex>` con una ventana de 300 segundos. Están atados a él mediante un conjunto compartido de vectores de prueba generado por el propio firmador del servidor, así que ningún cliente puede desviarse del servidor ni de los demás — tampoco en CI, donde el paquete del servidor no está instalado.

## Estado actual {#status}

| Lenguaje | Paquete | Estado |
|---|---|---|
| Python | `nn-webhooks-sdk` | Publicado — [PyPI](https://pypi.org/project/nn-webhooks-sdk/), {{WEBHOOKS_SDK_VERSION}} |
| TypeScript | `@nimbusnexus/webhooks-sdk` | Publicado — [npm](https://www.npmjs.com/package/@nimbusnexus/webhooks-sdk), {{WEBHOOKS_SDK_VERSION}} |
| Go | `github.com/NimbusNexus/webhooks-go` | Publicado — [GitHub](https://github.com/NimbusNexus/webhooks-go), v{{WEBHOOKS_SDK_VERSION}} |
| Java | `net.nimbusnexus:webhooks-sdk` | Escrito y probado; todavía no está en Maven Central |
| PHP | `nimbusnexus/webhooks-sdk` | Escrito y probado; todavía no está en Packagist |

Hasta que se publiquen Java y PHP, llama directamente a la API REST — la [página de firmas](/docs/product-webhooks/signatures) tiene todo lo necesario para verificar entregas en cualquier lenguaje, y son unas veinte líneas.

## Próximos pasos {#next-steps}

- [CLI](/docs/product-webhooks/cli) — las mismas operaciones desde un shell.
- [Verificación de firmas](/docs/product-webhooks/signatures) — lo que implementa `verify`.
- [Inicio rápido](/docs/product-webhooks/quickstart) — el flujo que envuelven estos clientes.
- [Idempotencia](/docs/idempotency) — el patrón de toda la plataforma que hay detrás de `idempotency_key`.
