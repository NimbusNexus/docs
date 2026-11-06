---
title: Rate limiting
description: What each API limits, the headers and errors a limit answers with, and how to back off.
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: concept
---

# Rate limiting

The infrastructure API limits how many requests it takes in a minute. The app APIs limit particular actions, such as publishing an event. Either way, a request over a limit answers `429`, usually with a `Retry-After` header that says how many seconds to wait.

## The infrastructure API {#defaults}

Every request to `{{API_HOST}}` counts toward a budget for the minute:

| Who's calling | Requests a minute | Counted per |
|---|---|---|
| A signed-in session (`Authorization: Bearer` or the session cookie) | 120 | User |
| An API key, or no credential | 60 | IP address |

An API key doesn't have a budget of its own. Keys used from one address share its 60 requests a minute, along with anything else calling from there. `GET /api/v1/notifications/list` has a lower limit of 30 a minute, measured against the same count.

The minute starts at your first request and doesn't slide: when it ends, the count starts again from zero.

## Response headers {#headers}

Responses from the infrastructure API carry the limit that applied and what's left of it:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
```

Past the limit, the answer is `429`, with `X-RateLimit-Remaining: 0` and a `Retry-After` header, in seconds, for what's left of the minute:

```json
{
  "success": false,
  "message": "Too many requests. Please try again later."
}
```

## The app APIs {#apps}

The app APIs don't send `X-RateLimit` headers, and they don't limit every request. What they limit, they refuse with `429` `rate_limited`, as [Errors](/docs/errors#codes-rate) describes:

- **Webhooks:** publishing (`POST /v1/events`) runs at your plan's publish rate, per workspace. Redelivering and replaying (`POST /v1/deliveries/{delivery_id}/redeliver`, `POST /v1/deliveries/redeliver`, `POST /v1/deliveries/replay` and `POST /v1/events/{event_id}/replay`) run at the same rate, on a count of their own. Inbound events to `POST /v1/ingest/{source_id}` are limited to 600 a minute per source, then your plan's publish rate ([What the provider sees](/docs/product-webhooks/sources#responses)). Saving and testing scripts is limited to 60 a minute per workspace ([Transformations](/docs/product-webhooks/transformations#errors)).
- **Inboxes:** each inbox accepts mail up to a per-minute limit set by your plan ([Limits by plan](/docs/product-inboxes#limits)).
- **Request Bins:** a bin can send 10 forward tests a minute ([Test a forward URL](/docs/product-bins/reference#forward-test)). A bin URL takes 120 requests a minute from one sender and 600 a minute in all ([What a bin URL answers](/docs/product-bins/reference#edge-answers)).
- **QR Codes:** a workspace can send 10 webhook tests a minute.

## Backoff strategy {#backoff}

The right pattern when you hit `429`:

```ts
async function callWithBackoff(fn: () => Promise<Response>) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fn()
    if (res.status !== 429) return res

    const retryAfter = Number(res.headers.get('Retry-After') ?? '1')
    // Jitter prevents the thundering-herd problem if many clients
    // hit the limit at the same moment and all retry exactly together
    const jitter = Math.random() * 0.5 * retryAfter
    await new Promise(r => setTimeout(r, (retryAfter + jitter) * 1000))
  }
  throw new Error('Rate limit exceeded after 5 retries')
}
```

Two notes:

- **Always honor `Retry-After`.** Don't retry sooner: you'll only get another `429`.
- **Add jitter** if you're calling from multiple workers. Without it, they all retry on the same tick and all hit the limit again together.

## What counts as a request {#counted}

On the infrastructure API, every HTTP call counts, including:

- `GET`s, such as `GET /api/v1/instance/`
- Each page of a [paged list](/docs/pagination), and each poll while you wait for a VM to reach `ACTIVE`
- Calls that fail, such as a `401`, and the `429`s themselves

To stay under the limit from one address, spread the work out: poll less often, and don't list what you could read once and keep.

## Raising your limits {#raising}

No API call or plan setting raises these limits. If yours gets in the way of a real workload, [contact support]({{BASE_URL}}/contact/support).

## What's next {#next-steps}

- [Conventions](/docs/conventions) — request shape, status codes, the broader API patterns.
- [Idempotency](/docs/idempotency) — how to retry a write safely.
- [Quotas](/docs/api/quotas) — the *resource* limits (VMs, vCPU, storage), as distinct from request-rate limits.
