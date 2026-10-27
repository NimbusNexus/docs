---
title: "TypeScript-SDK"
description: "Typisierter Client für die REST-API von NimbusNexus. ESM + CJS, Node 20+, browsertauglich."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: sdk
---

# TypeScript-SDK

> **Status: Vorabversion.** Das SDK befindet sich in aktiver Entwicklung. Diese Seite dokumentiert den Aufbau von v1.0; bis das Paket veröffentlicht ist, verwenden Sie die REST-API direkt, wie in [Authentifizierung](/docs/authentication) und [Konventionen](/docs/conventions) beschrieben.

Ein typisierter TypeScript-Client, der die REST-API v1 kapselt. Dual-Publish als ESM + CJS, Node 20+, läuft im Browser. Aus der Live-OpenAPI-Spezifikation generiert, sodass die Typen konstruktionsbedingt mit der API synchron bleiben.

> **Sie senden Webhooks an Ihre eigenen Kunden?** Das ist das separate [Produkt Webhooks](/docs/product-webhooks), das ein eigenes, veröffentlichtes TypeScript-SDK hat — [`@nimbusnexus/webhooks-sdk`](/docs/product-webhooks/sdks). Diese Seite beschreibt den Client für die Cloud-API von NimbusNexus.

## Installation (nach Veröffentlichung) {#install}

```bash
npm install @nimbusnexus/sdk
# or
pnpm add @nimbusnexus/sdk
# or
yarn add @nimbusnexus/sdk
```

## Kurzbeispiel {#quick}

```ts
import { NimbusNexus } from '@nimbusnexus/sdk'

const nn = new NimbusNexus({
  apiKey: process.env.NIMBUS_KEY!, // never hardcode
})

// List VMs in a region
const { items, pagination } = await nn.vms.list({
  region: 'us-east-1',
  limit: 50,
})

// Create a VM
const vm = await nn.vms.create({
  name: 'web-01',
  size: 'gp-1-2',
  region: 'us-east-1',
  image: 'ubuntu-24.04',
})

// Poll until running
while (vm.state !== 'running') {
  await new Promise(r => setTimeout(r, 1000))
  Object.assign(vm, await nn.vms.get(vm.id))
}
```

## Designprinzipien {#design}

- **Durchgängig typisiert.** Request-Bodys, Query-Parameter, Antwortstrukturen — jeder Endpoint stellt sein vollständiges OpenAPI-Schema als TypeScript-Typ bereit. Kein `any`, keine Casts mit `as` in Ihrem Code.
- **Bildet die REST-API ab.** `nn.vms.list()` entspricht `GET /v1/vms`. `nn.databases.snapshots.list(dbId)` entspricht `GET /v1/databases/{dbId}/snapshots`. Keine eigenen Komfortmethoden, die von der API abweichen.
- **Standardmäßig idempotent.** Jeder ändernde Aufruf erzeugt automatisch einen `Idempotency-Key` (UUID v4). Überschreiben Sie ihn mit `{ idempotencyKey: '...' }`, wenn Sie auf Ihrer Seite über Retries hinweg einen stabilen Key brauchen.
- **Wiederholt bei 429 + 5xx.** Die Standardkonfiguration wiederholt bei `429`, `502`, `503`, `504` mit exponentiellem Backoff + Jitter. Deaktivieren Sie das mit `{ retries: 0 }`, wenn Sie es selbst behandeln wollen.
- **Keine Laufzeitabhängigkeiten im Browser-Bundle.** Serverseitig kommt `node:crypto` für die Helfer zur HMAC-Prüfung hinzu; das Browser-Bundle ist frei von Abhängigkeiten.

## Konfiguration {#config}

```ts
const nn = new NimbusNexus({
  apiKey: process.env.NIMBUS_KEY!,
  // All optional:
  baseUrl: '{{API_BASE_URL}}', // defaults to canonical
  timeout: 30_000,             // request timeout in ms
  retries: 3,                   // max retries on 429 / 5xx
  retryDelay: 1000,             // base delay; doubled per attempt with jitter
  userAgent: 'my-app/2.4',      // appended to the default `nimbusnexus-sdk/<ver>` UA
  fetch: customFetch,           // optional fetch implementation override
})
```

## Helfer zur Webhook-Prüfung {#webhooks}

```ts
import { verifyWebhook } from '@nimbusnexus/sdk/webhooks'

export async function POST(req: Request) {
  const body = await req.text()
  const ok = verifyWebhook({
    body,
    timestamp: req.headers.get('NN-Timestamp')!,
    signature: req.headers.get('NN-Signature')!,
    secret: process.env.NIMBUS_WEBHOOK_SECRET!,
  })
  if (!ok) return new Response('bad signature', { status: 401 })

  // handle event...
  return new Response('ok')
}
```

Der Prüfer übernimmt HMAC + Vergleich in konstanter Zeit + Prüfung des Replay-Fensters. Bauen Sie das nicht selbst nach — ein Fehler bei einem dieser Punkte ist das übliche Muster hinter Webhook-Spoofing.

## Helfer für die Paginierung {#pagination}

```ts
// Manual paging
for (const page of nn.vms.listPages({ region: 'us-east-1' })) {
  console.log(`got ${page.items.length} VMs`)
}

// Auto-flatten
for await (const vm of nn.vms.listAll({ region: 'us-east-1' })) {
  console.log(vm.name)
}
```

`listPages()` und `listAll()` sind asynchrone Iteratoren, die das Durchlaufen der Cursor für Sie übernehmen. Details zur zugrunde liegenden Mechanik finden Sie unter [Paginierung](/docs/pagination).

## Aktueller Stand {#status}

Das SDK wird aus der OpenAPI-Spezifikation generiert, ist aber noch nicht veröffentlicht. Bis dahin:

- Verwenden Sie die REST-API direkt. Authentifizierung + Konventionen sind dokumentiert und stabil.
- Der Aufbau des SDK auf dieser Seite ist das API-Design, auf das wir uns festlegen; er ändert sich vor v1.0 nicht.
- Abonnieren Sie den Changelog unter [{{BASE_URL}}/changelog]({{BASE_URL}}/changelog), um die Ankündigung des Releases zu erhalten.

## Nächste Schritte {#next-steps}

- [Authentifizierung](/docs/authentication) — was `apiKey` auf Protokollebene bewirkt.
- [Plattform-Webhooks](/docs/webhooks) — was `verifyWebhook` prüft.
- [Paginierung](/docs/pagination) — was `listAll` und `listPages` durchlaufen.
