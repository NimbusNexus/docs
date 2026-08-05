---
title: Signature verification
description: The signing contract for delivered webhooks — headers, the HMAC construction, and the three rules for checking it.
publishedAt: 2026-08-05
updatedAt: 2026-08-05
kind: concept
---

# Signature verification

Every delivery is signed with the receiving endpoint's signing secret. Verifying that signature is what separates "a POST arrived at my URL" from "NimbusNexus sent me this event" — a webhook URL is not a secret, and anything on the internet can find it.

This page is the contract. If you use one of the [SDKs](/docs/product-webhooks/sdks), its `verify` helper already implements all of it and you can skip to [what to do after verifying](#responding).

## The headers {#headers}

| Header | Contents |
|---|---|
| `X-Webhook-Signature` | `sha256=<hex>` — the HMAC you verify |
| `X-Webhook-Timestamp` | Unix seconds; part of the signature and the replay window |
| `X-Webhook-Event-Id` | The event id, matching `id` in the body — use it to deduplicate |
| `X-Webhook-Event-Type` | The event type |
| `X-Webhook-Delivery-Id` | This delivery's id; quote it in support requests |

> These are **not** the headers used by [platform webhooks](/docs/webhooks), which sign infrastructure notifications with an `NN-` prefix. The two products are separate systems. A handler written against the wrong header names will find nothing to verify and reject every delivery.

## The construction {#construction}

```text
signature = "sha256=" + hex( HMAC_SHA256( secret, "<timestamp>." + raw_body ) )
```

The timestamp, a literal `.`, then the raw request body — concatenated, HMAC'd under your endpoint's signing secret, hex-encoded, and prefixed with `sha256=`.

Binding the timestamp into the signed material is what makes the replay window enforceable. If the timestamp were merely a header alongside the signature, an attacker replaying a captured delivery could rewrite it freely; signing it means any edit invalidates the HMAC.

The body itself is compact, sorted-key JSON, serialized once at publish time and stored. Every retry of a delivery ships **identical bytes** — so a delivery that finally succeeds on attempt four verifies exactly as attempt one would have. Each attempt is re-signed with a fresh timestamp, which is why a long-delayed retry still falls inside a tight replay window.

## The three rules {#rules}

**1. Sign the raw bytes.** Read the body once, as bytes, and verify that. Parsing the JSON and re-serializing it changes key order and whitespace, and the signature is over what we sent, not over an equivalent object. This is the single most common cause of "the signature never matches" — the payload is fine and the comparison is against different bytes.

Frameworks that eagerly parse JSON usually expose the original separately: `request.body` in Flask, `req.rawBody` with an Express verify hook, `await request.body()` in FastAPI.

**2. Compare in constant time.** Use `hmac.compare_digest`, `crypto.timingSafeEqual`, `hmac.Equal` — not `==`. A byte-by-byte comparison that returns early leaks, through timing, how much of a guessed signature was correct, which turns forgery into a tractable search. The cost of doing it right is nothing; the cost of doing it wrong is not obvious from testing, because a wrong implementation passes every functional test.

**3. Reject stale timestamps.** If `X-Webhook-Timestamp` is more than **300 seconds** from your clock, reject the delivery regardless of whether the HMAC checks out. Without this, a captured delivery stays replayable forever. With it, the exposure is bounded to five minutes even if a payload is intercepted.

Rule 3 depends on your server's clock being roughly correct. If deliveries start failing verification in bulk after an infrastructure change, check NTP before checking your code.

## A complete handler {#example}

```python
import hashlib, hmac, time

WINDOW_SECONDS = 300

def verify(secret: str, raw_body: bytes, signature: str, timestamp: str) -> bool:
    # Rule 3 — replay window, checked first because it is the cheapest rejection.
    try:
        if abs(int(time.time()) - int(timestamp)) > WINDOW_SECONDS:
            return False
    except (TypeError, ValueError):
        return False  # absent or non-numeric header

    # Rule 1 — the raw bytes, exactly as received.
    expected = "sha256=" + hmac.new(
        secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()

    # Rule 2 — constant-time comparison.
    return hmac.compare_digest(expected, signature)
```

## Responding {#responding}

Return a `2xx` and we consider the delivery made. Anything else — or no response within the timeout — counts as a failure and enters the retry schedule.

Acknowledge fast and do the work afterwards. A handler that finishes a slow job before returning holds the delivery open, and if it exceeds the timeout the work happens *and* the delivery retries, giving you the duplicate you were trying to avoid. Queue it, return `200`, process out of band.

Be idempotent regardless. Delivery is at-least-once, so plan on seeing the same event twice: deduplicate on `X-Webhook-Event-Id`, which is stable across every retry of a delivery.

## Rotating a secret {#rotation}

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a/rotate-secret \
  -H "Authorization: Bearer $ADMIN_KEY"
```

The new secret is returned once. Deliveries in flight at the moment of rotation were signed with the old one, so a handler that switches instantly will reject them; accept both for a few minutes, then drop the old.

## What's next {#next-steps}

- [SDKs](/docs/product-webhooks/sdks) — `verify` helpers that implement this page.
- [Quickstart](/docs/product-webhooks/quickstart) — the end-to-end flow this fits into.
- [Webhooks (product)](/docs/product-webhooks) — delivery semantics and the dead-letter queue.
- [Platform webhooks](/docs/webhooks) — the separate, `NN-`-signed infrastructure notifications.
