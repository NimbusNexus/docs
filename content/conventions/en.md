---
title: Conventions
description: Patterns the API follows everywhere — resource ids, pagination, errors, idempotency, long-running operations.
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: concept
---

# Conventions

The API has one shape, repeated across every resource. Once you know the shape, you know every endpoint — the only thing that changes from one resource to the next is the field set on the resource itself.

## Resource ids {#resource-ids}

Every resource has a stable opaque id, in the form `<prefix>_<26-char-base32>`:

| Resource         | Prefix  | Example                           |
| ---------------- | ------- | --------------------------------- |
| Virtual machine  | `vm_`   | `vm_01H8FZQ4XW9KMP4XQNR3VT7DC2`   |
| Managed database | `db_`   | `db_01H8FZQ4XW9KMP4XQNR3VT7DC2`   |
| Block volume     | `vol_`  | `vol_01H8FZQ4XW9KMP4XQNR3VT7DC2`  |
| Snapshot         | `snap_` | `snap_01H8FZQ4XW9KMP4XQNR3VT7DC2` |
| API key          | `key_`  | `key_01H8FZQ4XW9KMP4XQNR3VT7DC2`  |

Ids are stable for the life of the resource — never reused, never rewritten on rename. Use them in URLs, foreign keys, and audit logs; use human-readable `name` fields only for display.

## Pagination {#pagination}

List endpoints accept two query parameters:

- `limit` — page size. Default 50, max 200. Past 200 the server returns 400.
- `cursor` — opaque next-page pointer. The response body returns it as `pagination.next_cursor` when there are more pages; pass it back as `cursor` to advance.

Cursors are opaque — don't try to decode or construct them. They include sort + filter state from the original request, so changing filters mid-pagination produces undefined behavior. Start fresh (no `cursor`) when your filters change.

The pattern in code:

```bash
# Page 1
curl '{{API_BASE_URL}}/v1/vms?limit=50' \
  -H "Authorization: Bearer $NIMBUS_KEY"

# Page 2 (cursor from page 1's response.pagination.next_cursor)
curl '{{API_BASE_URL}}/v1/vms?limit=50&cursor=eyJpZCI6...' \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

When `pagination.next_cursor` is absent or null, you're on the last page.

## Errors {#errors}

Every error response uses the same JSON shape:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "size must be one of the published VM sizes",
    "fields": {
      "size": "unknown size 'gp-7-7'"
    },
    "request_id": "req_01H8FZ..."
  }
}
```

- `code` — stable machine-readable string. Switch on this, not on the status code, when the same status has multiple meanings (e.g. `409` can be `already_exists` or `state_conflict`).
- `message` — human-readable for logs. Not localized; pull text from the dictionary if you're rendering it to end users.
- `fields` — present on `400 validation_failed`. Keyed by the request field that failed.
- `request_id` — always present. Include it when contacting support.

## HTTP status codes {#status-codes}

We use a small, predictable set:

| Status    | When                                                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `200`     | Success with body.                                                                                                                  |
| `201`     | Resource created. `Location` header points at the new resource.                                                                     |
| `202`     | Operation accepted; check `operation.status` to track progress.                                                                     |
| `204`     | Success, no body (typical for DELETE).                                                                                              |
| `400`     | Validation failed. `error.fields` has per-field details.                                                                            |
| `401`     | Authentication failed. See [Authentication](/docs/authentication).                                                                  |
| `403`     | Authenticated but not authorized (scope missing, wrong project, etc.).                                                              |
| `404`     | Resource doesn't exist, OR the caller can't see it. We deliberately don't distinguish — leaking existence is itself an access leak. |
| `409`     | State conflict (resource is mid-operation, name already taken, can't delete a non-empty bucket, etc.).                              |
| `422`     | Request shape is JSON-valid but semantically wrong in a way that's not a single-field validation issue.                             |
| `429`     | Rate limit exceeded. `Retry-After` header tells you when to retry.                                                                  |
| `500–504` | Server-side problem. Always safe to retry idempotent requests.                                                                      |

## Idempotency {#idempotency}

Mutating endpoints (POST, PUT, PATCH, DELETE) accept an optional `Idempotency-Key` header. Pass any unique value (a UUID is conventional); we cache the response for 24 hours and return the same response on a repeat with the same key.

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web", "size": "gp-2-4", "region": "us-east-1", "image": "ubuntu-24.04" }'
```

Use idempotency keys when your client might retry a request after a network failure but can't tell whether the original succeeded. The default-no-key behavior is "best effort retry"; with a key, retries are safe.

GET endpoints are always idempotent and don't need the header.

## Long-running operations {#operations}

Some actions don't complete during the request lifecycle:

- VM `POST` returns `202` while the hypervisor allocates the instance.
- Database `POST` returns `202` while replicas come up.
- Volume resize and VM migration return `202`.

The response body for any 202 includes an `operation` object:

```json
{
  "id": "vm_01H8FZQ4XW9KMP4XQNR3VT7DC2",
  "state": "provisioning",
  "operation": {
    "id": "op_01H8FZ...",
    "kind": "vm_create",
    "status": "running",
    "progress": 0.4,
    "started_at": "2026-05-19T18:30:00Z"
  }
}
```

Two ways to track progress:

1. **Poll** — `GET /v1/operations/{op_id}` once a second. Cheap; counts as a regular API call against rate limits.
2. **Webhook** — subscribe a callback URL in the dashboard. We POST when the operation reaches a terminal state (`succeeded` or `failed`).

Most operations finish in under 60 seconds. The exception is VM image pulls on first use (~90 seconds) and Kafka cluster setup (~180 seconds).

## Timestamps {#timestamps}

All timestamps are **RFC 3339 / ISO 8601 in UTC** with the `Z` suffix:

```text
2026-05-19T18:30:00Z
```

Never local time, never with an offset, never an integer epoch (except in webhook signature headers, which carry a Unix timestamp because that's the convention HMAC signers use). `Date.parse()` in JavaScript and equivalent stdlib parsers in other languages handle this format natively.

## What's next {#next-steps}

- [Authentication](/docs/authentication) covers the auth header shape and scope model.
- The reference pages — [VMs](/docs/api/vms), [Managed databases](/docs/api/managed-databases), [Block storage](/docs/api/block-storage), [Object storage](/docs/api/object-storage), [Regions](/docs/api/regions) — show the conventions in action.
