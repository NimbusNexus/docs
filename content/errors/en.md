---
title: Errors
description: The error shape, the error codes the Webhooks and Inboxes APIs send, and how to handle each.
publishedAt: 2026-05-20
updatedAt: 2026-10-05
kind: concept
---

# Errors

Every error response from the Webhooks and Inboxes APIs uses the same JSON shape. Switch on `error.code`, or on `error.next_code` when an error carries one, to handle each case. Don't parse `message`, and don't decide from the status alone: one status can carry several codes, and across the two APIs `402` carries five.

> **Updated on 2026-10-05.** Error bodies gained fields and lost none: `request_id` (the same value as the `X-Request-ID` header), a `reason` and named values in `details` on many more errors, `params` on validation entries that have a numeric bound, and `next_code` on an error whose code is being renamed. Every status, `code` and `message` is unchanged. On Webhooks, a `conflict` names the clash in `details.reason`, the monthly `quota_exceeded` names its `metric`, `limit`, `current` and `period`, every `413` names its `limit`, and `plan_violation` carries the `next_code` it will become, with that code's `details` ([When a code is renamed](#renames)). [The shape](#shape) describes each field.
>
> **Corrected on 2026-10-05.** Earlier versions of this page listed codes, statuses and fields the APIs have never sent, among them `validation_failed` (400), `rate_limit_exceeded`, `quota_exceeded` as a 429 and `fields`. Code that matches on those has never matched anything. They also promised a `request_id` in every body before the APIs sent one; error bodies carry it now, all but one ([The request id](#request-id)). [Codes this page used to list](#earlier-versions) maps each one to what the API actually sends.

## The shape {#shape}

A read-only key that tries to create an inbox on Inboxes, or an endpoint on Webhooks, gets this answer from both (only the `request_id` differs):

```json
{
  "error": {
    "code": "forbidden",
    "message": "admin scope required",
    "details": {
      "reason": "scope",
      "required": "admin"
    },
    "request_id": "5f0c2e9a8b7d4c31a6e4f2b1d9c8e7a6"
  }
}
```

Up to five fields. `code` and `message` are always there, `request_id` is on every error body but one, and `details` and `next_code` appear when they have something to say:

| Field | Always present | What |
|---|---|---|
| `code` | Yes | Stable machine-readable string. Branch on this, or on `next_code` when it's present. |
| `message` | Yes | English text for logs and support tickets. Not localized, and not meant for an end-user UI. |
| `details` | No | Structured context: a `reason` that refines the code, and the values that go with it, such as the `id` that wasn't found. On a validation error, the failing inputs. Its shape depends on the code; on a Webhooks `plan_violation` it follows the `next_code`, a list for `validation_error` and an object otherwise. See [What `details` carries](#details). |
| `request_id` | Almost always | The id of this request, the same value as the `X-Request-ID` response header. Log it and quote it to support; never branch on it. See [The request id](#request-id). |
| `next_code` | No | Sent only while a code is being renamed: the code this error will carry once the rename lands. Prefer it to `code`. See [When a code is renamed](#renames). |

New fields may be added to the `error` member, as to any response; ignore the ones you don't use ([Versioning](/docs/versioning#forward-compat)).

### What `details` carries {#details}

Treat every key in `details` as optional: read the ones you need and ignore the rest. When it has a `reason`, that is a stable machine string that refines the code: why a `forbidden` was refused, or what kind of thing a `not_found` didn't find. Beside it are the values that reason needs, under fixed names. Some codes carry values with no reason, and many errors carry no `details` at all. Like `code`, `details.reason` is an open string, not an enum: new reasons and new codes are [additive changes](/docs/versioning#additive), so keep a default branch for both. The table lists what you can meet calling the APIs today.

| `code` | API | `details.reason` | Other keys in `details` |
|---|---|---|---|
| `unauthorized` | Inboxes | `missing`: no credential was sent. `revoked`: the key or session has been revoked. `invalid`: a sign-in session that didn't verify, usually because it has expired. `no_workspace`: the credential isn't tied to a workspace. | — |
| `forbidden` | Both | `scope`: the credential's scope doesn't allow this. `project`: the credential, or the person using it, has no access to the project the request names; Inboxes also sends it for any credential limited to certain projects, which it doesn't accept yet. `csrf`: a browser session sent a write without the `X-CSRF` header. `operator`: the route, or a field in the request, is for platform operators only. | `required`, on most `scope` refusals: the scope that would have been allowed (`admin` on Inboxes; `admin`, `read` or `publish` on Webhooks) |
| `forbidden` | Webhooks | `role`: your role, in the workspace or on the project of the resource you're acting on, is too low. `project_confined`: a credential limited to certain projects used on a route that answers for the whole workspace. `product_not_enabled`: your access doesn't include Webhooks. `not_provisioned`: the workspace isn't set up for Webhooks yet. | `required`, on `role`: the lowest role allowed (`admin`) |
| `not_found` | Both | The kind of resource. Inboxes: `inbox`, `message`, `workspace`. Webhooks: `endpoint`, `source`, `event`, `delivery`, `capture`, `event_type`, `operational_endpoint`, `project`, `workspace`, `user`, and `default_project` (a write that names no project, in a workspace that has none yet). | `id`: the id you asked for. Absent on `user` and `default_project`, where you named none, and on a path that doesn't exist at all. |
| `bad_request` | Webhooks | `project_required`: a write that names no project, from a credential that can reach several. | `projects`: the projects the credential can reach |
| `conflict` | Webhooks | Which clash, such as `event_type_exists` or `idempotency_key_reuse`. [Conflicts](#codes-state) lists each reason and when it's sent. | The values that reason needs, such as the `id` of the endpoint, delivery or project the clash is about; [Conflicts](#codes-state) lists them per reason |
| `quota_exceeded` | Both | `allocation`: a plan's ceiling on a count (Inboxes: addresses or request bins; Webhooks: endpoints, as the `next_code` of a `plan_violation`). `period`: the monthly ceiling (Inboxes: messages; Webhooks: deliveries). | `metric` (`inboxes`, `http_bins` or `messages` on Inboxes; `endpoints` or `deliveries` on Webhooks) and its `limit`; `current` on `allocation`, and on a Webhooks `period` (the deliveries used before the refused publish) when the count could be read; `period` on `period`: the month on Inboxes (`YYYY-MM`), the billing cycle's first day on Webhooks (`YYYY-MM-DD`). A publish is refused when its deliveries would take the count past `limit`, so on Webhooks `current` can be below `limit`. The keys Inboxes sent before stay: `max_inboxes` or `max_http_bins` with `current`, or `period` with `monthly_messages`. |
| `not_entitled` | Both | — | `feature`: `read_api` or `optional_phrase_gate` on Inboxes; `rabbitmq_sources` on Webhooks, where `not_entitled` is the `next_code` of a `plan_violation`. The Inboxes read API refusal also keeps `plan`. |
| `plan_violation` | Webhooks | Its `next_code`'s reason, when that has one: `allocation` for the endpoint limit | The keys its `next_code` sends ([When a code is renamed](#renames)). When the `next_code` is `validation_error`, `details` is that code's entry list instead of an object. |
| `payload_too_large` | Both | — | `limit` in bytes, on every `413`. Inboxes also sends `size` when the API measured the body. |
| `rate_limited` | Inboxes | `inbox_rate`: one inbox's per-minute limit | `retry_after` in seconds, the same number as the `Retry-After` header; `rate_per_min` and `inbox_id` |
| `unavailable` | Inboxes | `ingest_disabled`: message acceptance is switched off | — |

Validation errors carry their failing inputs instead; see [Request validation](#codes-validation).

### The request id {#request-id}

`error.request_id` is the same value as the `X-Request-ID` header every response carries, so either one identifies the request. If your request sends an `X-Request-ID` header (up to 128 letters, digits, `.`, `_` or `-`), the API uses that value as the request id; otherwise it makes one. If you set it, make it unique per request, so the id points to one call. The one error body without it is the Webhooks `413` for a request body over the size limit, which carries the id in the header only. Read the body first and fall back to the header, as the [handling pattern](#pattern) does. What to do with the id is under [Reporting bugs](#bugs).

## Status code families {#families}

| Status family | Family meaning |
|---|---|
| `200`/`201`/`202`/`204` | Success |
| `400` | The request couldn't be read as sent |
| `401` | No usable credential: none was sent, or it was revoked. Inboxes also answers `401` for a key it doesn't recognise or can't verify |
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
| `unauthorized` | 401 | Both | No credential was sent, or it has been revoked. On Inboxes, also an API key or token it doesn't recognise or can't verify, which carries `next_code: invalid_credential`; every other Inboxes `401` carries a `details.reason`. |
| `invalid_credential` | 403 | Webhooks | The key or token isn't valid. Replace it; sending the same credential again won't work. |
| `forbidden` | 403 | Both | The credential is valid but can't do this: a missing scope or role, a key limited to certain projects used outside them, or a product that isn't enabled for your workspace. `details.reason` says which. |

`invalid_credential` is a `403` on the Webhooks API, not a `401`, and it stays that way. On Inboxes it arrives as the `next_code` of a `401` `unauthorized` ([When a code is renamed](#renames)). Handle both codes. See [Authentication](/docs/authentication) for the request shape.

### Request validation {#codes-validation}

| `code` | Status | API | What |
|---|---|---|---|
| `validation_error` | 422 | Webhooks | The body, query or path failed validation. `details` is a list of entries. |
| `invalid_request` | 422 | Inboxes | The same situation. `details` is `{"errors": [...]}`, holding the same entries. Carries `next_code: validation_error`. |
| `bad_request` | 400 | Webhooks | The request can't be acted on as sent. `message` says why. |
| `payload_too_large` | 413 | Both | The body is over the size limit. |
| `method_not_allowed` | 405 | Both | The path exists, but not for this method. |

Each validation entry describes one failing input: `loc` says where (`["body", "event_type"]`), `type` says what is wrong in machine-readable form (`missing`, `string_too_long`, `json_invalid`, …) and `msg` says it in English. When the rule has a number, the entry also carries it in `params`: `count` for a length (`string_too_short`, `string_too_long`, `too_short`, `too_long`) and `limit` for a bound (`greater_than`, `greater_than_equal`, `less_than`, `less_than_equal`). Webhooks' own type `webhooks.max_attempts_above_plan`, which arrives today inside a `plan_violation` ([When a code is renamed](#renames)), carries `count`, the plan's ceiling. A body that isn't valid JSON is a validation error too, with the type `json_invalid`.

An Inboxes label one character over its limit:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "request validation failed",
    "details": {
      "errors": [
        {
          "loc": ["body", "label"],
          "msg": "String should have at most 200 characters",
          "type": "string_too_long",
          "params": {"count": 200}
        }
      ]
    },
    "request_id": "a3e81f0c5b9d4e2f8c7a6b5d4e3f2a1b",
    "next_code": "validation_error"
  }
}
```

On Webhooks the same entry sits directly in `details`, which is a list, and there is no `next_code`.

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

All of these are `402`. Retrying the same request never helps: someone has to change the plan, settle a payment, wait for the next billing period, or change the request, such as a `max_attempts` within the plan's ceiling.

| `code` | API | What |
|---|---|---|
| `quota_exceeded` | Both | Over a plan limit: an allocation (Inboxes: addresses or request bins; Webhooks: endpoints, as the `next_code` of a `plan_violation`) or a monthly ceiling (Inboxes: messages; Webhooks: deliveries), where you wait for the next period or upgrade. On both APIs `details.reason` says which, and `details` names the `metric`, its `limit` and, for an allocation, the `current` count. |
| `plan_violation` | Webhooks | The request crosses one of your plan's ceilings (the number of endpoints, for example) or needs something the plan doesn't include. It carries `next_code` (`quota_exceeded`, `validation_error` or `not_entitled`) with that code's `details`; switch on that ([When a code is renamed](#renames)). |
| `not_entitled` | Inboxes | The feature isn't in your plan, such as the read API on the free plan. `details.feature` names it. Webhooks sends it only as the `next_code` of a `plan_violation`, for a RabbitMQ source below Pro. |
| `workspace_frozen` | Both | A charge is unsettled, so changes are refused. Settle it in your account console; upgrading the plan is refused too until you do. |
| `workspace_suspended` | Both | The grace period after an unsettled charge has ended and the service has stopped for this workspace. |

`quota_exceeded` is a `402`, not a `429`. A rate limit clears by itself in seconds; a quota doesn't.

### Resources {#codes-resources}

| `code` | Status | API | What |
|---|---|---|---|
| `not_found` | 404 | Both | The resource doesn't exist, or you can't see it. The two are deliberately indistinguishable. `details.reason` names the kind of resource and `details.id` the id you asked for, when there is one; a path that doesn't exist carries no `details` ([What `details` carries](#details)). |

### Conflicts {#codes-state}

| `code` | Status | API | What |
|---|---|---|---|
| `conflict` | 409 | Webhooks | The request clashes with existing state: a name already taken, or an `Idempotency-Key` reused with a different body ([Idempotency](/docs/idempotency#conflicts)). `details.reason` says which, from the table below. |

Each `details.reason` a `conflict` carries, when it's sent, and the other keys in `details`:

| `details.reason` | When | Other keys in `details` |
|---|---|---|
| `event_type_exists` | An event type with that name is already registered in the same scope: workspace-wide, or in the project you named. | `event_type`: the name |
| `project_not_empty` | Deleting a project that still holds endpoints or sources. Delete them first. | `id`: the project. `endpoints` and `sources`: how many it holds |
| `idempotency_key_reuse` | An `Idempotency-Key` reused with a different body ([Idempotency](/docs/idempotency#webhooks)). The original event stands. | `idempotency_key`: the key |
| `delivery_not_redeliverable` | Redelivering a delivery that is still queued or being sent. Only a `sent`, `failed` or `dead` delivery can be redelivered. | `id`: the delivery. `state`: `queued`, `sending`, `sent`, `failed` or `dead`, or `missing` if the delivery was deleted meanwhile |
| `delivery_exists` | Replaying an event to an endpoint that already has a delivery of it. Redeliver that delivery instead. | `event_id` and `endpoint_id` |
| `endpoint_not_enabled` | Replaying an event to an endpoint that is switched off, by you or automatically after repeated failures. | `id`: the endpoint. `state`: `disabled` (by you) or `auto_disabled` (automatically) |
| `endpoint_suspended` | Replaying an event to an endpoint we have suspended. | `id`: the endpoint. `cause`: `abuse`, `non_payment` or `plan_downgrade`; the most serious when several apply, and absent when none of them does |
| `endpoint_has_pending_deliveries` | Deleting an endpoint that still has deliveries queued, being sent or waiting for a retry. The endpoint is disabled even though the delete was refused, so no new deliveries reach it; retry the delete once they settle. | `id`: the endpoint. `count`: its pending deliveries |
| `replay_across_projects` | Replaying an event to an endpoint in a different project. | `event_id` and `endpoint_id` |
| `replay_window_inverted` | A bulk replay whose `from` is after its `to`. | — |

### Rate limits {#codes-rate}

| `code` | Status | API | What |
|---|---|---|---|
| `rate_limited` | 429 | Both | Too many requests. If `Retry-After` is set, wait that many seconds and retry; otherwise back off. On Inboxes, `details.retry_after` carries the same number, and a per-inbox limit also sets `details.reason` to `inbox_rate`, with `details.inbox_id` and `details.rate_per_min`. |

### Server {#codes-server}

| `code` | Status | API | What |
|---|---|---|---|
| `internal` | 500 | Webhooks | Something broke on our side. Safe to retry idempotent requests. |
| `internal_error` | 500 | Inboxes | The same situation, in the Inboxes spelling. |
| `unavailable` | 503 | Inboxes | Temporarily unable to serve the request: message acceptance is switched off, and `details.reason` is `ingest_disabled`. Retry with backoff. |
| `error` | any | Inboxes | A status with no code of its own on Inboxes, such as a `400` when the client disconnected mid-body. Carries `next_code`: the code that status has elsewhere, `bad_request` for that `400`. |

A `502` or `504` from the edge in front of the APIs can arrive with no JSON body at all. Treat a `5xx` you can't parse as retryable.

## When a code is renamed {#renames}

Four situations have two spellings today: `validation_error` and `invalid_request`, `internal` and `internal_error`, a key the API doesn't recognise (`invalid_credential` on Webhooks, `unauthorized` on Inboxes), and Inboxes' bare `error`. We intend to bring each to one spelling. A rename is announced in the [changelog](/changelog), and the old spelling keeps being sent in `error.code` for at least 12 months after that, the same period the [deprecation policy](/docs/versioning#deprecation) gives a field.

While a rename is under way, the error also carries `next_code`: the spelling `code` will have once the rename lands. That field, not a `Deprecation` response header, is how an error tells you its code is being renamed. Inboxes refusing a credential it doesn't recognise:

```json
{
  "error": {
    "code": "unauthorized",
    "message": "invalid credentials",
    "request_id": "0d9b7c4e2f1a4b8e9c6d3a5f7e2b1c40",
    "next_code": "invalid_credential"
  }
}
```

These errors carry `next_code` today:

| API | `code` | `next_code` | When |
|---|---|---|---|
| Inboxes | `invalid_request` | `validation_error` | Every request that fails validation. |
| Inboxes | `unauthorized` | `invalid_credential` | An API key or token it doesn't recognise, or one that fails verification. A missing or revoked credential, or a sign-in session that has ended, stays `unauthorized` with a `details.reason` and no `next_code`. |
| Inboxes | `error` | The code that status has elsewhere, such as `bad_request` for a `400` | A status with no code of its own on Inboxes. |
| Webhooks | `plan_violation` | `quota_exceeded` | The endpoint limit (`POST /v1/endpoints`). `details`: `reason` `allocation`, `metric` `endpoints`, `limit` (the plan's ceiling) and `current` (the endpoints the workspace has). |
| Webhooks | `plan_violation` | `validation_error` | `max_attempts` above the plan's ceiling (`POST /v1/endpoints`, `PATCH /v1/endpoints/{id}`). `details` is the entry list, holding one entry: `loc` `["body", "max_attempts"]`, `type` `webhooks.max_attempts_above_plan`, and `params.count`, the ceiling. |
| Webhooks | `plan_violation` | `not_entitled` | A RabbitMQ source below Pro: `POST /v1/sources`, or a `PATCH /v1/sources/{id}` on a RabbitMQ source whose body sets `status` to `enabled` or sets any of `broker_identifier`, `broker_host`, `broker_port`, `broker_vhost`, `broker_user`, `broker_exchange` or `broker_topic`, even to the value it already has. Other changes, such as renaming or disabling the source, stay allowed. `details.feature` is `rabbitmq_sources`. |

Webhooks sends `next_code` only on `plan_violation`, so `internal` is still the code to match for a Webhooks `500`.

Switch on `next_code` when it's present and on `code` otherwise (`error.next_code ?? error.code`). A handler written that way needs no change when a rename lands: from then on `code` carries the new spelling, and `next_code` is no longer sent for it. If you can only read `code`, for example through an SDK that passes `code` alone, match both spellings until the rename lands.

We also intend to retire Webhooks' `plan_violation` and `unprocessable`. `plan_violation`'s rename is already under way: `code` stays `plan_violation` and the status stays `402`, and each refusal carries the `next_code` it will become, with that code's `details` (the table above). The [changelog](/changelog) will announce the date `code` changes, at least 12 months before that date; from then on `max_attempts` over the plan's ceiling is a `422`, and the other situations stay `402`. `unprocessable` is still sent unchanged, with no `next_code`; its rename will be announced the same way. `unauthorized` itself isn't being retired: it stays the code for a missing or revoked credential, and only an API key or token Inboxes doesn't recognise or can't verify moves to `invalid_credential`.

## Codes this page used to list {#earlier-versions}

Earlier versions of this page listed the codes and fields on the left. The APIs didn't send them; they send what's on the right. One of them, `request_id`, has since been added to error bodies, and its row says how.

| Earlier versions listed | The APIs send |
|---|---|
| `validation_failed` (400) | `validation_error` (422) on Webhooks, `invalid_request` (422) on Inboxes |
| `fields` | `details`: a list on Webhooks, `{"errors": [...]}` on Inboxes |
| `request_id` in every body | Not sent while those versions were current: the id was in the `X-Request-ID` response header only. Since the update noted at the top of this page, every error body but one carries it too, as `error.request_id`, with the same value as the header ([The request id](#request-id)). |
| `malformed_json` (400), `unsupported_content_type` (415) | `validation_error` / `invalid_request` (422) |
| `request_too_large` | `payload_too_large` (413) |
| `no_credentials`, `expired_credentials` (401) | `unauthorized` (401) |
| `invalid_credentials` (401) | `invalid_credential` (403) on Webhooks, `unauthorized` (401) on Inboxes, with `next_code: invalid_credential` |
| `scope_required`, `wrong_project` (403) | `forbidden` (403); `details.reason` says why (`scope`, `project`, …), and `details.required` names a missing scope |
| `already_exists`, `state_conflict`, `not_empty`, `idempotency_key_reused` (409) | `conflict` (409); `details.reason` says which (`event_type_exists`, `project_not_empty`, `idempotency_key_reuse`, …) |
| `rate_limit_exceeded` | `rate_limited` (429) |
| `quota_exceeded` as a 429 | `quota_exceeded` as a 402 |
| `internal_error` on every API | `internal` on Webhooks, `internal_error` on Inboxes |
| `service_unavailable` (503), `gateway_timeout` (504) | `unavailable` (503) on Inboxes, when message acceptance is switched off; a gateway `502`/`504` may have no JSON body |

## Handling pattern {#pattern}

```ts
async function call(): Promise<Event> {
  const res = await fetch(url, opts)
  if (res.ok) return await res.json()

  // A gateway 502/504 can arrive without a JSON body
  const body = await res.json().catch(() => null)
  const error = body?.error ?? { code: 'error', message: res.statusText }
  // Log this with every error; the header carries it when the body doesn't
  const requestId = error.request_id ?? res.headers.get('X-Request-ID')
  // While a code is being renamed, next_code is what it will become: prefer it
  const code = error.next_code ?? error.code

  // Switch on the code, not the status: one status can carry several codes
  switch (code) {
    case 'rate_limited': {
      const wait = Number(res.headers.get('Retry-After') ?? '1')
      await sleep(wait * 1000)
      return call() // retry
    }
    case 'invalid_credential': // Webhooks; on Inboxes, the next_code of a key it can't accept
    case 'unauthorized': // Both: no usable credential
      // The credential is missing or bad: replace it rather than retry with it
      throw new CredentialError(error, requestId)
    case 'forbidden': {
      // Optional refinement: why it was refused, and what would have been allowed
      const reason = error.details?.reason // 'scope', 'role', 'project', 'csrf', …
      const required = error.details?.required // 'admin', 'read' or 'publish', when sent
      throw new PermissionError(error, requestId, reason, required)
    }
    case 'validation_error': { // Webhooks; on Inboxes, the next_code of invalid_request
      // Also a Webhooks plan_violation's next_code, for max_attempts over the plan's ceiling
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

The general rule: **switch on `error.next_code ?? error.code`, default to handling by status family**. New codes added on existing statuses won't break you; your default case handles them. `details.reason` refines a case and never replaces it: a reason you don't recognise gets the code's handling. Don't parse `message`; where a value is meant for code, such as the id that wasn't found or the limit that was reached, it's in `details`. The same rule holds for a dashboard or an SDK built on these APIs: the published [SDKs](/docs/product-webhooks/sdks) pass `error.code` through unchanged, so switch on the code the exception carries, and match both spellings of a code that is being renamed.

## Reporting bugs {#bugs}

Every response carries an `X-Request-ID` header, errors included, and both APIs let browser JavaScript read it. Error bodies carry the same id as `error.request_id` ([with one exception](#request-id)). When something's wrong on our side (5xx, unexpected behavior), the request id is what lets us find the call in our logs. Log it next to each error and include it in support tickets.

Don't share request ids publicly (they're not secret, but they let anyone who has them ask us about your account's traffic). Use them in private channels (support, dashboard tickets).

## What's next {#next-steps}

- [Conventions](/docs/conventions) — the rest of the request/response shape.
- [Authentication](/docs/authentication) — the auth-error codes in context.
- [Rate limiting](/docs/rate-limiting) — the `Retry-After` mechanics in detail.
- [Idempotency](/docs/idempotency) — safe-retry pattern for 5xx + 429 cases.
- [Versioning](/docs/versioning) — what counts as a breaking change, and the 12-month deprecation period a code rename also gets.
