---
title: "SDK einrichten"
description: "Das Webhooks-SDK für Python, TypeScript oder Go installieren, mit einem API-Key authentifizieren und den ersten Aufruf senden."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: sdk
---

# SDK einrichten

Webhooks hat offizielle SDKs für Python, TypeScript und Go, alle in Version {{WEBHOOKS_SDK_VERSION}}. Sie wiederholen Aufrufe bei vorübergehenden Fehlern, prüfen Webhook-Signaturen und können Events puffern, während die API nicht erreichbar ist. Wählen Sie oben auf der Seite eine Sprache, und jedes Beispiel folgt ihr.

Inboxes und QR-Codes haben noch kein SDK; rufen Sie sie [über REST](/docs/setup/rest) auf. Die [API-Referenz](/docs/reference) zeigt jeden ihrer Aufrufe mit dem üblichen HTTP-Client Ihrer Sprache. SDKs für Infrastruktur (VMs, Speicher, Datenbanken) gibt es ebenfalls noch nicht.

## 1 · Installation {#install}

```bash tab=python
pip install nn-webhooks-sdk
```

```bash tab=typescript
npm install @nimbusnexus/webhooks-sdk
```

```bash tab=go
go get github.com/NimbusNexus/webhooks-go@v{{WEBHOOKS_SDK_VERSION}}
```

Python benötigt 3.11 oder neuer, TypeScript benötigt Node.js 24 oder neuer und Go benötigt 1.25 oder neuer. Das Python-Paket wird als `nn-webhooks-sdk` installiert und als `nn_webhooks` importiert.

## 2 · Authentifizieren {#auth}

Erstellen Sie einen Webhooks-Key in Ihrer [Kontokonsole]({{ACCOUNT_BASE_URL}}/api-keys) unter **API keys**: Details finden Sie unter [API-Key erstellen](/docs/setup/rest#key). Bauen Sie dann damit einen Client. Lesen Sie den Key aus der Umgebung, statt ihn in Ihren Code zu schreiben.

```python
import os
from nn_webhooks import Client

wh = Client("{{WEBHOOKS_BASE_URL}}", api_key=os.environ["WEBHOOKS_API_KEY"])
```

```ts
import { WebhooksClient } from '@nimbusnexus/webhooks-sdk'

const wh = new WebhooksClient({
  baseUrl: '{{WEBHOOKS_BASE_URL}}',
  apiKey: process.env.WEBHOOKS_API_KEY!,
})
```

```go
import nnwh "github.com/NimbusNexus/webhooks-go"

ctx := context.Background()
client := nnwh.New("{{WEBHOOKS_BASE_URL}}", os.Getenv("WEBHOOKS_API_KEY"))
```

## 3 · Ersten Aufruf senden {#first-call}

Listen Sie Ihre letzten Zustellungen auf. Der Aufruf liest nur, daher kann ihn jeder Key mit dem Scope `admin` oder `read` ausführen.

```python
page = wh.list_deliveries()
for d in page["items"]:
    print(d["id"], d["status"], d["attempts"])
```

```ts
const page = await wh.listDeliveries()
for (const d of page.items) console.log(d.id, d.status, d.attempts)
```

```go
page, err := client.ListDeliveries(ctx, nil)
if err != nil {
    log.Fatal(err)
}
for _, d := range page.Items {
    fmt.Println(d.Id, d.Status)
}
```

Eine leere Liste bedeutet, dass der Key funktioniert und noch nichts zugestellt wurde. Um Ihr erstes Event zu veröffentlichen, folgen Sie dem [Schnellstart für Webhooks](/docs/product-webhooks/quickstart).

## Nächste Schritte {#next-steps}

- [SDKs für Webhooks](/docs/product-webhooks/sdks): Signaturen prüfen, veröffentlichen, die dauerhafte Outbox, Endpoints verwalten.
- [Referenz für die Webhooks-API](/docs/reference/webhooks): jede Operation, mit dem SDK-Aufruf, wo das SDK einen hat.
- [CLI](/docs/setup/cli): dieselben Operationen aus einer Shell.
