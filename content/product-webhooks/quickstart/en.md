---
title: Webhooks quickstart
description: Register an endpoint, publish an event, and verify the signed delivery — three requests and a handler.
publishedAt: 2026-08-05
updatedAt: 2026-08-05
kind: quickstart
---

# Webhooks quickstart

From nothing to a verified delivery. You will register a receiving endpoint, publish an event to it, and check the signature on the webhook that arrives.

You need an admin-scoped API key. Keys look like `whsk_…` and are issued when your workspace is provisioned; the [product overview](/docs/product-webhooks) covers how to get one.

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

## 2. Publish an event {#publish}

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123-created" \
  -d '{
        "type": "order.created",
        "payload": {"order_id": "ord_123", "total": 4200}
      }'
```

The response tells you what the publish produced:

```json
{
  "event_uid": "evt_7c21…",
  "type": "order.created",
  "deliveries_created": 1
}
```

`deliveries_created: 0` is the answer to the most common first-run surprise — it means nothing was subscribed to that type, not that the publish failed. Check the endpoint's subscription pattern against the type you sent.

The `Idempotency-Key` header is what makes the publish safe to retry: replaying the same key returns the original event instead of fanning out again.

## 3. Verify the delivery {#verify}

The webhook arrives at your URL as a POST. Verify it before doing any work — an unverified handler will process anything that finds your URL.

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

    # 2. Recompute and compare in constant time.
    expected = "sha256=" + hmac.new(
        secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
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
- [SDKs](/docs/product-webhooks/sdks) — skip the hand-rolled HMAC.
- [CLI](/docs/product-webhooks/cli) — the same operations without curl.
- [Webhooks (product)](/docs/product-webhooks) — objects, delivery semantics, and idempotency.
