---
title: Idempotency
description: Which routes take the Idempotency-Key header, and how to retry safely on the others.
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: concept
---

# Idempotency

A request is **idempotent** when making it twice has the same effect as making it once. `GET /api/v1/instance/` is naturally idempotent — it doesn't change anything. `POST /api/v1/instance/` is naturally **not** idempotent — call it twice and you get two VMs.

The `Idempotency-Key` header makes a request safely retryable, but only on the few routes that take it. Every other route ignores the header.

## The problem this solves {#problem}

You publish an event with `POST /v1/events`. The network drops on the way back, you get a timeout instead of a 201. Did the event go out? You don't know:

- If you retry: maybe your customers get it twice (the original succeeded; your retry published a second).
- If you don't retry: maybe they never get it (the original failed; you accepted the wrong state).

With an idempotency key, the retry is safe. If the original succeeded, the retry returns the original event and fans nothing out again. If the original failed, the retry actually does the work.

## Routes that take the header {#usage}

| Route | API | The key is |
|---|---|---|
| `POST /v1/events` | Webhooks | Optional |
| `POST /v1/qr-tracked/imports` | QR Codes | Required |
| `POST /api/v1/payment/payment_methods/{payment_method_id}/add_funds` | Infrastructure | Required |

Send any unique string:

```bash
curl -X POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "event_type": "order.created", "payload": { "order_id": "1234" } }'
```

Convention is a UUID v4 per logical operation. Generate it once on the client, save it before sending the request, and reuse it on every retry of that same logical operation. Generate a fresh one for the *next* logical operation.

## On the Webhooks API {#webhooks}

On the Webhooks API, `Idempotency-Key` applies to publishing an event (`POST /v1/events`), and it behaves like this:

| You send | You get |
|---|---|
| A new key | `201` and the new event, fanned out to matching endpoints. |
| The same key and the same body | `200`, the **original** event, and the header `Idempotency-Replayed: true`. Nothing is fanned out again. |
| The same key and a different body | `409` with `error.code: 'conflict'`, `details.reason: 'idempotency_key_reuse'` and the key in `details.idempotency_key`. The original event stands. |
| The same key after a request that failed | The request runs again. A failed publish (a validation error, a quota error, a rate limit) doesn't record the key. |

"Same body" means the same event type and payload for the same project. A key belongs to your workspace and project, not to the API key that sent it, so two API keys publishing into the same project share keys. A key is kept for at least 24 hours.

## On QR Codes and when adding funds {#other-routes}

On QR Codes, a bulk import (`POST /v1/qr-tracked/imports`) needs a key. A key belongs to your workspace. The same key and the same body return the original import without making its codes again; the same key and a different body answer `409`.

Adding funds to your balance (`POST /api/v1/payment/payment_methods/{payment_method_id}/add_funds`) needs a key too, so that a retried top-up doesn't charge the card twice. This call takes a signed-in session, not an API key ([Payment methods](/docs/api/payment-methods)).

## Conflict with previous use {#conflicts}

On Webhooks and QR Codes, if you reuse a key with a **different request body** on the same endpoint, you get `409 Conflict` with `error.code: 'conflict'`, and `error.message` says the key was already used with a different request body. The original request stands; your different body is rejected. This is the safest behavior — silently returning the old response would mask a bug in your retry loop.

If you genuinely need to make a different request, generate a new key.

Earlier versions of this page said this answer carried `error.code: 'idempotency_key_reused'`. The API has never sent that code; it sends `conflict`. `conflict` also covers other clashes with existing state, such as a name already taken; on the Webhooks API, `details.reason` is `idempotency_key_reuse` for this one. See [Errors](/docs/errors#codes-state).

## On every other route {#skip}

Without a key, check before you retry a write:

- **Creating a VM or a volume.** The call queues the work and answers with no id, so look for the new resource in the list (`GET /api/v1/instance/`, `GET /api/v1/storage/`) before you send it again. A unique `name` makes it easy to find.
- **Creating something with a unique name.** A DNS zone or an object-storage container whose name is taken answers `409`, so a retry after a timeout can't make a second one. Read the `409` as a sign that the original may have worked.
- **Deleting.** Repeating a delete doesn't delete anything else, though the second call may answer with an error because the resource is already gone. Read the resource to be sure.

For reads, retrying is always fine.

## What's next {#next-steps}

- [Conventions](/docs/conventions) — pagination, status codes, error shapes, the rest.
- [Rate limiting](/docs/rate-limiting) — when retries hit a 429, the other half of the safe-retry story.
- [Errors](/docs/errors) — the error shape and what each `error.code` means.
