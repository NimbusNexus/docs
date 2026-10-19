---
title: Webhooks quickstart
description: Register an endpoint, publish an event, and verify the signed delivery — three requests and a handler.
publishedAt: 2026-08-05
updatedAt: 2026-10-19
kind: quickstart
---

# Webhooks quickstart

From nothing to a verified delivery. You will register a receiving endpoint, publish an event to it, and check the signature on the webhook that arrives.

## Before you start {#before}

You need two things:

- **An admin-scoped API key.** Mint one in your NimbusNexus account console, under **API keys**, choosing **Webhooks** as the product and `admin` as the scope. The [product overview](/docs/product-webhooks#access) covers the scopes. Put it in your shell:

  ```bash
  export ADMIN_KEY="eyJ…"
  ```

- **A public HTTPS URL that runs your handler.** We deliver over the internet, so `localhost` will not do. For a first test, a tunnel to your laptop works (`cloudflared tunnel --url http://localhost:3000`, or ngrok).

Every path below is relative to `{{WEBHOOKS_BASE_URL}}`.

## 1. Register an endpoint {#endpoint}

An endpoint is the HTTPS URL we deliver to, plus the subscriptions that decide which event types it receives. This one takes everything beginning with `order.`:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "url": "https://your-app.example/webhooks",
        "subscriptions": [{"match_kind": "prefix", "pattern": "order."}]
      }'
```

The response carries the endpoint and its **signing secret**:

```json
{
  "id": "ep_3f9a…",
  "url": "https://your-app.example/webhooks",
  "status": "enabled",
  "health": "healthy",
  "subscriptions": [{ "match_kind": "prefix", "pattern": "order." }],
  "secret": "whsec_…"
}
```

The secret is shown **once**. Store it in your secrets manager now — it is what you verify deliveries against, and it cannot be read back. If you lose it, rotate it and update your handler.

`match_kind` accepts `exact`, `prefix`, `suffix`, or `all`. Start narrow: an `all` subscription on a receiver that only understands two event types means writing a filter in your handler that the subscription could have done for you.

**If your workspace requires endpoint verification**, the endpoint receives nothing until it passes a one-time challenge: we POST a `webhook.verify` request carrying a token, and your handler answers 2xx with the token in the body. A plan can require it, and any workspace can switch it on; the console's **Settings** page shows whether yours does. Add the few lines from [Endpoint verification](/docs/product-webhooks/endpoint-verification#handler) to your handler, then:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a…/verify \
  -H "Authorization: Bearer $ADMIN_KEY"
```

`"verified": true` in the response means it passed.

## 2. Publish an event {#publish}

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123-created" \
  -d '{
        "event_type": "order.created",
        "payload": {"order_id": "ord_123", "total": 4200}
      }'
```

The field is `event_type`, not `type` — `type` is the field name inside the *delivered* envelope, which is a different object. Sending `type` here is a `422`.

The response tells you what the publish produced:

```json
{
  "id": "evt_0b6e2c8f4a1d4e7b9c3f5a8d2e6b1c4f",
  "event_uid": "8f1c2e4a9b7d4c3e8a6f5b2d1c0e9a7b",
  "event_type": "order.created",
  "source": null,
  "project_id": "prj_5d2a9c7e1b4f4a8d9e3c6b1a7f2e8d4c",
  "deliveries_created": 1,
  "skipped_unverified": 0
}
```

`id` is the event's API id (`GET /v1/events/{id}`). `event_uid` is the id your endpoint receives, as the envelope's `id` and in the `X-Webhook-Event-Id` header — deduplicate on it.

`deliveries_created: 0` is the most common first-run surprise, and it has two causes:

- **No endpoint subscribes to that type.** Check the endpoint's subscription pattern against the type you sent.
- **The matching endpoints are not verified**, and your workspace requires verification. `skipped_unverified` counts them; [verify the endpoint](/docs/product-webhooks/endpoint-verification) and publish again.

The `Idempotency-Key` header is what makes the publish safe to retry: replaying the same key returns the original event instead of fanning out again.

## 3. Verify the delivery {#verify}

The webhook arrives at your URL as a POST whose body is the event inside an envelope:

```json
{"created_at":"2026-10-19T15:04:12.483211+00:00","data":{"order_id":"ord_123","total":4200},"id":"8f1c2e4a9b7d4c3e8a6f5b2d1c0e9a7b","type":"order.created","version":"1"}
```

`data` is the payload you published, `id` the `event_uid`, `type` the event type. Check the signature before doing any work — a handler that skips it will process anything that finds your URL.

```python
import hashlib, hmac, time

def handle(request):
    secret = ENDPOINT_SIGNING_SECRET          # from step 1
    timestamp = request.headers["X-Webhook-Timestamp"]
    signature = request.headers["X-Webhook-Signature"]
    raw_body = request.body                   # RAW bytes — never re-serialize the JSON

    # 1. Reject anything outside the replay window.
    if abs(int(time.time()) - int(timestamp)) > 300:
        return Response(status_code=400)

    # 2. Recompute and compare in constant time. The header carries one token normally, but
    #    several comma-separated ones during a secret rotation — accept if ANY matches.
    expected = "sha256=" + hmac.new(
        secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()
    if not any(hmac.compare_digest(expected, t.strip()) for t in signature.split(",")):
        return Response(status_code=400)

    # 3. Only now is the payload trustworthy.
    process(request.json())
    return Response(status_code=200)          # 2xx = delivered; anything else retries
```

Signing the raw bytes rather than a re-encoded object is the detail that trips people up: parsing and re-serializing JSON reorders keys and changes whitespace, and the signature is over the bytes we sent. Read the body once, keep it, verify, then parse.

The full contract — every header, and why each rule exists — is in [Signature verification](/docs/product-webhooks/signatures). The [SDKs](/docs/product-webhooks/sdks) ship a `verify` helper that implements all of it, which is the recommended route.

## 4. Confirm it landed {#confirm}

```bash
curl -s "{{WEBHOOKS_BASE_URL}}/v1/deliveries?status=dead" \
  -H "Authorization: Bearer $ADMIN_KEY"
```

An empty `items` array means nothing has exhausted its retries. If your handler was down during step 2, the delivery will be here — fix the handler, then replay it:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/deliveries/dlv_456/redeliver \
  -H "Authorization: Bearer $ADMIN_KEY"
```

## What's next {#next-steps}

- [Signature verification](/docs/product-webhooks/signatures) — the complete signing contract.
- [Deliveries and retries](/docs/product-webhooks/deliveries) — what happens when your handler is down.
- [Sources](/docs/product-webhooks/sources) — receive webhooks from Stripe, GitHub and others the same way.
- [SDKs](/docs/product-webhooks/sdks) — skip the hand-rolled HMAC.
- [CLI](/docs/product-webhooks/cli) — the same operations without curl.
- [Webhooks (product)](/docs/product-webhooks) — objects, delivery semantics, and idempotency.
