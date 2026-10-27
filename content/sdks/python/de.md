---
title: "Python-SDK"
description: "Typisierter Python-Client für die REST-API von NimbusNexus. Python 3.11+, Sync + async."
publishedAt: 2026-05-20
updatedAt: 2026-10-15
kind: sdk
---

# Python-SDK

> **Status: Vorabversion.** Das SDK befindet sich in aktiver Entwicklung. Diese Seite dokumentiert den Aufbau von v1.0; bis das Paket veröffentlicht ist, verwenden Sie die REST-API direkt, wie in [Authentifizierung](/docs/authentication) und [Konventionen](/docs/conventions) beschrieben.

Ein typisierter Python-Client. Sync + async (auf Basis von httpx), Python 3.11+, vollständige Pydantic-Modelle für jede Antwortstruktur.

> **Sie senden Webhooks an Ihre eigenen Kunden?** Das ist das separate [Produkt Webhooks](/docs/product-webhooks), das ein eigenes, veröffentlichtes Python-SDK hat: das Paket `nn-webhooks-sdk`, importiert als `nn_webhooks` ([SDKs für Webhooks](/docs/product-webhooks/sdks)). Diese Seite beschreibt den Client für die Cloud-API von NimbusNexus.

## Installation {#install}

Der Client auf dieser Seite ist noch nicht veröffentlicht, und auf PyPI gibt es kein Paket `nimbusnexus`; installieren Sie also keines unter diesem Namen. (Frühere Versionen dieser Seite zeigten `pip install nimbusnexus`.)

Das Python-Paket, das wir heute veröffentlichen, ist das Webhooks-SDK:

```bash
pip install nn-webhooks-sdk
# or
uv add nn-webhooks-sdk
# or
poetry add nn-webhooks-sdk
```

Es installiert das Modul `nn_webhooks` (`from nn_webhooks import Client`), für Python 3.11 und neuer.

## Kurzbeispiel {#quick}

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

## Async-Client {#async}

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

Der Sync- und der Async-Client haben dieselbe Oberfläche (jeder Methodenname und jede Signatur stimmen überein); wählen Sie, was zu Ihrer Laufzeitumgebung passt. Der Async-Client basiert auf httpx und wird für alle I/O-gebundenen Workloads empfohlen.

## Designprinzipien {#design}

- **Typisiert mit Pydantic.** Jede Antwort ist ein Pydantic-Modell; mypy/pyright sehen die vollständigen Typen. Request-kwargs werden validiert, bevor sie gesendet werden — Tippfehler in Feldnamen schlagen beim Aufruf fehl, nicht erst nach einem 400.
- **Bildet die REST-API ab.** `nn.vms.list()` entspricht `GET /v1/vms`. `nn.databases.snapshots.list(db_id)` entspricht `GET /v1/databases/{db_id}/snapshots`. Keine eigenen Komfortmethoden, die von der API abweichen.
- **Standardmäßig idempotent.** Jeder ändernde Aufruf erzeugt einen `Idempotency-Key` (UUID v4). Überschreiben Sie ihn mit `idempotency_key="..."`, wenn Sie über Retries hinweg stabile Keys brauchen.
- **Wiederholt bei 429 + 5xx.** Konfigurierbares Backoff + Jitter, bei rohen Requests standardmäßig aus, bei den High-Level-Ressourcenmethoden standardmäßig an.
- **Keine httpx-Abhängigkeit für Sync.** Der Sync-Client basiert auf `urllib3`, ohne zusätzliche Abhängigkeiten. Der Async-Client hängt von httpx ab.

## Konfiguration {#config}

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

## Helfer zur Webhook-Prüfung {#webhooks}

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

Der Prüfer übernimmt HMAC-SHA256 + Vergleich in konstanter Zeit + Prüfung des Replay-Fensters. Bauen Sie das nicht selbst nach; genau dort stecken die meisten Bugs, die Webhook-Spoofing ermöglichen.

## Helfer für die Paginierung {#pagination}

