---
title: Webhooks
description: Subscribe to resource lifecycle events. HMAC-signed POSTs to a URL you control.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: concept
---

# Webhooks

Webhooks are how NimbusNexus notifies your systems when something changes — a VM finishes provisioning, a snapshot completes, an invoice is generated. You register a URL; we POST a JSON payload to it every time the matching event fires.

Webhooks let you react to state changes without polling. Polling works, but it's wasteful at scale (most requests return "nothing changed") and slow at low scale (you only learn about a change on the next poll tick). Webhooks invert the model — we tell you the moment something happens.

## How a delivery looks {#delivery}

```http
POST /webhooks/nimbusnexus HTTP/1.1
Host: your-app.example.com
Content-Type: application/json
NN-Event: vm.created
NN-Delivery-Id: del_01HG7Y3...
NN-Timestamp: 1763410800
NN-Signature: sha256=4d2c8f19e6b07d3f...

{
  "event": "vm.created",
  "occurred_at": "2026-05-20T18:30:00Z",
  "data": {
    "id": "vm_01HG7Y3...",
    "name": "web-01",
    "state": "running",
    "ipv4": "203.0.113.5"
  }
}
```

Every delivery carries four headers:

- `NN-Event` — the event type (`vm.created`, `snapshot.completed`, etc.)
- `NN-Delivery-Id` — unique per delivery; safe to use as an idempotency key on your side
- `NN-Timestamp` — Unix epoch seconds at delivery time; used in the signature
- `NN-Signature` — HMAC-SHA256 over `{timestamp}.{body}`, hex-encoded

## Verifying the signature {#signature}

The signature proves the delivery came from NimbusNexus, not from someone who guessed your webhook URL. Verify it in your handler before doing any work:

```ts
import crypto from 'node:crypto'

function verifyWebhook(req: Request, secret: string): boolean {
  const timestamp = req.headers.get('NN-Timestamp')!
  const signature = req.headers.get('NN-Signature')!.replace(/^sha256=/, '')
  const body = req.bodyText // raw body, not parsed JSON

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex')

  // Constant-time compare avoids timing oracles
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  )
}
```

The secret comes from the dashboard at webhook-endpoint creation time. Store it in your secrets manager, not in source code — it lets anyone forge deliveries.

Also reject deliveries with a timestamp more than 5 minutes off from your server clock. That bounds the replay window if the secret ever leaks.

## Event types {#events}

Every resource that has a lifecycle emits events. Common ones:

| Event | When |
|---|---|
| `vm.created` | A VM finished provisioning and is `running` |
| `vm.state_changed` | A VM transitioned between any two states |
| `vm.deleted` | A VM was terminated |
| `snapshot.completed` | A snapshot finished copying |
| `backup.completed` | A scheduled backup finished |
| `database.upgrade_completed` | A managed-DB engine upgrade finished |
| `floating_ip.attached` / `floating_ip.detached` | Attachment changes |
| `invoice.generated` | A monthly invoice was finalized |
| `payment.succeeded` / `payment.failed` | Payment outcomes |
| `quota.warning` | Project crossed 90 % of any quota |

The full list of event types is in the API reference for each resource (the `events` field on the resource shows what's emitted).

## Delivery semantics {#delivery-semantics}

- **At-least-once.** A flaky network or a slow handler can cause us to retry. Use `NN-Delivery-Id` to dedupe on your side.
- **Order is not guaranteed.** Two events fired ~1 second apart may arrive out of order. The `occurred_at` field in the payload tells you the true order; sort by it if it matters.
- **Retries:** failed deliveries (non-2xx response, or timeout > 10 s) retry with exponential backoff at 1, 5, 25, 125, and 625 seconds. Five total attempts. After that the delivery is dropped; we surface it in the dashboard's "failed deliveries" panel for 14 days.
- **Timeout:** your handler has 10 seconds to return a 2xx. If you need to do more work, queue it and ack the webhook immediately.

## What's next {#next-steps}

- [Authentication](/docs/authentication) — how API keys (not webhook secrets) work.
- [Idempotency](/docs/idempotency) — the pattern this page recommends for handling retries.
- [Conventions](/docs/conventions) — error shapes, status codes, the rest of the request shape.
