---
title: Errors
description: The error shape, the error codes the Webhooks, Inboxes and Request Bins APIs send, and how to handle each.
publishedAt: 2026-05-20
updatedAt: 2026-10-27
kind: concept
---

# Errors

Every error response from the Webhooks, Inboxes and Request Bins APIs uses the same JSON shape. Switch on `error.code`, or on `error.next_code` when an error carries one, to handle each case. Don't parse `message`, and don't decide from the status alone: one status can carry several codes, and on every API `402` carries four.

> **Updated on 2026-10-16.** In Webhooks, a custom header name that is a valid HTTP token with one line feed at the end is now refused like any other name that isn't a valid HTTP token: `webhooks.custom_header_name_invalid`, with that rule's `msg` and no `params` ([Request validation](#codes-validation)). Before, the line feed got past the token check and the name was refused as a control character, with `params.header`: as `webhooks.custom_header_control_character` from 2026-10-15, and as `value_error` before that. The request is still a `422` `validation_error`, and nothing else changed.
>
> **Updated on 2026-10-15.** Before the v1 launch, every rename that was under way on Inboxes and Webhooks has landed: an error that carried a `next_code` now carries that code, with that code's status, and neither API sends `next_code` any more.
>
> - A request that fails validation is `validation_error` on both APIs, still a `422`. On Inboxes it was `invalid_request`; on Webhooks, a field the API checks itself was `unprocessable`. On both, `details` is `{"errors": [...]}`; on Webhooks it was a bare list ([Request validation](#codes-validation)).
> - Every `500` is `internal_error` on both APIs (on Webhooks it was `internal`).
> - On Inboxes, an API key or token it doesn't recognise or can't verify is `invalid_credential`, still a `401` (it was `unauthorized`). A missing or revoked credential, or a sign-in session that has ended, is still `unauthorized` with a `details.reason`.
> - On Inboxes, a status with no code of its own carries that status's code, such as `bad_request` for a `400` (it was `error`).
> - On Webhooks, `plan_violation` is gone. The endpoint limit is `quota_exceeded` (`402`, `details.reason` `allocation`), `max_attempts` above the plan's ceiling is a `422` `validation_error`, and a RabbitMQ source below Pro, or turning endpoint verification off on a plan that requires it (no plan does today), is `not_entitled` (`402`).
> - On Webhooks, a bulk replay whose `from` is after its `to` is a `422` `validation_error` with an entry on `["body", "to"]`, no longer a `409` `conflict`.
> - Webhooks' own rules on custom headers, `retry_schedule` delays, a RabbitMQ source's broker fields and plan names name their own entry `type` instead of `value_error`; `loc`, `msg` and `params` are unchanged ([Request validation](#codes-validation)).
> - On Inboxes, a credential limited to certain projects is refused with `details.reason` `project_confined` (it was `project`) ([What `details` carries](#details)).
> - On Inboxes, `details` carries only the keys this page lists. `quota_exceeded` no longer sends `max_inboxes`, `max_http_bins` or `monthly_messages` (read `metric`, `limit`, `current` and `period`), the read API's `not_entitled` no longer sends `plan`, and the per-inbox `rate_limited` no longer sends `inbox_id`.
>
> Every `message` is unchanged, and so is every status but those of the two Webhooks refusals that became a `422`. These changes were made before the v1 launch, so they did not get the 12-month period [When a code is renamed](#renames) describes; that section maps each old spelling to the new one.
>
> **Updated on 2026-10-05.** Error bodies gained fields and lost none: `request_id` (the same value as the `X-Request-ID` header), a `reason` and named values in `details` on many more errors, `params` on validation entries that have a numeric bound, and `next_code` on an error whose code is being renamed. Every status, `code` and `message` is unchanged. On Webhooks, a `conflict` names the clash in `details.reason`, the monthly `quota_exceeded` names its `metric`, `limit`, `current` and `period`, every `413` names its `limit`, and `plan_violation` carries the `next_code` it will become, with that code's `details` ([When a code is renamed](#renames)). [The shape](#shape) describes each field.
>
> **Corrected on 2026-10-05.** Earlier versions of this page listed codes, statuses and fields the APIs have never sent, among them `validation_failed` (400), `rate_limit_exceeded`, `quota_exceeded` as a 429 and `fields`. Code that matches on those has never matched anything. They also promised a `request_id` in every body before the APIs sent one; error bodies carry it now, every one since 2026-10-06 ([The request id](#request-id)). [Codes this page used to list](#earlier-versions) maps each one to what the API actually sends.

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

Request Bins refuses the same read-only key with the same code and status, but its `details` name the role the action needs rather than a scope: `"reason": "role"` and `"required": "member"`. A key has that role with the `admin` scope, **Read & write** in the account console ([What `details` carries](#details)).

Up to five fields. `code`, `message` and `request_id` are on every error body the APIs send, and `details` and `next_code` appear when they have something to say:

| Field | Always present | What |
|---|---|---|
| `code` | Yes | Stable machine-readable string. Branch on this, or on `next_code` when it's present. |
| `message` | Yes | English text for logs and support tickets. Not localized, and not meant for an end-user UI. |
| `details` | No | Structured context: a `reason` that refines the code, and the values that go with it, such as the `id` that wasn't found. On a validation error, the failing inputs. Its shape depends on the code; on a validation error it is `{"errors": [...]}`, a list of entries. See [What `details` carries](#details). |
| `request_id` | Yes | The id of this request, the same value as the `X-Request-ID` response header. Log it and quote it to support; never branch on it. See [The request id](#request-id). |
| `next_code` | No | Sent only while a code is being renamed: the code this error will carry once the rename lands. Prefer it to `code`. No code is being renamed today, so no API sends it. See [When a code is renamed](#renames). |

New fields may be added to the `error` member, as to any response; ignore the ones you don't use ([Versioning](/docs/versioning#forward-compat)).

### What `details` carries {#details}

Treat every key in `details` as optional: read the ones you need and ignore the rest. When it has a `reason`, that is a stable machine string that refines the code: why a `forbidden` was refused, or what kind of thing a `not_found` didn't find. Beside it are the values that reason needs, under fixed names. Some codes carry values with no reason, and many errors carry no `details` at all. Like `code`, `details.reason` is an open string, not an enum: new reasons and new codes are [additive changes](/docs/versioning#additive), so keep a default branch for both. The table lists what you can meet calling the APIs today. In its **API** column, **Both** means Webhooks and Inboxes, and Request Bins has rows of its own.

| `code` | API | `details.reason` | Other keys in `details` |
|---|---|---|---|
| `unauthorized` | Both | `missing`: no credential was sent. `revoked`: the key or session has been revoked. `invalid`: on Inboxes, a sign-in session that didn't verify, usually because it has expired; on Webhooks, an inbound event to `POST /v1/ingest/{source_id}` whose signature doesn't verify. `no_workspace`, on Inboxes only: the credential isn't tied to a workspace. | — |
| `unauthorized` | Request Bins | `missing`: no credential was sent. `revoked`: the key or session has been revoked. `invalid`: a sign-in session that didn't verify, usually because it has expired. `no_workspace`: the sign-in session isn't tied to a workspace. | — |
| `forbidden` | Both | `scope`: the credential's scope doesn't allow this. `project_confined`: a credential limited to certain projects, used on a route that answers for the whole workspace; Inboxes doesn't accept project-limited credentials yet, so it sends this on every route. `csrf`: a browser session sent a write without the `X-CSRF` header. `operator`: the route, or a field in the request, is for platform operators only. | `required`, on most `scope` refusals: the scope that would have been allowed (`admin` on Inboxes; `admin`, `read` or `publish` on Webhooks) |
| `forbidden` | Webhooks | `role`: your role, in the workspace or on the project of the resource you're acting on, is too low. `project`: the credential, or the person using it, has no access to the project the request names. `product_not_enabled`: your access doesn't include Webhooks. `not_provisioned`: the workspace isn't set up for Webhooks yet. | `required`, on `role`: the lowest role allowed (`admin`) |
| `forbidden` | Request Bins | `role`: your role, or your key's scope, doesn't allow this. `project_confined`: a guest seat, or a key limited to a project; Request Bins serves whole workspaces, so it sends this on every route. `product_not_enabled`: your workspace hasn't added Request Bins, or your sign-in doesn't include it. `csrf`: a browser session sent a write without the `X-CSRF` header. `no_workspace`: the credential isn't tied to a workspace, such as a service token. | `required`, on `role`: `member` to create or change a bin, `admin` to delete or empty one. For a key, both mean the `admin` scope (**Read & write**). |
| `not_found` | Both | The kind of resource. Inboxes: `inbox`, `message`, `workspace`. Webhooks: `endpoint`, `source`, `event`, `delivery`, `capture`, `event_type`, `operational_endpoint`, `project`, `workspace`, `user`, and `default_project` (a write that names no project, in a workspace that has none yet). | `id`: the id you asked for. Absent on `user` and `default_project`, where you named none, and on a path that doesn't exist at all. |
| `not_found` | Request Bins | The kind of resource: `bin` or `request`. A bin that was deleted or has expired is `bin`. | `id`: the id you asked for. Absent on a path that doesn't exist at all. |
| `bad_request` | Webhooks | `project_required`: a write that names no project, from a credential that can reach several. | `projects`: the projects the credential can reach |
| `conflict` | Webhooks | Which clash, such as `event_type_exists` or `idempotency_key_reuse`. [Conflicts](#codes-state) lists each reason and when it's sent. | The values that reason needs, such as the `id` of the endpoint, delivery or project the clash is about; [Conflicts](#codes-state) lists them per reason |
| `quota_exceeded` | Both | `allocation`: a plan's ceiling on a count (Inboxes: addresses; Webhooks: endpoints). `period`: the monthly ceiling (Inboxes: messages; Webhooks: deliveries). | `metric` (`inboxes` or `messages` on Inboxes; `endpoints` or `deliveries` on Webhooks) and its `limit`; `current` on `allocation`, and on a Webhooks `period` (the deliveries used before the refused publish) when the count could be read; `period` on `period`: the month on Inboxes (`YYYY-MM`), the billing cycle's first day on Webhooks (`YYYY-MM-DD`). A publish is refused when its deliveries would take the count past `limit`, so on Webhooks `current` can be below `limit`. |
| `quota_exceeded` | Request Bins | `allocation`: the plan's ceiling on bins, on `POST /v1/bins`. Never `period`: past the month's requests, bins answer their senders and record nothing, and no API call is refused. | `metric` (`bins`), its `limit`, and `current` |
| `not_entitled` | Both | — | `feature`: `read_api` or `optional_phrase_gate` on Inboxes; `rabbitmq_sources` or `optional_endpoint_verification` on Webhooks. Webhooks sends `optional_endpoint_verification` for turning endpoint verification off on a plan that requires it; no plan does today. |
| `not_entitled` | Request Bins | — | `feature`: `read_api`, reading captured requests with an API key on the Free plan |
| `payload_too_large` | Both | — | `limit` in bytes, on every `413`. Inboxes also sends `size` when the API measured the body. |
| `payload_too_large` | Request Bins | — | `limit` in bytes, on every `413` |
| `unknown_event_type` | Webhooks | — | `event_type`: the name that isn't registered |
| `invalid_payload` | Webhooks | `payload`: the payload fails its event type's schema. `schema_invalid`: a schema you're registering isn't valid JSON Schema. | On `payload`: `errors`, up to 20 entries of `{path, keyword, params}` (below), and `total`, how many entries there were before that cut (the list's length when nothing was cut). On `schema_invalid`: `path`, a JSON Pointer into the schema, where it failed. |
| `schema_too_large` | Webhooks | `bytes`, `depth`, `members`, `enum_values` or `patterns`: the bound the schema broke | `limit`; with `size` too on `bytes` (both in bytes) |
| `schema_pattern_unsafe` | Webhooks | `too_long`, `does_not_compile`, `empty_repeat`, `nested_quantifier`, `ambiguous_alternation` or `too_complex`: the rule the pattern broke | `pattern`: the pattern, whole, though `message` shortens a long one; `limit` (in characters) on `too_long` |
| `schema_ref_unsupported` | Webhooks | — | `ref`: the remote `$ref` the API won't resolve |
| `provider_secret_required` | Webhooks | — | `provider`: `stripe`, `github` or `rabbitmq` |
| `broker_not_allowed` | Webhooks | None for your broker, whichever rule refused it (`not_system_broker` is sent only to the platform's own workspace) | `host`: the broker, as `host:port` |
| `rate_limited` | Both | `inbox_rate` (Inboxes): one inbox's per-minute limit. Webhooks sends no reason. | `retry_after` in seconds, the same number as the `Retry-After` header (both APIs). On Inboxes' `inbox_rate`, also `rate_per_min`. |
| `unavailable` | Inboxes | `ingest_disabled`: message acceptance is switched off | — |

On `invalid_payload`, each entry in `details.errors` says what failed where. `path` is a JSON Pointer to the value that failed: `""` is the payload itself, and for a missing or unexpected member it points to the object that should or shouldn't hold it. `keyword` is the JSON Schema keyword that failed (`required`, `type`, `enum`, `const`, `minimum`, `maximum`, `minLength`, `maxLength`, `minItems`, `maxItems`, `pattern`, `format` or `additionalProperties`), or `other` for any other keyword. `params` holds `property` (the missing or unexpected member, one entry each), `count` (a length or item bound), `limit` (the bound of a `minimum` or `maximum`) or `type` (the one type the value should have been), and is empty when none of these applies, as on `enum` or `pattern`, or on a `type` that allows several. Entries never carry the regex, the allowed values or the value that failed; `message` still describes one failure in English.

Request validation errors (`validation_error`) aren't in the table: on every API their `details` is `{"errors": [...]}`, a list of validation entries, each with `loc`, `type` and `msg`, a different shape from `invalid_payload`'s. See [Request validation](#codes-validation).

### The request id {#request-id}

`error.request_id` is the same value as the `X-Request-ID` header on every response an API sends, so either one identifies the request. If your request sends an `X-Request-ID` header (up to 128 letters, digits, `.`, `_` or `-`), the API uses that value as the request id; otherwise it makes one. If you set it, make it unique per request, so the id points to one call. Some responses come from the edge in front of the APIs rather than from an API: a `502` or `504`, for example, or a `413` for a body too large to reach the API. Those carry neither the API's error body nor `X-Request-ID`. Read the body first and fall back to the header, as the [handling pattern](#pattern) does, and expect both to be missing on those. What to do with the id is under [Reporting bugs](#bugs).

## Status code families {#families}

| Status family | Family meaning |
|---|---|
| `200`/`201`/`202`/`204` | Success |
| `400` | The request couldn't be read as sent |
| `401` | No usable credential: none was sent, or it was revoked. Inboxes and Request Bins also answer `401`, as `invalid_credential`, for a key they don't recognise or can't verify, and Webhooks answers `401`, as `unauthorized`, for an inbound event whose signature doesn't verify |
| `402` | Your plan or billing state stops the request: a quota, a feature your plan doesn't include, or a workspace that is frozen or suspended |
| `403` | Not allowed. Webhooks also answers `403`, as `invalid_credential`, for a credential it doesn't recognise |
| `404` | Resource doesn't exist *or* caller can't see it (intentionally indistinguishable) |
| `405` | The path exists, but not for this method |
| `409` | Conflict with existing state, including an `Idempotency-Key` reused with a different body |
| `413` | The body is too large |
| `422` | The request parsed but failed validation |
| `429` | Rate limited |
| `5xx` | Server-side problem |

`429` and `5xx` are the only families where sending the same request again can succeed. For every other `4xx`, the code tells you what to change.

## Error codes {#codes}

The two APIs share most codes and, since the update noted at the top of this page, spell almost every situation they share the same way. Two differ: `invalid_credential` is a `401` on Inboxes and a `403` on Webhooks, and a sign-in session that has expired is `unauthorized` (`details.reason` `invalid`) on Inboxes but `invalid_credential` on Webhooks. The **API** column says which API sends each code.

Request Bins sends the codes Inboxes sends for the same situations, those two included. In the **API** column, **All** means all three APIs, **Both** means Webhooks and Inboxes, and a row marked **Request Bins** is about that API alone.

### Authentication and authorization {#codes-auth}

| `code` | Status | API | What |
|---|---|---|---|
| `unauthorized` | 401 | All | No credential was sent, or it has been revoked. On Inboxes and Request Bins, also a sign-in session that has ended or didn't verify; every `unauthorized` they send carries a `details.reason`. On Webhooks, also an inbound event to `POST /v1/ingest/{source_id}` whose signature doesn't verify (`details.reason` `invalid`); every Webhooks `401` carries a `details.reason` ([What `details` carries](#details)). |
| `invalid_credential` | 401 on Inboxes and Request Bins, 403 on Webhooks | All | An API key or token the API doesn't recognise or can't verify. Replace it; sending the same credential again won't work. On Webhooks this includes a sign-in session that has expired: sign in again. |
| `forbidden` | 403 | All | The credential is valid but can't do this: a missing scope or role, a key limited to certain projects used outside them, or a product that isn't enabled for your workspace. `details.reason` says which. |

`invalid_credential` is a `403` on the Webhooks API and a `401` on Inboxes and Request Bins, and each stays that way: switch on the code, not the status. See [Authentication](/docs/authentication) for the request shape.

### Request validation {#codes-validation}

| `code` | Status | API | What |
|---|---|---|---|
| `validation_error` | 422 | All | The body, query or path failed validation, or, on Webhooks, a rule the API checks itself refused a field. `details` is `{"errors": [...]}`, a list of entries. |
| `bad_request` | 400 | All | The request can't be acted on as sent. `message` says why. On Inboxes and Request Bins, a body the API couldn't read, such as one that isn't valid UTF-8. |
| `payload_too_large` | 413 | All | The body is over the size limit. |
| `method_not_allowed` | 405 | All | The path exists, but not for this method. |

Each validation entry describes one failing input: `loc` says where (`["body", "event_type"]`), `type` says what is wrong in machine-readable form (`missing`, `string_too_long`, `json_invalid`, …) and `msg` says it in English. When the rule has a number, the entry also carries it in `params`: `count` for a length (`string_too_short`, `string_too_long`, `too_short`, `too_long`) and `limit` for a bound (`greater_than`, `greater_than_equal`, `less_than`, `less_than_equal`). A body that isn't valid JSON is a validation error too, with the type `json_invalid`; on Inboxes and Request Bins, a body that isn't valid UTF-8 is a `400` `bad_request` instead.

Webhooks also sends entry types of its own, for rules it checks itself:

- `webhooks.max_attempts_above_plan`: `max_attempts` above the plan's ceiling, on `POST /v1/endpoints` or `PATCH /v1/endpoints/{id}`; `loc` `["body", "max_attempts"]`, with `params.count`, the ceiling.
- `webhooks.url_not_https`: an endpoint `url` that isn't https, on `POST /v1/endpoints`, `PATCH /v1/endpoints/{id}` or `POST /v1/operational-endpoints`; `loc` `["body", "url"]`.
- `webhooks.end_before_start`: a bulk replay whose `to` is before its `from`; `loc` `["body", "to"]`. Equal bounds are allowed.
- `webhooks.end_not_after_start`: on a route for platform operators, a usage window that doesn't end after it starts; `loc` `["query", "end"]`.
- `webhooks.unknown_delivery_status`: an unknown `status` filter on `GET /v1/deliveries`; `loc` `["query", "status"]`, with `params.status`, the value sent.
- `webhooks.unknown_operational_event_type`: an `event_types` value that isn't an operational event type, on `POST /v1/operational-endpoints`; `loc` `["body", "event_types", <index>]`, one entry per distinct value, at its first index, with `params.event_type`, the value, and `params.choices`, the operational event types the API accepts.

On the same route for platform operators, a usage-window date that doesn't parse is a `date_parsing` entry on `["query", "start"]` or `["query", "end"]`, one for each such date. A refusal from a rule the API checks itself carries at most 20 entries.

Webhooks' own rules on custom headers, `retry_schedule` delays and a RabbitMQ source's broker fields send entries of their own `type`, with the `loc` and `msg` they have always had (except the header name the 2026-10-16 note describes), and `params` with the values the rule names:

- More than 20 custom headers: `too_long`, with `params.count`, `20`.
- A custom header name that isn't a valid HTTP token: `webhooks.custom_header_name_invalid`, with no `params`.
- A line break or other control character in a custom header value: `webhooks.custom_header_control_character`, with `params.header`, the header's name.
- A custom header value over 1024 characters: `webhooks.custom_header_value_too_long`, with `params.header` and `params.count`, `1024`.
- A name the API reserves for its own delivery headers (`Content-Type`, `User-Agent`, or any name starting with `X-Webhook-`): `webhooks.custom_header_managed`, with `params.header`.
- A hop-by-hop or connection-control name such as `Host` or `Connection`: `webhooks.custom_header_forbidden`, with `params.header`.
- A custom header value with a character that isn't ASCII: `webhooks.custom_header_not_ascii`, with `params.header`.
- Custom header names and values that together take more than 8192 bytes: `webhooks.custom_headers_too_large`, with `params.limit`, `8192`.
- A `retry_schedule` delay below 0 or above 604800 seconds: `webhooks.retry_delay_out_of_range`, with `params.limit`, `604800`.
- A RabbitMQ source created without all its broker fields: `webhooks.broker_fields_required`, with `params.missing`, a list of the fields (of `broker_identifier`, `broker_host`, `broker_user`, `broker_exchange` and `broker_topic`) that were missing or empty. Its `loc` is `["body"]`.

The custom header rules' `loc` is `["body", "custom_headers"]`, and `params.header` is the name as you sent it; a header's value never comes back. A plan name the API doesn't know, on a route for platform operators, is an `enum` entry with no `params`. Until the update noted at the top of this page, all of these entries had the type `value_error`.

Inboxes sends one entry type of its own: `inboxes.search_conflict`, for a message search on `GET /v1/inboxes/{id}/messages` or `GET /v1/messages` that names a `header` with `in` set to `subject`, `from` or `body`. Its `loc` is `["query", "in"]`, and it carries no `params` ([Searching messages](/docs/product-inboxes#search)).

Request Bins sends three:

- `bins.nul_character`: a NUL character in the path, the query string or a JSON body, which it can't store. Its `loc` is `["path"]`, `["query", <name>]` or `["body"]`, and it carries no `params`.
- `bins.forward_target`: a forward URL a bin won't forward to. Its `loc` is `["body", "forward_url"]`, and `params.reason` says why ([Forwarding](/docs/product-bins/reference#forwarding)).
- `bins.search_conflict`: a search on `GET /v1/bins/{id}/requests` or `GET /v1/requests` whose `header` or `field` doesn't go with its `in`, with the `loc` `["query", "in"]`, or that names both a `header` and a `field`, with the `loc` `["query", "field"]`. It carries no `params` ([Captured requests](/docs/product-bins/reference#requests)).

An Inboxes label one character over its limit:

```json
{
  "error": {
    "code": "validation_error",
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
    "request_id": "a3e81f0c5b9d4e2f8c7a6b5d4e3f2a1b"
  }
}
```

On Webhooks the same entry sits in the same `details.errors` list, under the same code, and Request Bins sends it for a bin `label` over 200 characters.

### Webhooks API codes {#codes-webhooks}

These belong to the Webhooks API's own objects (event types, schemas, sources, endpoints, deliveries) and are all `422`:

| `code` | What |
|---|---|
| `unknown_event_type` | The event type isn't in your workspace's catalog, and the catalog only accepts registered types. |
| `invalid_payload` | The payload doesn't match the schema registered for its event type (`details.reason` `payload`, with `details.errors`), or a schema you're registering isn't valid JSON Schema (`schema_invalid`). |
| `schema_too_large` | A JSON Schema you registered is too big or too deeply nested. |
| `schema_pattern_unsafe` | A `pattern` in your schema is too long, doesn't compile, or could take too long to run. |
| `schema_ref_unsupported` | Your schema uses a `$ref` the API doesn't resolve. |
| `provider_secret_required` | Rotating a Stripe or GitHub source needs the new secret from that provider, and rotating a RabbitMQ source needs the broker's new password. `details.provider` says which: `stripe`, `github` or `rabbitmq`. |
| `broker_not_allowed` | A RabbitMQ source names a broker the API won't connect to. |

### Plan and billing {#codes-plan}

All of these are `402`. Retrying the same request never helps: someone has to change the plan, settle a payment, wait for the next billing period, or free up an allocation, such as by releasing an address or deleting an endpoint.

| `code` | API | What |
|---|---|---|
| `quota_exceeded` | Both | Over a plan limit: an allocation (Inboxes: addresses; Webhooks: endpoints) or a monthly ceiling (Inboxes: messages; Webhooks: deliveries), where you wait for the next period or upgrade. On both APIs `details.reason` says which, and `details` names the `metric`, its `limit` and, for an allocation, the `current` count. |
| `quota_exceeded` | Request Bins | Over the plan's limit on bins, when creating one. `details.reason` is `allocation`, and `details` names the `metric` (`bins`), its `limit` and the `current` count. The monthly request limit never refuses an API call: past it, bins answer their senders and record nothing until the next month. |
| `not_entitled` | All | The feature isn't in your plan, such as the read API on the Inboxes free plan, reading captured requests with an API key on the Request Bins Free plan, or a RabbitMQ source below Pro on Webhooks. `details.feature` names it. |
| `workspace_frozen` | All | A charge is unsettled, so changes are refused. Settle it in your account console; upgrading the plan is refused too until you do. |
| `workspace_suspended` | All | The grace period after an unsettled charge has ended and the service has stopped for this workspace. |

`quota_exceeded` is a `402`, not a `429`. A rate limit clears by itself in seconds; a quota doesn't.

On Webhooks, the endpoint limit is `quota_exceeded` on `POST /v1/endpoints`, with `details.reason` `allocation`, `metric` `endpoints`, `limit` (the plan's ceiling) and `current` (the endpoints the workspace has). A RabbitMQ source below Pro is `not_entitled` with `details.feature` `rabbitmq_sources`: on `POST /v1/sources`, and on a `PATCH /v1/sources/{id}` of a RabbitMQ source whose body sets `status` to `enabled` or sets any of `broker_identifier`, `broker_host`, `broker_port`, `broker_vhost`, `broker_user`, `broker_exchange`, `broker_topic` or `broker_queues`, even to the value it already has. Other changes, such as renaming or disabling the source, stay allowed. `max_attempts` above the plan's ceiling isn't a `402`: it is a `422` `validation_error` ([Request validation](#codes-validation)).

On Request Bins, the bin limit is `quota_exceeded` on `POST /v1/bins`. Reading captured requests with an API key on Free is `not_entitled`, with `details.feature` `read_api`, on `GET /v1/bins/{id}/requests`, `GET /v1/requests` and `GET /v1/requests/{id}`; the console reads them on every plan. While a workspace is frozen or suspended, every write but a delete is refused with `workspace_frozen` or `workspace_suspended`, and reads stay open. Bins keep recording while the workspace is frozen and stop while it is suspended ([Plans and limits](/docs/product-bins/reference#limits)).

### Resources {#codes-resources}

| `code` | Status | API | What |
|---|---|---|---|
| `not_found` | 404 | All | The resource doesn't exist, or you can't see it. The two are deliberately indistinguishable. `details.reason` names the kind of resource and `details.id` the id you asked for, when there is one; a path that doesn't exist carries no `details` ([What `details` carries](#details)). |

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

A bulk replay whose `from` is after its `to` isn't a conflict: it is a `422` `validation_error` ([Request validation](#codes-validation)).

### Rate limits {#codes-rate}

| `code` | Status | API | What |
|---|---|---|---|
| `rate_limited` | 429 | Both | Too many requests. If `Retry-After` is set, wait that many seconds and retry; otherwise back off. `details.retry_after` carries the same number on both APIs, and on Inboxes a per-inbox limit also sets `details.reason` to `inbox_rate`, with `details.rate_per_min`. |

Request Bins' API sends no `rate_limited`. Its bin URLs limit how fast senders can send, and answer a sender over the limit with a `429` and `Retry-After`, not in this JSON shape ([What a bin URL answers](/docs/product-bins/reference#edge-answers)).

### Server {#codes-server}

| `code` | Status | API | What |
|---|---|---|---|
| `internal_error` | 500 | All | Something broke on our side. Safe to retry idempotent requests. |
| `unavailable` | 503 | Inboxes | Temporarily unable to serve the request: message acceptance is switched off, and `details.reason` is `ingest_disabled`. Retry with backoff. |

A `502` or `504` from the edge in front of the APIs can arrive with no JSON body at all. Treat a `5xx` you can't parse as retryable.

### Test and verify results {#failure-reason}

Testing or verifying a Webhooks endpoint (`POST /v1/endpoints/{id}/test`, `POST /v1/endpoints/{id}/verify`) sends a request to it and answers `200` with the outcome, whether that request succeeded or not, so a failure there isn't an error response. `delivered` on a test, or `verified` on a verification, says whether it worked. On a failure, `error` describes it in English and `failure_reason` names it as a stable machine string:

| `failure_reason` | What happened |
|---|---|
| `http_status` | The endpoint answered with a status outside `2xx`; `status_code` says which. |
| `timeout` | No answer within the endpoint's timeout. |
| `tls_failed` | The TLS handshake failed, most often because the certificate doesn't verify. |
| `dns_failed` | The host doesn't resolve. |
| `connection_failed` | Any other connection failure, such as a connection refused, reset or unreachable. |
| `blocked_address` | The host resolves to a private or otherwise non-public address, which Webhooks never sends to. |
| `challenge_not_echoed` | Verification only: the endpoint answered `2xx` without the challenge token in its body. |
| `url_changed` | Verification only: the endpoint's URL changed while the challenge was out. Verify again. |

`failure_reason` is `null` on success, and on a failure none of these describe, where `error` is the only description. Like `code`, it is an open string, not an enum: keep a default for a value you don't know, and branch on `failure_reason` rather than parsing `error`.

## When a code is renamed {#renames}

Inboxes and Webhooks finished their renames on 2026-10-15, before the v1 launch, rather than after 12 months. On Inboxes, `invalid_request` is now `validation_error`, an API key or token it doesn't recognise or can't verify is `invalid_credential` (still a `401`), and a status with no code of its own carries that status's code, such as `bad_request` for a `400`. On Webhooks, `internal` is now `internal_error`, `unprocessable` is now `validation_error`, and `plan_violation` is gone: each of its refusals sends the code its `next_code` named, with that code's status. Neither API sends `next_code` today. After the v1 launch, a rename is announced in the [changelog](/changelog), and the old spelling keeps being sent in `error.code` for at least 12 months after that, the same period the [deprecation policy](/docs/versioning#deprecation) gives a field.

While a rename is under way, the error also carries `next_code`: the spelling `code` will have once the rename lands. That field, not a `Deprecation` response header, is how an error tells you its code is being renamed.

Switch on `next_code` when it's present and on `code` otherwise (`error.next_code ?? error.code`). A handler written that way needs no change when a rename lands: from then on `code` carries the new spelling, and `next_code` is no longer sent for it. If you can only read `code`, for example through an SDK that passes `code` alone, match both spellings until the rename lands.

The renames that landed on 2026-10-15, with the refusals that moved with them:

| API | Situation | Before | Now |
|---|---|---|---|
| Inboxes | A request that fails validation | `422` `invalid_request`, `next_code` `validation_error` | `422` `validation_error` |
| Inboxes | An API key or token it doesn't recognise, or one that fails verification | `401` `unauthorized`, `next_code` `invalid_credential` | `401` `invalid_credential` |
| Inboxes | A status with no code of its own, such as a body that isn't valid UTF-8 | `error`, `next_code` the code that status has elsewhere | that status's code, such as `400` `bad_request` |
| Inboxes | A credential limited to certain projects | `403` `forbidden`, `details.reason` `project` | `403` `forbidden`, `details.reason` `project_confined` |
| Inboxes | `quota_exceeded`, the read API's `not_entitled` and the per-inbox `rate_limited` | `details` also carried `max_inboxes`, `max_http_bins`, `monthly_messages`, `plan` or `inbox_id` | `details` carries only the keys [What `details` carries](#details) lists |
| Webhooks | Every `500` | `internal`, `next_code` `internal_error` | `internal_error` |
| Webhooks | A field the API checks itself (an endpoint `url` that isn't https, an unknown `status` filter or operational event type, a usage window that doesn't parse or doesn't end after it starts) | `422` `unprocessable`, `next_code` `validation_error` | `422` `validation_error` |
| Webhooks | The endpoint limit (`POST /v1/endpoints`) | `402` `plan_violation`, `next_code` `quota_exceeded` | `402` `quota_exceeded`, `details.reason` `allocation` |
| Webhooks | `max_attempts` above the plan's ceiling (`POST /v1/endpoints`, `PATCH /v1/endpoints/{id}`) | `402` `plan_violation`, `next_code` `validation_error` | `422` `validation_error`, entry type `webhooks.max_attempts_above_plan` |
| Webhooks | A RabbitMQ source below Pro | `402` `plan_violation`, `next_code` `not_entitled` | `402` `not_entitled`, `details.feature` `rabbitmq_sources` |
| Webhooks | Turning endpoint verification off on a plan that requires it (`PATCH /v1/workspace`); no plan does today | `402` `plan_violation`, `next_code` `not_entitled` | `402` `not_entitled`, `details.feature` `optional_endpoint_verification` |
| Webhooks | A bulk replay whose `from` is after its `to` (`POST /v1/deliveries/replay`) | `409` `conflict`, `details.reason` `replay_window_inverted` | `422` `validation_error`, entry type `webhooks.end_before_start` on `["body", "to"]` |
| Webhooks | Webhooks' own rules on custom headers, `retry_schedule`, broker fields and plan names | entry type `value_error` | the rule's own entry type ([Request validation](#codes-validation)); `loc`, `msg` and `params` unchanged |
| Webhooks | Any validation error | `details`: a list of entries | `details`: `{"errors": [...]}`, as on Inboxes |

A handler that switched on `error.next_code ?? error.code` gets the same code as before in every situation above but the bulk replay. One that read `error.details` as a list on a Webhooks validation error reads `error.details.errors` now; one that read the removed Inboxes `quota_exceeded` keys reads `metric`, `limit`, `current` and `period`; one that matched the Inboxes `forbidden` reason `project` matches `project_confined`; and one that matched a Webhooks entry `type` `value_error` matches the rule's own type.

`unauthorized` isn't retired: it stays the code for a missing or revoked credential on both APIs, for a sign-in session that has ended on Inboxes, and for an inbound event whose signature doesn't verify on Webhooks.

## Codes this page used to list {#earlier-versions}

Earlier versions of this page listed the codes and fields on the left. The APIs didn't send them; they send what's on the right. Two of them have since come true, `request_id` in error bodies and `internal_error` on every API, and their rows say how.

| Earlier versions listed | The APIs send |
|---|---|
| `validation_failed` (400) | `validation_error` (422) |
| `fields` | `details`: `{"errors": [...]}` on both APIs |
| `request_id` in every body | Not sent while those versions were current: the id was in the `X-Request-ID` response header only. Since the updates noted at the top of this page, every error body the APIs send carries it too, as `error.request_id`, with the same value as the header ([The request id](#request-id)). |
| `malformed_json` (400), `unsupported_content_type` (415) | `validation_error` (422) |
| `request_too_large` | `payload_too_large` (413) |
| `no_credentials` (401) | `unauthorized` (401) |
| `invalid_credentials`, `expired_credentials` (401) | `invalid_credential`: a `403` on Webhooks, a `401` on Inboxes. A sign-in session that has expired is `unauthorized` (401) on Inboxes |
| `scope_required`, `wrong_project` (403) | `forbidden` (403); `details.reason` says why (`scope`, `project`, `project_confined`, …), and `details.required` names a missing scope |
| `already_exists`, `state_conflict`, `not_empty`, `idempotency_key_reused` (409) | `conflict` (409); `details.reason` says which (`event_type_exists`, `project_not_empty`, `idempotency_key_reuse`, …) |
| `rate_limit_exceeded` | `rate_limited` (429) |
| `quota_exceeded` as a 429 | `quota_exceeded` as a 402 |
| `internal_error` on every API | `internal_error` on both APIs since 2026-10-15; Webhooks sent `internal` before |
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
    case 'invalid_credential': // All: a key the API can't accept (403 on Webhooks, 401 on Inboxes and Request Bins)
    case 'unauthorized': // All: no usable credential
      // The credential is missing or bad: replace it rather than retry with it
      throw new CredentialError(error, requestId)
    case 'forbidden': {
      // Optional refinement: why it was refused, and what would have been allowed
      const reason = error.details?.reason // 'scope', 'role', 'project', 'project_confined', 'csrf', …
      const required = error.details?.required // 'admin', 'member', 'read' or 'publish', when sent
      throw new PermissionError(error, requestId, reason, required)
    }
    case 'validation_error': { // All
      const entries = error.details?.errors ?? []
      throw new ValidationError(entries, requestId)
    }
    case 'quota_exceeded':
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

Every response an API sends carries an `X-Request-ID` header, errors included, and the APIs let browser JavaScript read it. Their error bodies carry the same id as `error.request_id`. When something's wrong on our side (5xx, unexpected behavior), the request id is what lets us find the call in our logs. Log it next to each error and include it in support tickets.

Don't share request ids publicly (they're not secret, but they let anyone who has them ask us about your account's traffic). Use them in private channels (support, dashboard tickets).

## What's next {#next-steps}

- [Conventions](/docs/conventions) — the rest of the request/response shape.
- [Authentication](/docs/authentication) — the auth-error codes in context.
- [Rate limiting](/docs/rate-limiting) — the `Retry-After` mechanics in detail.
- [Idempotency](/docs/idempotency) — safe-retry pattern for 5xx + 429 cases.
- [Versioning](/docs/versioning) — what counts as a breaking change, and the 12-month deprecation period a code rename also gets.
