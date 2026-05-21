---
title: Idempotency
description: Safe-to-retry mutating requests using the Idempotency-Key header.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: concept
---

# Idempotency

A request is **idempotent** when making it twice has the same effect as making it once. `GET /v1/vms` is naturally idempotent — it doesn't change anything. `POST /v1/vms` is naturally **not** idempotent — call it twice and you get two VMs.

The `Idempotency-Key` header lets you turn any mutating request into a safely retryable one. Pass any unique value (a UUID is conventional), and we cache the response for 24 hours, returning the same response on every repeat with the same key.

## The problem this solves {#problem}

You call `POST /v1/vms`. The network drops on the way back, you get a timeout instead of a 201. Did the VM get created? You don't know:

- If you retry: maybe you get two VMs (the original succeeded; your retry created a second).
- If you don't retry: maybe you get zero VMs (the original failed; you accepted the wrong state).

With an idempotency key, the retry is safe. If the original succeeded, the retry returns the same 201 with the same VM id — no duplicate. If the original failed, the retry actually does the work.

## Using the header {#usage}

Send any string up to 255 characters:

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web-01", "size": "gp-2-4", "region": "us-east-1", "image": "ubuntu-24.04" }'
```

Convention is a UUID v4 per logical operation. Generate it once on the client, save it before sending the request, and reuse it on every retry of that same logical operation. Generate a fresh one for the *next* logical operation.

## What "same key" matches {#same-key}

We cache the response keyed on:

1. The `Idempotency-Key` header value
2. The API key making the request
3. The endpoint (method + path)

So two requests share a cached response only if **all three match**. This prevents accidents — a key reused across two endpoints, or two API keys, or even two projects (different API keys) won't get crossed wires.

## What gets cached {#cached}

We cache the **full response** — status code, headers, body. A repeat with the same key returns byte-identical output. That matters for clients that fingerprint responses to detect "did this change?" — they get a consistent answer.

We also cache **errors**. If your first call returned `400 validation_failed`, the retry returns the same `400` — not a different error if you happened to fix something between attempts. This is correct: idempotency means "same effect," and the first call's effect was a failure. If you want a fresh attempt, generate a fresh key.

The cache TTL is **24 hours** from first use. After that, a request with the same key is treated as a new request.

## When to use it {#when}

| Endpoint kind | Use it? |
|---|---|
| `POST` creating a resource (`POST /v1/vms`) | Yes |
| `PUT` replacing a resource (`PUT /v1/vms/{id}`) | Yes |
| `PATCH` updating a resource | Yes |
| `DELETE` | Yes |
| `GET`, `HEAD`, `OPTIONS` | No — already naturally idempotent |
| `POST` triggering a one-shot operation (e.g. `POST /v1/vms/{id}/reboot`) | Yes — restart twice is different from restart once |

In practice: any mutating request that might fail mid-flight benefits from a key. The cost is a header on every request and a UUID generation step on your side.

## Conflict with previous use {#conflicts}

If you reuse a key with a **different request body** on the same endpoint, you get `409 Conflict` with `error.code: 'idempotency_key_reused'`. The cached response sticks; your different body is rejected. This is the safest behavior — silently returning the old response would mask a bug in your retry loop.

If you genuinely need to make a different request, generate a new key.

## When not to bother {#skip}

The keyless flow is `best-effort retry`. For reads, it's fine; for writes where you can tolerate "maybe nothing, maybe one" (idempotent operations at the application level), it's also fine. The header costs nothing — but if your application doesn't retry on failure, you won't notice the difference.

The cases where you really want a key:

- Anything tied to billing (you don't want to charge a card twice)
- Anything user-visible (you don't want to send a notification twice)
- Any provision-on-fail step in a workflow (you don't want orphaned resources)

## What's next {#next-steps}

- [Conventions](/docs/conventions) — pagination, status codes, error shapes, the rest.
- [Rate limiting](/docs/rate-limiting) — when retries hit a 429, the other half of the safe-retry story.
- [Errors](/docs/errors) — the error shape and what each `error.code` means.
