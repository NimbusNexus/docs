---
title: "SDK de Python"
description: "Cliente de Python tipado para la API REST de NimbusNexus. Python 3.11+, síncrono y asíncrono."
publishedAt: 2026-05-20
updatedAt: 2026-10-15
kind: sdk
---

# SDK de Python

> **Estado: versión preliminar.** El SDK está en desarrollo activo. Esta página documenta la forma de la v1.0; hasta que se publique el paquete, usa directamente la API REST según [Autenticación](/docs/authentication) y [Convenciones](/docs/conventions).

Un cliente de Python tipado. Síncrono y asíncrono (basado en httpx), Python 3.11+ y modelos Pydantic completos para cada forma de respuesta.

> **¿Quieres enviar webhooks a tus propios clientes?** Para eso está el [producto Webhooks](/docs/product-webhooks), que es independiente y tiene su propio SDK de Python publicado: el paquete `nn-webhooks-sdk`, que se importa como `nn_webhooks` ([SDKs de Webhooks](/docs/product-webhooks/sdks)). Esta página trata del cliente de la API de la nube de NimbusNexus.

## Instalación {#install}

El cliente de esta página todavía no está publicado y no existe ningún paquete `nimbusnexus` en PyPI, así que no instales ninguno con ese nombre. (Las versiones anteriores de esta página mostraban `pip install nimbusnexus`.)

El paquete de Python que publicamos hoy es el SDK de Webhooks:

```bash
pip install nn-webhooks-sdk
# or
uv add nn-webhooks-sdk
# or
poetry add nn-webhooks-sdk
```

Instala el módulo `nn_webhooks` (`from nn_webhooks import Client`), para Python 3.11 y posteriores.

## Uso rápido {#quick}

```python
import os
from nimbusnexus import NimbusNexus

nn = NimbusNexus(api_key=os.environ["NIMBUS_KEY"])

# List VMs in a region
page = nn.vms.list(region="us-east-1", limit=50)
for vm in page.items:
    print(vm.id, vm.name, vm.state)

# Create a VM
vm = nn.vms.create(
    name="web-01",
    size="gp-1-2",
    region="us-east-1",
    image="ubuntu-24.04",
)

# Poll until running
while vm.state != "running":
    time.sleep(1)
    vm = nn.vms.get(vm.id)
```

## Cliente asíncrono {#async}

```python
import asyncio
from nimbusnexus import AsyncNimbusNexus

async def main():
    nn = AsyncNimbusNexus(api_key=os.environ["NIMBUS_KEY"])
    async with nn:
        vm = await nn.vms.create(
            name="web-01",
            size="gp-1-2",
            region="us-east-1",
            image="ubuntu-24.04",
        )
        print(vm.id)

asyncio.run(main())
```

Los clientes síncrono y asíncrono comparten la misma interfaz (coinciden todos los nombres y firmas de métodos); elige el que encaje con tu entorno de ejecución. El cliente asíncrono se basa en httpx y es el recomendado para cualquier carga de trabajo limitada por E/S.

## Principios de diseño {#design}

- **Tipado con Pydantic.** Cada respuesta es un modelo Pydantic; mypy/pyright ven los tipos completos. Los kwargs de la petición se validan antes de enviarse — una errata en el nombre de un campo falla en el momento de la llamada, no después de un 400.
- **Refleja la API REST.** `nn.vms.list()` es `GET /v1/vms`. `nn.databases.snapshots.list(db_id)` es `GET /v1/databases/{db_id}/snapshots`. Sin métodos de conveniencia a medida que se alejen de la API.
- **Idempotencia por defecto.** Cada llamada de escritura genera una `Idempotency-Key` (UUID v4). Sustitúyela con `idempotency_key="..."` para tener claves estables entre reintentos.
- **Reintenta los 429 y 5xx.** Backoff + jitter configurables, desactivados por defecto en las peticiones en bruto y activados por defecto en los métodos de recursos de alto nivel.
- **Sin dependencia de httpx en el cliente síncrono.** El cliente síncrono se basa en `urllib3`, sin dependencias adicionales. El cliente asíncrono depende de httpx.

## Configuración {#config}

```python
nn = NimbusNexus(
    api_key=os.environ["NIMBUS_KEY"],
    base_url="{{API_BASE_URL}}",  # defaults to canonical
    timeout=30,                    # seconds
    max_retries=3,
    retry_backoff=1.0,             # base; doubled per attempt with jitter
    user_agent="my-app/2.4",       # appended to the default UA
)
```

## Helper de verificación de webhooks {#webhooks}

```python
from nimbusnexus.webhooks import verify_webhook
from flask import request, abort

@app.route("/webhooks/nimbusnexus", methods=["POST"])
def webhook():
    if not verify_webhook(
        body=request.get_data(),
        timestamp=request.headers["NN-Timestamp"],
        signature=request.headers["NN-Signature"],
        secret=os.environ["NIMBUS_WEBHOOK_SECRET"],
    ):
        abort(401)

    event = request.get_json()
    # handle event...
    return "", 200
```

El verificador se encarga de HMAC-SHA256 + la comparación en tiempo constante + la comprobación de la ventana de replay. No escribas el tuyo propio; ahí es donde está la mayoría de los fallos que permiten suplantar webhooks.

