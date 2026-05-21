---
title: Errors
description: The error shape, the error codes that matter, and how to handle each.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: concept
---

# Errors

Every error response uses the same JSON shape. You can switch on `error.code` to handle each case without parsing prose messages or guessing from status codes.

## The shape {#shape}

```json
{
  "error": {
    "code": "validation_failed",
    "message": "size must be one of the published VM sizes",
    "fields": {
      "size": "unknown size 'gp-7-7'"
    },
    "request_id": "req_01HG7Y3..."
  }
}
```

Four fields, two always present:

| Field | Always present | What |
|---|---|---|
| `code` | Yes | Stable machine-readable string. Branch on this. |
| `message` | Yes | Human-readable; safe for logs, not safe for end-user UI (not localized). |
| `fields` | No | Present on `validation_failed`. Keyed by the request field that failed. |
| `request_id` | Yes | Include this when contacting support. |

The status code groups errors into families; `error.code` is what you actually want to branch on.

## Status code families {#families}

| Status family | Family meaning |
|---|---|
| `200`/`201`/`202`/`204` | Success |
| `400` | Client error in the request (validation, malformed JSON, etc.) |
| `401` | Authentication failed |
| `403` | Authenticated but not authorized |
| `404` | Resource doesn't exist *or* caller can't see it (intentionally indistinguishable) |
| `409` | State conflict (mid-operation, name taken, can't-delete-non-empty, etc.) |
| `422` | JSON-valid but semantically wrong in a way that isn't single-field validation |
| `429` | Rate limited |
| `5xx` | Server-side problem |

`5xx` is the only family where a retry might help without you changing anything. For `4xx`, the response body tells you what to fix.

## Error codes that matter {#codes}

The full list is long; these are the ones you'll handle most often.

### Authentication / authorization

| `code` | Status | What |
|---|---|---|
| `no_credentials` | 401 | No `Authorization` header. |
| `invalid_credentials` | 401 | Key is unrecognized, revoked, or wrong format. |
| `expired_credentials` | 401 | Key was rotated, 24-hour grace window elapsed. |
| `scope_required` | 403 | Key valid but missing the scope this endpoint needs. `error.fields.scope` names it. |
| `wrong_project` | 403 | Key valid; resource exists; resource belongs to a different project. |

See [Authentication](/docs/authentication) for the request shape and rotation flow.

### Request validation

| `code` | Status | What |
|---|---|---|
| `validation_failed` | 400 | One or more request fields failed validation. `error.fields` lists which ones. |
| `malformed_json` | 400 | Body wasn't valid JSON. |
| `unsupported_content_type` | 415 | `Content-Type` wasn't `application/json`. |
| `request_too_large` | 413 | Body exceeded the per-endpoint size limit. |

### State

| `code` | Status | What |
|---|---|---|
| `already_exists` | 409 | A resource with the same unique field already exists (name, etc.). |
| `state_conflict` | 409 | Resource is mid-operation (e.g. trying to delete a VM mid-snapshot). |
| `not_empty` | 409 | Trying to delete a container that still holds children (e.g. bucket with objects). |
| `idempotency_key_reused` | 409 | Same `Idempotency-Key` with a different request body. |

### Rate / quota

| `code` | Status | What |
|---|---|---|
| `rate_limit_exceeded` | 429 | Per-second or per-hour request budget burned. `Retry-After` tells you when. |
| `quota_exceeded` | 429 | A resource quota would be crossed (VM count, vCPU, storage). Raise via support. |

`rate_limit_exceeded` is time-bounded — wait and retry works. `quota_exceeded` is not — you need to delete a resource or raise the quota.

### Server

| `code` | Status | What |
|---|---|---|
| `internal_error` | 500 | Something broke server-side. Safe to retry idempotent requests. |
| `service_unavailable` | 503 | Region temporarily can't accept requests. `Retry-After` set. |
| `gateway_timeout` | 504 | Backend took too long. Safe to retry idempotent requests. |

## Handling pattern {#pattern}

```ts
async function call(): Promise<VM> {
  const res = await fetch(url, opts)
  if (res.ok) return await res.json()

  const { error } = await res.json()

  // Switch on code, not status — codes are stable, statuses can be ambiguous
  switch (error.code) {
    case 'rate_limit_exceeded': {
      const wait = Number(res.headers.get('Retry-After') ?? '1')
      await sleep(wait * 1000)
      return call() // retry
    }
    case 'invalid_credentials':
    case 'expired_credentials':
      await rotateKey()
      return call()
    case 'state_conflict':
      // Wait for the resource to settle and retry
      await sleep(2000)
      return call()
    case 'validation_failed':
      // Fields are in error.fields — surface them in your UI
      throw new ValidationError(error.fields)
    default:
      // Unknown code, but the family tells us the rough shape
      if (res.status >= 500) {
        // Server-side; safe to retry idempotent ops
        throw new RetryableError(error)
      }
      throw new TerminalError(error)
  }
}
```

The general rule: **switch on `error.code`, default to handling by status family**. New codes added on existing families won't break you — your default case handles them.

## Reporting bugs {#bugs}

Every error carries a `request_id`. When something's wrong on our side (5xx, unexpected behavior), the request_id is what lets us find the call in our logs. Include it in support tickets.

Don't share `request_id`s publicly (they're not secret, but they let anyone who has them ask us about your account's traffic). Use them in private channels (support, dashboard tickets).

## What's next {#next-steps}

- [Conventions](/docs/conventions) — the rest of the request/response shape.
- [Authentication](/docs/authentication) — the auth-error codes in context.
- [Rate limiting](/docs/rate-limiting) — the `Retry-After` mechanics in detail.
- [Idempotency](/docs/idempotency) — safe-retry pattern for 5xx + 429 cases.
