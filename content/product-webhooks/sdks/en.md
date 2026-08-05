---
title: Webhooks SDKs
description: Typed clients for Python, TypeScript, and Go — verify incoming webhooks, publish events, and manage endpoints from code.
publishedAt: 2026-08-05
updatedAt: 2026-08-05
kind: sdk
---

# Webhooks SDKs

> **Status: published.** Python, TypeScript, and Go are on their public registries at 0.5.1. Java and PHP are written and tested but not yet published — see [where it stands](#status).

Official clients for [NimbusNexus Webhooks](/docs/product-webhooks). Each one covers the same four jobs, so a team using two languages gets the same behaviour in both.

The highest-value piece is `verify`. Signature checking is security-critical, easy to get subtly wrong, and wrong in a way that passes every functional test — the SDKs implement [the full contract](/docs/product-webhooks/signatures) including the constant-time comparison and the replay window.

## Install {#install}

```bash
pip install nn-webhooks-sdk                        # Python
npm install @nimbusnexus/webhooks-sdk              # TypeScript
go get github.com/NimbusNexus/webhooks-go          # Go
```

## Verify an incoming webhook {#verify}

For anyone *receiving* webhooks. Pass the raw body bytes — never a re-serialized object.

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
import webhooks "github.com/NimbusNexus/webhooks-go"

ts, _ := strconv.ParseInt(r.Header.Get("X-Webhook-Timestamp"), 10, 64)
ok := webhooks.Verify(secret, body, r.Header.Get("X-Webhook-Signature"),
    &webhooks.VerifyOptions{Timestamp: &ts})
```

Always pass the timestamp. Omitting it computes the signature over the body alone and silently drops replay protection — the call still returns `true` for a captured delivery replayed a week later.

## Publish an event {#publish}

For *producers*. Transient failures — connection errors, `429`, `5xx` — are retried with backoff, and a `429` honours `Retry-After`. Other `4xx` raise.

```python
from nn_webhooks import Client, WebhookdAPIError

with Client("{{WEBHOOKS_BASE_URL}}", api_key="whsk_…") as wh:
    try:
        event = wh.publish(
            "order.created",
            {"order_id": "ord_123", "total": 4200},
            idempotency_key="order-123",     # makes the publish safe to retry
        )
        print(event.event_uid, event.deliveries_created)
    except WebhookdAPIError as e:
        print(e.status_code, e.code, e.message)
```

```go
client := webhooks.New("{{WEBHOOKS_BASE_URL}}", "whsk_…")
event, err := client.Publish(ctx, "order.created",
    map[string]any{"order_id": "ord_123", "total": 4200},
    &webhooks.PublishOptions{IdempotencyKey: "order-123"})
```

## Durable buffering {#outbox}

`publish()` is synchronous — if the API is unreachable it raises, and the event is gone. The write-first outbox decouples the two: `enqueue()` persists to a store and returns immediately with no network call, and `drain()` ships the backlog later.

```python
from nn_webhooks import Client, SQLiteStore

store = SQLiteStore("outbox.db")
with Client("{{WEBHOOKS_BASE_URL}}", api_key="whsk_…", store=store) as wh:
    record_id = wh.enqueue("order.created", {"order_id": "ord_123"})   # no network
    wh.start_drainer(interval_seconds=5)                               # ships in background
```

Every send carries `Idempotency-Key = record.id`, so re-draining after a crash never double-publishes. A record that keeps failing is retried with capped exponential backoff up to `max_attempts` (default 10), then flagged dead and handed to an optional `on_dead` callback.

| Store | Durable | Extra dependency |
|---|---|---|
| `MemoryStore` | No — in-process | none |
| `FileStore(dir)` | Yes | none |
| `SQLiteStore(path)` | Yes, transactional | none |
| `RedisStore(url)` | Yes | `pip install 'nn-webhooks-sdk[redis]'` |
| `PostgresStore(dsn)` | Yes | `pip install 'nn-webhooks-sdk[postgres]'` |

The core package stays dependency-free; the Redis and Postgres stores import their driver lazily, only when constructed.

## Manage endpoints and keys {#manage}

The same client wraps the control plane, with an admin-scoped key:

```python
ep = wh.create_endpoint(
    "https://your-app.example/webhooks",
    subscriptions=[{"match_kind": "prefix", "pattern": "order."}],
)
endpoint_id, signing_secret = ep["id"], ep["secret"]   # secret returned once

wh.rotate_endpoint_secret(endpoint_id)
wh.enable_endpoint(endpoint_id)                        # recover an auto-disabled endpoint

for d in wh.list_deliveries(status="dead")["items"]:   # drain the dead-letter queue
    wh.redeliver(d["id"])
```

List methods return `{"items": [...], "next_offset": int | None}`; deletes and revokes return nothing on a `204`.

## Targeting a project {#projects}

A project is addressed by id (`prj_3f9a…`) — there is no slug or short name. Leave `project_id` unset to target the workspace's default project, which is what a single-project workspace always wants:

```python
wh.publish("order.created", {...})                          # default project
wh.publish("order.created", {...}, project_id="prj_3f9a…")  # a specific one
```

Only the server can resolve "the default project", so omitting the field is the way to ask for it. Passing an invented string — `"default"`, or a project's display name — is a `404`. The real id is on any response, or from `GET /v1/projects`.

## Keeping the SDKs honest {#contract}

All clients implement one signing contract: `HMAC-SHA256(secret, "<timestamp>." + raw_body)`, sent as `X-Webhook-Signature: sha256=<hex>` with a 300-second window. They are pinned to it by a shared vector fixture generated by the server's own signer, so no client can drift from the server or from each other — including in CI, where the server package isn't installed.

## Where it stands today {#status}

| Language | Package | Status |
|---|---|---|
| Python | `nn-webhooks-sdk` | Published — [PyPI](https://pypi.org/project/nn-webhooks-sdk/), 0.5.1 |
| TypeScript | `@nimbusnexus/webhooks-sdk` | Published — [npm](https://www.npmjs.com/package/@nimbusnexus/webhooks-sdk), 0.5.1 |
| Go | `github.com/NimbusNexus/webhooks-go` | Published — [GitHub](https://github.com/NimbusNexus/webhooks-go), v0.5.1 |
| Java | `net.nimbusnexus:nn-webhooks-sdk` | Written and tested; not yet on Maven Central |
| PHP | `nimbusnexus/nn-webhooks-sdk` | Written and tested; not yet on Packagist |

Until Java and PHP publish, call the REST API directly — the [signature page](/docs/product-webhooks/signatures) has everything needed to verify deliveries in any language, and it is about twenty lines.

## What's next {#next-steps}

- [CLI](/docs/product-webhooks/cli) — the same operations from a shell.
- [Signature verification](/docs/product-webhooks/signatures) — what `verify` implements.
- [Quickstart](/docs/product-webhooks/quickstart) — the flow these clients wrap.
- [Idempotency](/docs/idempotency) — the platform-wide pattern behind `idempotency_key`.
