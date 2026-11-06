---
title: Conventions
description: Patterns the APIs follow — resource ids, pagination, errors, idempotency, long-running operations.
publishedAt: 2026-05-19
updatedAt: 2026-11-06
kind: concept
---

# Conventions

NimbusNexus has two kinds of API, and they don't share every convention. The **infrastructure API** at `{{API_HOST}}` (VMs, networks, storage, DNS and your account) has its routes under `/api/v1/` and takes an API key in the `X-API-Key` header ([Authentication](/docs/authentication)). The **app APIs** (Webhooks, Inboxes, Request Bins and the others) each have their own base URL, with routes under `/v1/`, and take a key as a bearer token ([Set up the REST API](/docs/setup/rest)). This page says where the two differ.

## Resource ids {#resource-ids}

On the infrastructure API, most resource ids are UUIDs, such as `3f0c9e1a-6b7d-4c2e-9a51-7d2b8f4e1c60`; object-storage containers and objects go by name. On the app APIs, ids carry a prefix, such as `ep_` for a Webhooks endpoint or `evt_` for an event. Treat any id as an opaque string.

Ids are stable for the life of the resource — never reused, never rewritten on rename. Use them in URLs, foreign keys, and audit logs; use human-readable `name` fields only for display.

## Pagination {#pagination}

On Webhooks, Inboxes, Request Bins and Transforms, list endpoints accept two query parameters:

- `limit` — page size. Default 50, max 200. Past 200 the request fails validation: `422` `validation_error` ([Errors](/docs/errors#codes-validation)).
- `offset` — how many items to skip. The response body returns the next value as `next_offset`; pass it back as `offset` to advance.

The pattern in code:

```bash
# Page 1
curl '{{WEBHOOKS_BASE_URL}}/v1/endpoints?limit=50' \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY"

# Page 2 (offset from page 1's response.next_offset)
curl '{{WEBHOOKS_BASE_URL}}/v1/endpoints?limit=50&offset=50' \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY"
```

When `next_offset` is null, you're on the last page.

On the infrastructure API, most list endpoints, such as `GET /api/v1/instance/`, answer with the whole list and take no paging parameters. The ones that page do it one of two ways:

- `limit` and `marker` (the last id or name you've seen): VM images, DNS zones and record sets, object-storage containers and objects.
- `limit` and `offset`: volume backups, backup schedules, external storage connections, notifications.

```bash
# Page 1
curl '{{API_BASE_URL}}/api/v1/zones/?limit=50' \
  -H "X-API-Key: $NIMBUS_KEY"

# Page 2 (marker: the id of the last zone on page 1)
curl '{{API_BASE_URL}}/api/v1/zones/?limit=50&marker=<zone-id>' \
  -H "X-API-Key: $NIMBUS_KEY"
```

## Errors {#errors}

The two kinds of API answer errors differently. On the infrastructure API, an error carries `success: false` and a `message`:

```json
{
  "success": false,
  "message": "Authentication required"
}
```

A validation failure (`422`) carries `errors` instead, with the failing fields:

```json
{
  "success": false,
  "errors": {
    "field": ["Invalid value"]
  }
}
```

There are no error codes here: branch on the status, and don't parse `message`. Every response carries an `X-Request-ID` header; include it when contacting support.

Every error response from Webhooks, Inboxes, Request Bins and Transforms uses this JSON shape:

```json
{
  "error": {
    "code": "validation_error",
    "message": "request validation failed",
    "details": {
      "errors": [
        {
          "loc": ["body", "event_type"],
          "msg": "Field required",
          "type": "missing"
        }
      ]
    },
    "request_id": "7e4b1d9c2a6f4e8b9d3c5a1f0e2b4c68"
  }
}
```

- `code` — stable machine-readable string. Switch on this, not on the status code, when the same status has multiple meanings (e.g. `402` can be `quota_exceeded`, `not_entitled` or `workspace_frozen`).
- `message` — human-readable English for logs. Not localized; if you show an error to end users, map `code` to your own text.
- `details` — present on some codes. On a validation error, `details.errors` lists the failing inputs; on many other errors it carries a `reason` that refines the code, with the values that go with it. Its shape depends on the code.
- `request_id` — on every error body the API sends: the same id as the `X-Request-ID` header every response from the API carries. A response from the edge in front of it (a `502` or `504`, for example, or a `413` for a body too large to reach the API) carries neither the API's error body nor the `X-Request-ID` header ([Errors](/docs/errors#request-id)). Log it, and include it when contacting support.
- `next_code` — sent only while a code is being renamed: the code this error will carry afterwards. When it's present, switch on it instead of `code`. No code is being renamed today, so the API doesn't send it.

[Errors](/docs/errors) lists every code and reason, and which of the Webhooks and Inboxes APIs sends each. (Earlier versions of this page showed `validation_failed` as a `400`, with `fields` and `request_id` in the body. The APIs have never sent the first two: a validation failure is a `422` `validation_error`, with `details`. `request_id` was not in the body then either; the API's error bodies carry it now.)

## HTTP status codes {#status-codes}

We use a small, predictable set:

| Status    | When                                                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `200`     | Success with body. On the infrastructure API, also a request whose work is queued ([Long-running operations](#operations)).         |
| `201`     | Resource created.                                                                                                                   |
| `202`     | Accepted: the work finishes after the answer ([Long-running operations](#operations)).                                              |
| `204`     | Success, no body (typical for DELETE).                                                                                              |
| `400`     | The request couldn't be read as sent. `error.message`, or `message` on the infrastructure API, says why.                            |
| `401`     | No usable credential. See [Authentication](/docs/authentication).                                                                   |
| `402`     | On the app APIs: your plan or billing state stops the request (a quota, a feature not in your plan, a frozen workspace). Retrying won't help. |
| `403`     | Authenticated but not authorized (scope missing, wrong project, etc.). On Webhooks, also a credential it doesn't accept. On the infrastructure API, also a call outside an API key's access rules. |
| `404`     | Resource doesn't exist, OR the caller can't see it. We deliberately don't distinguish — leaking existence is itself an access leak. |
| `409`     | State conflict (name already taken, an `Idempotency-Key` reused with a different body, etc.).                                       |
| `413`     | The body is over the size limit.                                                                                                    |
| `422`     | Validation failed. On a validation error (`validation_error`), `error.details.errors` lists the failing inputs; on the Webhooks API's other `422` codes, such as `invalid_payload` or `unknown_event_type`, it is an object naming the value or rule at fault. On the infrastructure API, `errors` holds the failing fields. |
| `429`     | Rate limited. When `Retry-After` is set, it tells you when to retry.                                                                |
| `500–504` | Server-side problem. Always safe to retry idempotent requests.                                                                      |

## Idempotency {#idempotency}

A few routes take an `Idempotency-Key` header, so that a retry doesn't do the work twice. On Webhooks, that's publishing an event. Pass any unique value (a UUID is conventional):

```bash
curl -X POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "event_type": "order.created", "payload": { "order_id": "1234" } }'
```

Every other route ignores the header. On the infrastructure API, creating a VM twice makes two VMs, with or without a key. [Idempotency](/docs/idempotency) lists the routes that take it, and what to do on the others.

GET endpoints are always idempotent and don't need the header.

## Long-running operations {#operations}

Some actions don't finish during the request. On the infrastructure API, they answer as soon as the work is queued:

- `POST /api/v1/instance/` (create a VM) answers `200` with `{"success": true}` and no id.
- `POST /api/v1/storage/` (create a volume) answers `201` with no id.
- `POST /api/v1/instance/{instance_id}/resize` answers `200`, and the VM moves on to `VERIFY_RESIZE`.
- `PUT` and `DELETE` on a DNS record set answer `202`.

There's no operation object to follow. To track the work, read the resource and watch its `status`: `GET /api/v1/instance/` shows a new VM in `BUILD`, then `ACTIVE` or `ERROR`. A poll counts as a regular API call against rate limits.

## Timestamps {#timestamps}

All timestamps are **RFC 3339 / ISO 8601 in UTC** with the `Z` suffix:

```text
2026-05-19T18:30:00Z
```

Never local time, never with an offset, never an integer epoch (except in webhook signature headers, which carry a Unix timestamp because that's the convention HMAC signers use). `Date.parse()` in JavaScript and equivalent stdlib parsers in other languages handle this format natively.

## What's next {#next-steps}

- [Authentication](/docs/authentication) covers the auth header, and the roles and access rules that limit a key.
- The reference pages — [VMs](/docs/api/vms), [Block storage](/docs/api/block-storage), [Object storage](/docs/api/object-storage), [Regions](/docs/api/regions) — show the conventions in action.