```python
# Manual paging
for page in nn.vms.list_pages(region="us-east-1"):
    print(f"got {len(page.items)} VMs")

# Auto-flatten — yields one resource per iteration
for vm in nn.vms.list_all(region="us-east-1"):
    print(vm.name)
```

Beide liefern Iteratoren, die das Durchlaufen der Cursor für Sie übernehmen. Details zur zugrunde liegenden Mechanik finden Sie unter [Paginierung](/docs/pagination).

## Fehler als Exceptions {#errors}

### Im veröffentlichten Webhooks-SDK {#errors-webhooks-sdk}

`nn-webhooks-sdk` hat zwei Exception-Klassen, beide in `nn_webhooks.errors`:

| Klasse | Ausgelöst, wenn | Enthält |
|---|---|---|
| `WebhooksError` | Die Basisklasse. Wird selbst bei einem Netzwerkfehler ausgelöst, der nach den Retries weiter besteht, und bei Fehlbedienung, etwa wenn Sie `enqueue()` auf einem `Client` aufrufen, der ohne Store erstellt wurde. | Eine Nachricht |
| `WebhooksAPIError` | Die API hat mit einem Status außerhalb von 2xx geantwortet. Eine Unterklasse von `WebhooksError`. | `status_code`, `code`, `message` |

Es gibt keine Klasse pro Code. `code` ist der `error.code` der API, unverändert durchgereicht; verzweigen Sie also anhand der Codes, die unter [Fehler](/docs/errors) aufgeführt sind. Hat eine Antwort keinen JSON-Fehler-Body (etwa ein `502` von einem Gateway), ist `code` gleich `"error"` und `message` der rohe Antworttext. `details` wird nicht übernommen. Ein `429`, `500`, `502`, `503` oder `504` wird bis zu `max_retries` Mal wiederholt (Standard 2), unter Beachtung von `Retry-After`; danach wird der `WebhooksAPIError` ausgelöst. Jeder andere Status `4xx` oder `5xx`, einschließlich `501`, löst sofort eine Exception aus.

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

Ab dem Start von v1 wird ein umbenannter Code nach der [Abkündigungsrichtlinie](/docs/versioning#deprecation) behandelt: Die Umbenennung wird im [Changelog](/changelog) angekündigt, und die alte Schreibweise kommt mindestens 12 Monate lang weiter in `code` an. Die Umbenennungen bei Webhooks, die unter [Wenn ein Code umbenannt wird](/docs/errors#renames) aufgeführt sind, erfolgten am 15.10.2026, vor dem Start von v1, ohne diese Frist.

### Im Client für die Cloud-API (geplant) {#errors-planned}

Der Client auf dieser Seite wird eine Exception-Klasse pro Statusklasse auslösen. Jede enthält `status_code`, `code`, `message` und `details` genau so, wie die API sie sendet:

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

Frühere Versionen dieser Seite ordneten diese Klassen `invalid_credentials`, `expired_credentials`, `scope_required`, `wrong_project` und einem `400 validation_failed` mit `.fields` zu. Diese Codes haben die APIs nie gesendet; die Kommentare oben verwenden die Codes, die sie tatsächlich senden.

## Aktueller Stand {#status}

Das SDK wird aus der OpenAPI-Spezifikation generiert, ist aber noch nicht veröffentlicht. Bis dahin:

- Verwenden Sie die REST-API direkt. Authentifizierung + Konventionen sind dokumentiert und stabil.
- Der Aufbau auf dieser Seite ist das API-Design, auf das wir uns festlegen.
- Abonnieren Sie den [Changelog]({{BASE_URL}}/changelog), um die Ankündigung des Releases zu erhalten.

## Nächste Schritte {#next-steps}

- [Authentifizierung](/docs/authentication) — was `api_key` auf Protokollebene bewirkt.
- [Plattform-Webhooks](/docs/webhooks) — was `verify_webhook` prüft.
- [Paginierung](/docs/pagination) — was `list_all` und `list_pages` durchlaufen.
- [Fehler](/docs/errors) — die Fehlercodes, die den Exception-Klassen oben entsprechen.
