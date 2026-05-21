---
title: Rate limiting
description: Per-key request budgets, the headers we return, and the right backoff strategy.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: concept
---

# Rate limiting

Every API key gets a per-second and per-hour request budget. The limits protect both you and us — they prevent a runaway loop from burning your credit card and prevent any one tenant from saturating a region.

## The defaults {#defaults}

| Tier | Per second | Per hour |
|---|---|---|
| Free | 5 | 1,000 |
| Starter | 25 | 10,000 |
| Production | 100 | 100,000 |
| Enterprise | Custom | Custom |

These apply per **API key**, not per project — if you have three keys in one project, each gets its own budget. Most teams never come close to the production-tier limit; if you do, the dashboard's "rate limit usage" panel surfaces the call sites burning quota fastest.

## How limiting works {#mechanics}

A token-bucket on every key. The bucket refills at the per-second rate; the bucket size is set so a brief burst that drains the budget recovers in ~10 seconds. The hourly limit is a hard ceiling — once you hit it, no requests succeed until the rolling hour rolls forward.

Limits are evaluated at the gateway, before the request reaches the resource handler. A rate-limited request never touches your project's resources, so it never costs you anything beyond the failed-request log entry.

## Response headers {#headers}

Every API response carries four headers documenting your current budget:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1763410812
X-RateLimit-Window: 1
```

- `X-RateLimit-Limit` — total budget for the current window
- `X-RateLimit-Remaining` — requests left
- `X-RateLimit-Reset` — Unix epoch when the budget refills (or the hourly window rolls)
- `X-RateLimit-Window` — `1` for per-second, `3600` for per-hour. We surface whichever budget you're closer to consuming

When `Remaining` hits zero, the next request returns `429 Too Many Requests` with a `Retry-After` header (in seconds) telling you when to retry.

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

- **Always honor `Retry-After`.** Don't retry sooner — you'll just hit the limit again and burn your budget faster.
- **Add jitter** if you're calling from multiple workers. Without jitter, all your workers retry on the same tick and all hit the limit again together.

## What counts as a request {#counted}

Every HTTP call to the API counts as one request, including:

- `GET`s (yes, even `GET /v1/regions`)
- Pagination calls (each page is a request)
- Idempotent retries (the cache hit still counts as one request — but it's cheap, and the dedupe means you don't pay for the underlying operation twice)

What **doesn't** count:

- Static assets served from the marketing site (CDN, not the API)
- Webhook deliveries to your side (we send them, not you)
- Failed connection attempts (no gateway log entry)

## Raising your limits {#raising}

The starter and production tiers are usually generous enough; less than 5 % of accounts ever hit the per-hour cap. If you do, the path is the support contact form, not the API — same as [quota raises](/docs/api/quotas). Production migrations get same-day turnaround.

If you're hitting per-second limits but not per-hour, you usually don't need a raise — you need to spread load (batch requests, use `Idempotency-Key` to dedupe retries, paginate with reasonable page sizes). The "rate limit usage" panel in the dashboard breaks down which endpoints are spiking.

## What's next {#next-steps}

- [Conventions](/docs/conventions) — request shape, status codes, the broader API patterns.
- [Idempotency](/docs/idempotency) — safe retry pattern when network failures look like rate limits.
- [Quotas](/docs/api/quotas) — the *resource* limits (VMs, vCPU, storage), as distinct from request-rate limits.
