---
title: Endpoint verification
description: Prove an endpoint wants your events before it receives any — a one-time signed challenge it must echo back.
publishedAt: 2026-10-19
updatedAt: 2026-10-30
kind: concept
---

# Endpoint verification

Verification proves that the URL behind an endpoint is yours and is ready for webhooks. We send it one signed challenge; it passes by echoing the challenge back. Until it passes, a workspace that requires verification delivers nothing to it — which catches a mistyped URL or a half-built receiver before real events pile up in the dead-letter queue, and keeps anyone from pointing our deliveries at a server that never asked for them.

## The challenge {#challenge}

Starting a verification sends one POST to the endpoint's URL, signed with the endpoint's secret exactly like a delivery (the same `X-Webhook-Signature` and `X-Webhook-Timestamp`, your endpoint's custom headers, and `X-Webhook-Event-Type: webhook.verify`):

```json
{"type": "webhook.verify", "data": {"endpoint_id": "ep_3f9a…", "challenge": "Xb9kQ2…"}}
```

The endpoint passes when it answers **2xx with the `challenge` value anywhere in the response body**. A 2xx without the token fails with `challenge_not_echoed`; anything else fails like a delivery would.

## Answering it {#handler}

Check the signature as you do for every delivery, then return the challenge:

```python
from nn_webhooks import challenge_response

if (challenge := challenge_response(raw_body)) is not None:  # after the signature check
    return Response(challenge, status=200)
```

```ts
import { challengeResponse } from "@nimbusnexus/webhooks-sdk";

const challenge = challengeResponse(rawBody); // after the signature check
if (challenge !== null) return res.status(200).send(challenge);
```

```go
if challenge, ok := webhooks.ChallengeResponse(rawBody); ok { // after the signature check
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(challenge))
    return
}
```

These are the SDKs' one-call helpers (0.8.0 and later). They return nothing for any other event, so the rest of your handler runs as before. Without an SDK, parse the body and answer with `data.challenge` when `type` is `webhook.verify`.

## Running it {#run}

In the console, open the endpoint's menu on the **Endpoints** page and choose **Verify**. Through the API:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a…/verify \
  -H "Authorization: Bearer $ADMIN_KEY"
```

```json
{ "verified": true, "challenge_echoed": true, "status_code": 200, "error": null, "duration_ms": 142, "failure_reason": null }
```

An endpoint stays verified until its URL changes; a new URL has to verify again.

## When it is required {#required}

Verification is required for an endpoint when any of these is on:

- the **workspace** switch — **Settings → Endpoint verification** in the console, or `PATCH /v1/workspace` with `{"require_endpoint_verification": true}`;
- the **project** switch — `PUT /v1/verification-policy?project_id=…` with `{"required": true}`, for a project that needs it when others do not;
- your **plan**, where the plan requires it. The console then shows the switch locked on.

`GET /v1/verification-policy` returns the rule as delivery applies it (`required`), alongside the two switches.

## What an unverified endpoint misses {#gated}

When verification is required, an unverified endpoint is left out when an event fans out: the publish response counts it in `skipped_unverified`, the console marks the endpoint *gated*, and no delivery is created for it — so nothing waits to be sent once it verifies. Publish or [replay](/docs/product-webhooks/deliveries#replay) again after it passes.

Sending again is held back the same way. Redelivering one delivery to that endpoint, or replaying an event to it, is refused with `409 endpoint_not_verified`; a bulk redeliver or a redeliver by time range leaves it out and counts it in `skipped_unverified`. A delivery already queued or retrying when the endpoint comes to need verification — the requirement was switched on, or the endpoint's URL changed — goes to the dead-letter queue unsent, with `last_error` starting "not verified:". Verify the endpoint, then redeliver it.

## Receivers that cannot answer {#cannot-echo}

Some receivers accept any POST but never echo a body you choose — Zapier's catch hooks among them. They cannot pass verification. Where your plan lets you, leave verification off for the project that delivers to them; otherwise put a small relay of your own in front that answers the challenge.

Slack's incoming webhooks are a different case, and so are Microsoft Teams' and Discord's. They accept only their own message format, such as a Slack message with a `text` or `blocks` field, so they reject the event envelope we deliver, even with verification off. Give the endpoint a [transformation](/docs/product-webhooks/transformations) and they take it: the **Slack message**, **Microsoft Teams card** and **Discord message** presets turn each event into a message, on every paid plan. They still cannot answer the challenge, so keep verification off for their project. [Slack, Teams and Discord](/docs/product-webhooks/chat-apps) walks through it.

## What's next {#next-steps}

- [Signature verification](/docs/product-webhooks/signatures) — the check to run before answering the challenge.
- [Deliveries and retries](/docs/product-webhooks/deliveries) — what happens once the endpoint receives events.
- [Transformations](/docs/product-webhooks/transformations) — send a receiver the shape it needs.
- [Quickstart](/docs/product-webhooks/quickstart) — from nothing to a verified delivery.
