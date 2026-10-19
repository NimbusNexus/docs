---
title: Deliveries and retries
description: What happens to each event after it fans out — delivery states, the retry schedule, the dead-letter queue, and how to send things again.
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: concept
---

# Deliveries and retries

Publishing an event creates one **delivery** for each endpoint that subscribes to its type. A delivery is the unit we send, retry, and record: you can see every attempt it made and what came back, and send it again whenever you need to.

## Delivery states {#states}

| State | Meaning |
|---|---|
| `queued` | Waiting for its first attempt. |
| `sending` | An attempt is in flight. |
| `sent` | The endpoint answered 2xx. Done. |
| `failed` | The last attempt failed and another is scheduled (`next_attempt_at`). |
| `dead` | Out of attempts. Kept in the dead-letter queue until you send it again. |

Anything other than a 2xx counts as a failure: a 4xx or 5xx status, a timeout, a connection or TLS error. Each attempt waits up to 10 seconds for an answer, or the endpoint's own `delivery_timeout_ms` (100 ms to 60 s).

## The retry schedule {#retries}

A failed delivery is retried after 30 seconds, then 1, 2, 4 and 8 minutes, doubling each time up to an hour between attempts, until it reaches the endpoint's `max_attempts`. Your plan caps `max_attempts` (5 on Free, 8 on Starter, 10 on Pro).

When the default curve does not suit the receiver, give the endpoint a `retry_schedule` — the delay in seconds before each retry:

```bash
curl -sX PATCH {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a… \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"retry_schedule": [10, 60, 300, 1800]}'
```

Every attempt sends the same bytes, re-signed with a fresh timestamp, so a delivery that lands an hour late still verifies.

## When an endpoint keeps failing {#auto-disable}

After 20 failures in a row an endpoint is disabled automatically, with the reason recorded, and we send an `endpoint.disabled` [operational webhook](#operational) so you hear about it. New events no longer fan out to it. Fix the receiver, then enable the endpoint (`POST /v1/endpoints/{id}/enable`, or **Enable** in the console) and redeliver what it missed.

## Seeing what happened {#attempts}

In the console, **Deliveries** lists every delivery with its status, attempts and last error; open one to see each attempt — status code, error, duration — and the payload that was sent. Through the API:

```bash
curl -s "{{WEBHOOKS_BASE_URL}}/v1/deliveries?status=failed&endpoint_id=ep_3f9a…" \
  -H "Authorization: Bearer $READ_KEY"

curl -s {{WEBHOOKS_BASE_URL}}/v1/deliveries/dlv_…/attempts \
  -H "Authorization: Bearer $READ_KEY"
```

Where the deployment records them, an attempt also carries the first part of the endpoint's response body and the headers we sent (with credentials masked).

## Sending again {#replay}

| What | How |
|---|---|
| One delivery | `POST /v1/deliveries/{id}/redeliver` — from `dead`, `failed` or `sent`. |
| Every dead (or failed) delivery | `POST /v1/deliveries/redeliver` with `{"status": "dead"}`, optionally narrowed by `endpoint_id` or `project_id`. |
| Deliveries in a time window | `POST /v1/deliveries/replay` with `from`, `to` and `status` — for "the receiver was down from 02:00 to 04:00". Admin keys only; at most 10,000 per call. |
| An event, to an endpoint of your choice | `POST /v1/events/{id}/replay` with `{"endpoint_id": "ep_…"}` — even one that was not subscribed. Admin keys only. |

All four create new attempts of the stored event; they do not publish a new event, so the event id your endpoint deduplicates on stays the same.

## Operational webhooks {#operational}

To hear about delivery trouble without watching the console, subscribe an endpoint of your own to our operational events: `endpoint.disabled`, `endpoint.degraded`, `endpoint.recovered` and `message.attempt.exhausted` (a delivery went `dead`). Add one under **Operational webhooks** in the console, or with `POST /v1/operational-endpoints`. They are signed like any other delivery.

## How long deliveries are kept {#retention}

Events, their deliveries and their attempts are kept for 90 days.

## What's next {#next-steps}

- [Endpoint verification](/docs/product-webhooks/endpoint-verification) — why a matching endpoint can receive no delivery at all.
- [Signature verification](/docs/product-webhooks/signatures) — checking each delivery on your side.
- [Webhooks (product)](/docs/product-webhooks) — events, endpoints and subscriptions.