## Helper de paginación {#pagination}

```python
# Manual paging
for page in nn.vms.list_pages(region="us-east-1"):
    print(f"got {len(page.items)} VMs")

# Auto-flatten — yields one resource per iteration
for vm in nn.vms.list_all(region="us-east-1"):
    print(vm.name)
```

Los dos devuelven iteradores que recorren el cursor por ti. Consulta [Paginación](/docs/pagination) para ver el mecanismo subyacente.

## Errores como excepciones {#errors}

### En el SDK de Webhooks publicado {#errors-webhooks-sdk}

`nn-webhooks-sdk` tiene dos clases de excepción, ambas en `nn_webhooks.errors`:

| Clase | Se lanza cuando | Contiene |
|---|---|---|
| `WebhooksError` | Es la clase base. Se lanza ella misma ante un fallo de red que persiste tras los reintentos, y ante un mal uso, como llamar a `enqueue()` en un `Client` creado sin almacén. | Un mensaje |
| `WebhooksAPIError` | La API ha respondido con un estado que no es 2xx. Es una subclase de `WebhooksError`. | `status_code`, `code`, `message` |

No hay una clase por código. `code` es el `error.code` de la API, sin cambios, así que compáralo con los códigos que aparecen en [Errores](/docs/errors). Si una respuesta no tiene cuerpo de error JSON (un `502` de un gateway, por ejemplo), `code` es `"error"` y `message` es el texto en bruto de la respuesta. `details` no se incluye. Un `429`, `500`, `502`, `503` o `504` se reintenta hasta `max_retries` veces (2 por defecto), respetando `Retry-After`; después se lanza el `WebhooksAPIError`. Cualquier otro `4xx` o `5xx`, incluido un `501`, lanza la excepción de inmediato.

```python
from nn_webhooks import Client, WebhooksAPIError

with Client("{{WEBHOOKS_BASE_URL}}", api_key=WEBHOOKS_API_KEY) as wh:
    try:
        wh.publish("order.created", {"order_id": "ord_123"}, idempotency_key="order-123")
    except WebhooksAPIError as e:
        if e.code in ("validation_error", "unknown_event_type", "invalid_payload"):
            ...  # fix the request; sending it again won't help
        elif e.code == "quota_exceeded":
            ...  # monthly delivery quota: wait for the next period, or upgrade
        elif e.code == "invalid_credential":
            ...  # replace the key
        else:
            print(e.status_code, e.code, e.message)
```

A partir del lanzamiento de la v1, un código renombrado se gestiona según la [política de obsolescencia](/docs/versioning#deprecation): el cambio de nombre se anuncia en el [changelog](/changelog) y el nombre antiguo sigue llegando en `code` durante al menos 12 meses. Los cambios de nombre de Webhooks que aparecen en [Cuando se renombra un código](/docs/errors#renames) se aplicaron el 2026-10-15, antes del lanzamiento de la v1, sin ese periodo.

### En el cliente de la API de la nube (previsto) {#errors-planned}

El cliente de esta página lanzará una clase por familia de códigos de estado. Cada una contiene `status_code`, `code`, `message` y `details` exactamente como los envía la API:

```python
from nimbusnexus.errors import (
    NimbusError,                # base class
    AuthenticationError,        # 401 unauthorized, 403 invalid_credential
    PermissionError,            # 403 forbidden
    PlanError,                  # 402 quota_exceeded, not_entitled, workspace_frozen, ...
    ValidationError,            # 422 validation_error (carries .details)
    NotFoundError,              # 404 not_found
    ConflictError,              # 409 conflict
    RateLimitError,             # 429 rate_limited (carries .retry_after_seconds)
    ServerError,                # 5xx — retryable
)

try:
    vm = nn.vms.create(name="web-01", size="gp-1-2", region="us-east-1", image="ubuntu-24.04")
except ValidationError as e:
    for entry in e.details["errors"]:
        print(f"  {entry['loc']}: {entry['msg']}")
except RateLimitError as e:
    print(f"slow down — wait {e.retry_after_seconds}s")
```

Las versiones anteriores de esta página asociaban estas clases a `invalid_credentials`, `expired_credentials`, `scope_required`, `wrong_project` y a un `400 validation_failed` con `.fields`. Las APIs nunca han enviado esos códigos; los comentarios de arriba usan los que sí envían.

## Estado actual {#status}

El SDK se está generando a partir de la especificación OpenAPI, pero todavía no se ha publicado. Mientras tanto:

- Usa directamente la API REST. La autenticación y las convenciones están documentadas y son estables.
- La forma que muestra esta página es el diseño de API con el que nos comprometemos.
- Suscríbete al [changelog]({{BASE_URL}}/changelog) para enterarte del anuncio de la versión.

## Próximos pasos {#next-steps}

- [Autenticación](/docs/authentication) — qué hace `api_key` en la petición HTTP.
- [Webhooks de la plataforma](/docs/webhooks) — qué comprueba `verify_webhook`.
- [Paginación](/docs/pagination) — qué recorren `list_all` y `list_pages`.
- [Errores](/docs/errors) — los códigos de error que corresponden a las clases de excepción de arriba.
