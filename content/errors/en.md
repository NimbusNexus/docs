---
title: Errors
description: The error shape, the error codes the Webhooks and Inboxes APIs send, and how to handle each.
publishedAt: 2026-05-20
updatedAt: 2026-10-05
kind: concept
---

# Errors

Every error response from the Webhooks and Inboxes APIs uses the same JSON shape. Switch on `error.code` to handle each case. Don't parse `message`, and don't decide from the status alone: one status can carry several codes, and across the two APIs `402` carries five.

> **Corrected on 2026-10-05.** Earlier versions of this page listed codes, statuses and fields the APIs have never sent, among them `validation_failed` (400), `rate_limit_exceeded`, `quota_exceeded` as a 429, `fields`, and a `request_id` in every body. Code that matches on those has never matched anything. [Codes this page used to list](#earlier-versions) maps each one to what the API actually sends.

## The shape {#shape}

```json
{
  "error": {
    "code": "validation_error",
    "message": "request validation failed",
    "details": [
      {
        "loc": ["body", "event_type"],
        "msg": "Field required",
        "type": "missing"
      }
    ]
  }
}
```

Three fields, two always present:

| Field | Always present | What |
|---|---|---|
| `code` | Yes | Stable machine-readable string. Branch on this. |
| `message` | Yes | English text for logs and support tickets. Not localized, and not meant for an end-user UI. |
| `details` | No | Structured context for some codes: the failing inputs of a validation error, the limit behind a quota error. Its shape depends on the code; each table below says what it holds. |

The body carries no request id. Every response, success or error, carries an `X-Request-ID` header instead; see [Reporting bugs](#bugs).

## Status code families {#families}

| Status family | Family meaning |
|---|---|
| `200`/`201`/`202`/`204` | Success |
| `400` | The request couldn't be read as sent |
| `401` | No usable credential: none was sent, or it was revoked. Inboxes also answers `401` for a key it doesn't recognise |
| `402` | Your plan or billing state stops the request: a quota, a feature your plan doesn't include, or a workspace that is frozen or suspended |
| `403` | Not allowed. Webhooks also answers `403` for a credential it doesn't recognise |
| `404` | Resource doesn't exist *or* caller can't see it (intentionally indistinguishable) |
| `405` | The path exists, but not for this method |
| `409` | Conflict with existing state, including an `Idempotency-Key` reused with a different body |
| `413` | The body is too large |
| `422` | The request parsed but failed validation |
| `429` | Rate limited |
| `5xx` | Server-side problem |

`429` and `5xx` are the only families where sending the same request again can succeed. For every other `4xx`, the code tells you what to change.

## Error codes {#codes}

The two APIs share most codes. Where they spell the same situation differently today, both spellings are listed, and the **API** column says which API sends which.

### Authentication and authorization {#codes-auth}

| `code` | Status | API | What |
|---|---|---|---|
| `unauthorized` | 401 | Both | No credential was sent, or it has been revoked. On Inboxes, also a key it doesn't recognise. |
| `invalid_credential` | 403 | Webhooks | The key or token isn't valid. Replace it; sending the same credential again won't work. |
| `forbidden` | 403 | Both | The credential is valid but can't do this: a missing scope or role, a key limited to certain projects used outside them, or a product that isn't enabled for your workspace. `message` says which. |

`invalid_credential` is a `403` on the Webhooks API, not a `401`, and it stays that way. Handle both codes. See [Authentication](/docs/authentication) for the request shape.

### Request validation {#codes-validation}

| `code` | Status | API | What |
|---|---|---|---|
| `validation_error` | 422 | Webhooks | The body, query or path failed validation. `details` is a list of entries. |
| `invalid_request` | 422 | Inboxes | The same situation. `details` is `{"errors": [...]}`, holding the same entries. |
| `bad_request` | 400 | Webhooks | The request can't be acted on as sent. `message` says why. |
| `payload_too_large` | 413 | Both | The body is over the size limit. |
| `method_not_allowed` | 405 | Both | The path exists, but not for this method. |

Each validation entry describes one failing input: `loc` says where (`["body", "event_type"]`), `type` says what is wrong in machine-readable form (`missing`, `string_too_long`, `json_invalid`, …) and `msg` says it in English. A body that isn't valid JSON is a validation error too, with the type `json_invalid`.

### Webhooks API codes {#codes-webhooks}

These belong to the Webhooks API's own objects (event types, schemas, sources) and are all `422`:

| `code` | What |
|---|---|
| `unknown_event_type` | The event type isn't in your workspace's catalog, and the catalog only accepts registered types. |
| `invalid_payload` | The payload doesn't match the schema registered for its event type. |
| `schema_too_large` | A JSON Schema you registered is too big or too deeply nested. |
| `schema_pattern_unsafe` | A `pattern` in your schema is too long, doesn't compile, or could take too long to run. |
| `schema_ref_unsupported` | Your schema uses a `$ref` the API doesn't resolve. |
| `provider_secret_required` | Rotating a Stripe or GitHub source needs the new secret from that provider. |
| `broker_not_allowed` | A RabbitMQ source names a broker the API won't connect to. |
| `unprocessable` | An older check that doesn't have its own code yet. `message` says what failed. |

### Plan and billing {#codes-plan}

All of these are `402`. Retrying never helps: someone has to change the plan, settle a payment, or wait for the next billing period.

| `code` | API | What |
|---|---|---|
| `quota_exceeded` | Both | Over a plan limit. On Webhooks, the monthly delivery quota: wait for the next period or upgrade. On Inboxes, an allocation or ingest ceiling; `details` names the limit and the current value. |
| `plan_violation` | Webhooks | The request crosses one of your plan's ceilings (the number of endpoints, for example) or needs something the plan doesn't include. |
| `not_entitled` | Inboxes | The feature isn't in your plan, such as the read API on the free plan. |
| `workspace_frozen` | Both | A charge is unsettled, so changes are refused. Settle it in your account console; upgrading the plan is refused too until you do. |
| `workspace_suspended` | Both | The grace period after an unsettled charge has ended and the service has stopped for this workspace. |

`quota_exceeded` is a `402`, not a `429`. A rate limit clears by itself in seconds; a quota doesn't.

### Resources {#codes-resources}

| `code` | Status | API | What |
|---|---|---|---|
| `not_found` | 404 | Both | The resource doesn't exist, or you can't see it. The two are deliberately indistinguishable. |

### Conflicts {#codes-state}

| `code` | Status | API | What |
|---|---|---|---|
| `conflict` | 409 | Webhooks | The request clashes with existing state: a name already taken, or an `Idempotency-Key` reused with a different body ([Idempotency](/docs/idempotency#conflicts)). `message` says which. |

### Rate limits {#codes-rate}

| `code` | Status | API | What |
|---|---|---|---|
| `rate_limited` | 429 | Both | Too many requests. If `Retry-After` is set, wait that many seconds and retry; otherwise back off. On Inboxes, a per-inbox limit also sets `details.inbox_id` and `details.rate_per_min`. |

### Server {#codes-server}

| `code` | Status | API | What |
|---|---|---|---|
| `internal` | 500 | Webhooks | Something broke on our side. Safe to retry idempotent requests. |
| `internal_error` | 500 | Inboxes | The same situation, in the Inboxes spelling. |
| `unavailable` | 503 | Webhooks | Temporarily unable to serve the request. Retry with backoff. |
| `error` | any | Inboxes | A status with no code of its own on Inboxes, such as a `400` when the client disconnected mid-body. |

A `502` or `504` from the edge in front of the APIs can arrive with no JSON body at all. Treat a `5xx` you can't parse as retryable.

## When a code is renamed {#renames}

Four situations have two spellings today: `validation_error` and `invalid_request`, `internal` and `internal_error`, a key the API doesn't recognise (`invalid_credential` on Webhooks, `unauthorized` on Inboxes), and Inboxes' bare `error`. We intend to bring each to one spelling. A rename is handled under the [deprecation policy](/docs/versioning#deprecation): it is announced in the [changelog](/changelog), and the old spelling keeps being sent in `error.code` for at least 12 months. To be ready either way, match both spellings now, as the [handling pattern](#pattern) below does.

## Codes this page used to list {#earlier-versions}

Earlier versions of this page listed the codes on the left. The APIs never sent them; they send the codes on the right.

| Earlier versions listed | The APIs send |
|---|---|
| `validation_failed` (400) | `validation_error` (422) on Webhooks, `invalid_request` (422) on Inboxes |
| `fields` | `details`: a list on Webhooks, `{"errors": [...]}` on Inboxes |
| `request_id` in every body | The `X-Request-ID` response header |
| `malformed_json` (400), `unsupported_content_type` (415) | `validation_error` / `invalid_request` (422) |
| `request_too_large` | `payload_too_large` (413) |
| `no_credentials`, `expired_credentials` (401) | `unauthorized` (401) |
| `invalid_credentials` (401) | `invalid_credential` (403) on Webhooks, `unauthorized` (401) on Inboxes |
| `scope_required`, `wrong_project` (403) | `forbidden` (403); `message` names what is missing |
| `already_exists`, `state_conflict`, `not_empty`, `idempotency_key_reused` (409) | `conflict` (409) |
| `rate_limit_exceeded` | `rate_limited` (429) |
| `quota_exceeded` as a 429 | `quota_exceeded` as a 402 |
| `internal_error` on every API | `internal` on Webhooks, `internal_error` on Inboxes |
| `service_unavailable` (503), `gateway_timeout` (504) | `unavailable` (503) on Webhooks; a gateway `502`/`504` may have no JSON body |

## Handling pattern {#pattern}

```ts
async function call(): Promise<Event> {
  const res = await fetch(url, opts)
  if (res.ok) return await res.json()

  // A gateway 502/504 can arrive without a JSON body
  const body = await res.json().catch(() => null)
  const error = body?.error ?? { code: 'error', message: res.statusText }
  const requestId = res.headers.get('X-Request-ID')

  // Switch on code, not status: one status can carry several codes
  switch (error.code) {
    case 'rate_limited': {
      const wait = Number(res.headers.get('Retry-After') ?? '1')
      await sleep(wait * 1000)
      return call() // retry
    }
    case 'invalid_credential': // Webhooks: a key it doesn't recognise
    case 'unauthorized': // Both: no usable credential; on Inboxes, also a key it doesn't recognise
      // The credential is missing or bad: replace it rather than retry with it
      throw new CredentialError(error, requestId)
    case 'validation_error': // Webhooks
    case 'invalid_request': { // Inboxes
      const entries = Array.isArray(error.details) ? error.details : error.details?.errors ?? []
      throw new ValidationError(entries, requestId)
    }
    case 'quota_exceeded':
    case 'plan_violation':
    case 'not_entitled':
      // Retrying won't help; the plan has to change, or the period has to roll over
      throw new PlanError(error, requestId)
    default:
      // Unknown code, but the family tells us the rough shape
      if (res.status >= 500) {
        // Server-side; safe to retry idempotent ops
        throw new RetryableError(error, requestId)
      }
      throw new TerminalError(error, requestId)
  }
}
```

The general rule: **switch on `error.code`, default to handling by status family**. New codes added on existing statuses won't break you; your default case handles them. The same rule holds for a dashboard or an SDK built on these APIs: the published [SDKs](/docs/product-webhooks/sdks) pass `error.code` through unchanged, so switch on the code the exception carries.

## Reporting bugs {#bugs}

Every response carries an `X-Request-ID` header, errors included, and both APIs let browser JavaScript read it. When something's wrong on our side (5xx, unexpected behavior), the request id is what lets us find the call in our logs. Log it next to each error and include it in support tickets.

Don't share request ids publicly (they're not secret, but they let anyone who has them ask us about your account's traffic). Use them in private channels (support, dashboard tickets).

## What's next {#next-steps}

- [Conventions](/docs/conventions) — the rest of the request/response shape.
- [Authentication](/docs/authentication) — the auth-error codes in context.
- [Rate limiting](/docs/rate-limiting) — the `Retry-After` mechanics in detail.
- [Idempotency](/docs/idempotency) — safe-retry pattern for 5xx + 429 cases.
- [Versioning](/docs/versioning) — what counts as a breaking change, and the deprecation policy a code rename follows.
