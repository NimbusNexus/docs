---
title: "SDKs für Webhooks"
description: "Typisierte Clients für Python, TypeScript und Go — aus Ihrem Code eingehende Webhooks prüfen, Events veröffentlichen und Endpoints verwalten."
publishedAt: 2026-08-05
updatedAt: 2026-10-20
kind: sdk
---

# SDKs für Webhooks

> **Status: veröffentlicht.** Python, TypeScript und Go stehen in Version {{WEBHOOKS_SDK_VERSION}} in ihren öffentlichen Registrys. Java und PHP sind geschrieben und getestet, aber noch nicht veröffentlicht — siehe [Aktueller Stand](#status).

Offizielle Clients für [Webhooks](/docs/product-webhooks). Jeder deckt dieselben vier Aufgaben ab, sodass ein Team, das zwei Sprachen nutzt, in beiden dasselbe Verhalten bekommt. Wählen Sie oben auf der Seite eine Sprache, und jedes Beispiel folgt ihr; [SDK einrichten](/docs/setup/sdk) ist die Kurzfassung von Installation, Authentifizierung und erstem Aufruf.

> **Dies sind die Clients für Webhooks.** SDKs für Infrastruktur (VMs, Speicher, Netzwerk) gibt es noch nicht; rufen Sie diese API [über REST](/docs/setup/rest) auf. Die Go-Beispiele importieren das Paket unter dem Alias `nnwh`, damit seine Herkunft sichtbar bleibt.

Der wertvollste Teil ist `verify`. Die Signaturprüfung ist sicherheitskritisch und leicht auf subtile Weise falsch umzusetzen, und zwar so, dass jeder funktionale Test besteht — die SDKs setzen [die vollständige Spezifikation](/docs/product-webhooks/signatures) um, einschließlich des Vergleichs in konstanter Zeit und des Replay-Fensters.

## Installation {#install}

```bash tab=python
pip install nn-webhooks-sdk
```

```bash tab=typescript
npm install @nimbusnexus/webhooks-sdk
```

```bash tab=go
go get github.com/NimbusNexus/webhooks-go@v{{WEBHOOKS_SDK_VERSION}}
```

## Eingehenden Webhook prüfen {#verify}

Für alle, die Webhooks *empfangen*. Übergeben Sie die Roh-Bytes des Bodys — nie ein neu serialisiertes Objekt.

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

Übergeben Sie immer den Timestamp. Fehlt er, wird die Signatur nur über den Body berechnet, was nie zu dem passt, was wir senden — die Prüfung schlägt dann für *alles* fehl, nicht nur für Replays. Wenn `verify` bei Zustellungen, die Sie für echt halten, false zurückgibt, prüfen Sie zuerst, ob der Timestamp fehlt.

## Event veröffentlichen {#publish}

Für *Produzenten*. Vorübergehende Fehler — Verbindungsfehler, `429`, `5xx` — werden mit Backoff wiederholt, und bei `429` wird `Retry-After` beachtet. Andere `4xx` lösen eine Exception aus.

Den Key erstellen Sie in Ihrer NimbusNexus-Kontokonsole — siehe [Zugang erhalten](/docs/product-webhooks#access). Ein Key mit `whsk_…` von vor der Umstellung wird als unbekanntes Credential abgewiesen, und kein SDK prüft das Format des Keys. Der Fehler zeigt sich daher als `403` `invalid_credential` von der API, nicht als Fehler beim Erzeugen des Clients.

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

## Dauerhafte Pufferung {#outbox}

`publish()` ist synchron — ist die API nicht erreichbar, löst es eine Exception aus, und das Event ist verloren. Die Outbox, die zuerst schreibt, entkoppelt beides: `enqueue()` speichert in einen Store und kehrt sofort ohne Netzwerkaufruf zurück, und `drain()` sendet den Rückstand später.

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

Jeder Versand trägt `Idempotency-Key = record.id`, sodass erneutes Abarbeiten nach einem Absturz nie doppelt veröffentlicht. Ein Eintrag, der wiederholt fehlschlägt, wird mit begrenztem exponentiellem Backoff bis zu `max_attempts` (Standard 10) wiederholt, dann als tot markiert und an einen optionalen Callback `on_dead` übergeben.

| Store | Dauerhaft | Zusätzliche Abhängigkeit |
|---|---|---|
| `MemoryStore` | Nein — im Prozess | keine |
| `FileStore(dir)` | Ja | keine |
| `SQLiteStore(path)` | Ja, transaktional | keine |
| `RedisStore(url)` | Ja | `pip install 'nn-webhooks-sdk[redis]'` |
| `PostgresStore(dsn)` | Ja | `pip install 'nn-webhooks-sdk[postgres]'` |

Kein Store braucht eine Abhängigkeit über das SDK selbst hinaus — die einzige Laufzeitabhängigkeit des Python-SDKs ist `httpx` —, und die Stores für Redis und Postgres importieren ihren Treiber verzögert, erst wenn sie erzeugt werden.

## Endpoints verwalten {#manage}

Derselbe Client kapselt die Control Plane, mit einem Key mit dem Scope `admin`:

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

Listenmethoden liefern `{"items": [...], "next_offset": int | None}`; Löschmethoden liefern bei `204` nichts zurück.

`update_endpoint` kann keine Abos ändern, weil webhookd sie bei einem PATCH ignoriert: `replace_subscriptions` (`replaceSubscriptions` in TypeScript, `ReplaceSubscriptions` in Go) setzt die ganze Liste auf einmal, und eine leere Liste meldet den Endpoint von allen Abos ab.

Die Methoden zur Key-Verwaltung — `create_api_key`/`revoke_api_key` in Python, `createApiKey`/`revokeApiKey` in TypeScript, Java und PHP, `CreateAPIKey`/`RevokeAPIKey` in Go — sind noch im Client vorhanden, aber die Routen `/v1/api-keys`, die sie aufrufen, wurden entfernt. Ein Aufruf schlägt daher jetzt mit `404` fehl; erstellen Sie Keys stattdessen in der Kontokonsole.

## Ein Projekt ansprechen {#projects}

Ein Projekt wird über seine ID adressiert (`prj_3f9a…`) — es gibt keinen Slug und keinen Kurznamen. Lassen Sie `project_id` weg, um das Standardprojekt des Workspaces anzusprechen; das ist in einem Workspace mit nur einem Projekt immer das Richtige:

```python
wh.publish("order.created", {...})                          # default project
wh.publish("order.created", {...}, project_id="prj_3f9a…")  # a specific one
```

Nur der Server kann „das Standardprojekt“ auflösen, daher fragen Sie es an, indem Sie das Feld weglassen. Ein erfundener String — `"default"` oder der Anzeigename eines Projekts — führt zu `404`. Die echte ID steht in jeder Antwort oder kommt von `GET /v1/projects`.

## Wie die SDKs korrekt bleiben {#contract}

Alle Clients setzen eine einzige Signaturspezifikation um: `HMAC-SHA256(secret, "<timestamp>." + raw_body)`, gesendet als `X-Webhook-Signature: sha256=<hex>` mit einem Fenster von 300 Sekunden. Ein gemeinsames Fixture mit Testvektoren, das der Signierer des Servers selbst erzeugt, bindet sie daran, sodass kein Client vom Server oder von den anderen Clients abweichen kann — auch nicht in CI, wo das Server-Paket nicht installiert ist.

## Aktueller Stand {#status}

| Sprache | Paket | Status |
|---|---|---|
| Python | `nn-webhooks-sdk` | Veröffentlicht — [PyPI](https://pypi.org/project/nn-webhooks-sdk/), {{WEBHOOKS_SDK_VERSION}} |
| TypeScript | `@nimbusnexus/webhooks-sdk` | Veröffentlicht — [npm](https://www.npmjs.com/package/@nimbusnexus/webhooks-sdk), {{WEBHOOKS_SDK_VERSION}} |
| Go | `github.com/NimbusNexus/webhooks-go` | Veröffentlicht — [GitHub](https://github.com/NimbusNexus/webhooks-go), v{{WEBHOOKS_SDK_VERSION}} |
| Java | `net.nimbusnexus:webhooks-sdk` | Geschrieben und getestet; noch nicht auf Maven Central |
| PHP | `nimbusnexus/webhooks-sdk` | Geschrieben und getestet; noch nicht auf Packagist |

Bis Java und PHP veröffentlicht sind, rufen Sie die REST-API direkt auf — die [Seite zur Signaturprüfung](/docs/product-webhooks/signatures) enthält alles, was Sie brauchen, um Zustellungen in jeder Sprache zu prüfen, und das sind etwa zwanzig Zeilen.

## Nächste Schritte {#next-steps}

- [CLI](/docs/product-webhooks/cli) — dieselben Operationen aus einer Shell.
- [Signaturprüfung](/docs/product-webhooks/signatures) — was `verify` umsetzt.
- [Schnellstart](/docs/product-webhooks/quickstart) — der Ablauf, den diese Clients kapseln.
- [Idempotenz](/docs/idempotency) — das plattformweite Muster hinter `idempotency_key`.
