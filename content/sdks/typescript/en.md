---
title: TypeScript SDK
description: Typed client for the NimbusNexus REST API. ESM + CJS, Node 20+, browser-friendly.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: sdk
---

# TypeScript SDK

> **Status: pre-release.** The SDK is in active development. This page documents the v1.0 shape; until the package is published, use the REST API directly per [Authentication](/docs/authentication) and [Conventions](/docs/conventions).

A typed TypeScript client that wraps the v1 REST API. ESM + CJS dual-publish, Node 20+, runs in the browser. Generated from the live OpenAPI spec, so types stay in sync with the API by construction.

## Install (when shipped) {#install}

```bash
npm install @nimbusnexus/sdk
# or
pnpm add @nimbusnexus/sdk
# or
yarn add @nimbusnexus/sdk
```

## Quick usage {#quick}

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

## Design principles {#design}

- **Typed end-to-end.** Request bodies, query params, response shapes — every endpoint surfaces its full OpenAPI schema as a TypeScript type. No `any`, no `as` casts in your code.
- **Mirrors the REST API.** `nn.vms.list()` is `GET /v1/vms`. `nn.databases.snapshots.list(dbId)` is `GET /v1/databases/{dbId}/snapshots`. No bespoke convenience methods that drift from the API.
- **Idempotency by default.** Every mutating call generates an `Idempotency-Key` automatically (UUID v4). Override with `{ idempotencyKey: '...' }` if you need a stable key across retries on your side.
- **Retries 429 + 5xx.** Default config retries with exponential backoff + jitter on `429`, `502`, `503`, `504`. Disable with `{ retries: 0 }` if you want to handle yourself.
- **No runtime dependencies in browser bundle.** Server-side adds `node:crypto` for HMAC verification helpers; the browser bundle is dependency-free.

## Configuration {#config}

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

## Webhook verification helper {#webhooks}

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

The verifier handles the HMAC + constant-time comparison + replay-window check. Don't roll your own — getting any of those wrong is the standard webhook-spoofing pattern.

## Pagination helper {#pagination}

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

`listPages()` and `listAll()` are async iterators that handle the cursor walk for you. See [Pagination](/docs/pagination) for the underlying mechanics.

## Where it stands today {#status}

The SDK is being generated from the OpenAPI spec but hasn't been published yet. While you wait:

- Use the REST API directly. Auth + conventions are documented and stable.
- The SDK shape on this page is the API design we're committing to; it won't change before v1.0.
- Subscribe to the changelog at [{{BASE_URL}}/changelog]({{BASE_URL}}/changelog) for the release announcement.

## What's next {#next-steps}

- [Authentication](/docs/authentication) — what `apiKey` does on the wire.
- [Webhooks](/docs/webhooks) — what `verifyWebhook` is checking.
- [Pagination](/docs/pagination) — what `listAll` and `listPages` are walking.
