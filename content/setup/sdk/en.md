---
title: Set up an SDK
description: Install the Webhooks SDK for Python, TypeScript or Go, authenticate it with an API key, and make a first call.
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: sdk
---

# Set up an SDK

Webhooks has official SDKs for Python, TypeScript and Go, all at version {{WEBHOOKS_SDK_VERSION}}. They retry transient failures, verify webhook signatures and can buffer events while the API is unreachable. Pick a language at the top of the page and every example follows it.

Inboxes and QR Codes have no SDK yet; call them [over REST](/docs/setup/rest). The [API reference](/docs/reference) shows each of their calls with your language's usual HTTP client. SDKs for Infrastructure (VMs, storage, databases) are not available yet either.

## 1 · Install {#install}

```bash tab=python
pip install nn-webhooks-sdk
```

```bash tab=typescript
npm install @nimbusnexus/webhooks-sdk
```

```bash tab=go
go get github.com/NimbusNexus/webhooks-go@v{{WEBHOOKS_SDK_VERSION}}
```

Python needs 3.11 or later, TypeScript needs Node.js 24 or later, and Go needs 1.25 or later. The Python package installs as `nn-webhooks-sdk` and imports as `nn_webhooks`.

## 2 · Authenticate {#auth}

Create a Webhooks key in your [account console]({{ACCOUNT_BASE_URL}}/api-keys) under **API keys**: [Get an API key](/docs/setup/rest#key) has the details. Then build a client from it. Read the key from the environment rather than writing it into your code.

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

## 3 · Make a first call {#first-call}

List your recent deliveries. It only reads, so any `admin` or `read` key can run it.

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

An empty list means the key works and nothing has been delivered yet. To publish your first event, follow the [Webhooks quickstart](/docs/product-webhooks/quickstart).

## What's next {#next-steps}

- [Webhooks SDKs](/docs/product-webhooks/sdks): verifying signatures, publishing, the durable outbox, managing endpoints.
- [Webhooks API reference](/docs/reference/webhooks): every operation, with the SDK call where the SDK has one.
- [CLI](/docs/setup/cli): the same operations from a shell.
