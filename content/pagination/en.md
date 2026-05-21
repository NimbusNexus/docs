---
title: Pagination
description: Cursor pagination on every list endpoint. Stable across inserts, no offset drift.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: concept
---

# Pagination

List endpoints (`GET /v1/vms`, `GET /v1/snapshots`, etc.) page using opaque cursors, not numeric offsets. Cursor pagination is the right default for resource lists that change while you're paginating — it returns each item exactly once even if rows get inserted or deleted between page fetches.

## The shape {#shape}

Two query parameters on every list endpoint:

- `limit` — page size. Default 50, max 200. Past 200 returns `400 validation_failed`.
- `cursor` — opaque pointer to the next page. Omit on the first request.

Every list response includes:

```json
{
  "items": [ /* ... */ ],
  "pagination": {
    "next_cursor": "eyJpZCI6InZtXzAxSEc3Li4uIn0=",
    "total_count": null
  }
}
```

When `next_cursor` is `null`, you've reached the last page.

## Walking pages {#walking}

```ts
async function listAllVms(): Promise<VM[]> {
  const all: VM[] = []
  let cursor: string | undefined

  do {
    const url = new URL('{{API_BASE_URL}}/v1/vms')
    url.searchParams.set('limit', '200')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url, { headers: auth })
    const { items, pagination } = await res.json()

    all.push(...items)
    cursor = pagination.next_cursor ?? undefined
  } while (cursor)

  return all
}
```

Three rules:

1. **Cursors are opaque.** Don't try to parse them, don't try to construct them. They encode sort + filter state from your original request, so a cursor from one query doesn't work in another.
2. **Don't change filters mid-pagination.** If you start with `?status=running` and then add `?region=us-east-1` for page 2, you get undefined behavior. Start fresh (no cursor) when filters change.
3. **Stop when `next_cursor` is null.** Don't try to keep paginating "just in case" — the cursor is the only authoritative end-of-list signal.

## Why cursors and not `?page=2&per_page=50` {#why-cursors}

Offset pagination breaks in two real-world scenarios:

**Inserts during pagination.** If you fetch page 1 (items 1–50), then someone creates a new VM, then you fetch page 2 (items 51–100), you'll see item 50 twice (it's now at position 51) and you'll never see the new item. Cursors capture "where you were" — the next page starts after where you actually were, not at an absolute offset.

**Deletes during pagination.** Same problem in reverse: if a VM gets deleted between page fetches, an offset-paginated client skips one item. Cursor-paginated clients don't.

These edge cases matter at any non-trivial scale. We default to cursor pagination so they don't bite you.

## `total_count` {#total-count}

The `total_count` field in `pagination` is **null on most endpoints**, by design. Counting all items in a paginated list is an expensive query that gets less useful as N grows ("you have 14,328 VMs across all your projects" — what do you do with that?). When `total_count` is present, the endpoint's reference page documents it; when it's absent, don't depend on it.

If you really need an exact count, paginate to the end and count what you got.

## Sort order {#sort}

List endpoints have a default sort (usually `created_at desc`, newest first) documented per-endpoint. Some endpoints accept `?sort=` to override; the reference page lists what's accepted.

The cursor encodes the sort, so changing `?sort=` between page fetches is one of the "undefined behavior" cases — start fresh when you change it.

## Filters {#filters}

Every list endpoint accepts a few standard filter parameters:

- `created_after` / `created_before` — RFC 3339 timestamps
- `updated_after` / `updated_before` — RFC 3339 timestamps
- Resource-specific filters (e.g. `?region=us-east-1&state=running` on VMs)

Filters compose; the response is the AND of every filter. The resource's reference page documents which filters it accepts.

## When you actually want all the items {#listing}

Calling list-with-pagination in a tight loop to enumerate every resource is fine for ad-hoc work but expensive for repeated daemons. Two better patterns:

1. **Webhooks.** Subscribe to `resource.created` / `resource.deleted` events and maintain your own index. See [Webhooks](/docs/webhooks).
2. **Bulk export endpoints.** For some resources (snapshots, backups, audit logs), there's a dedicated export endpoint that streams the full set in one response. The resource reference page documents these where they exist.

The pagination pattern is for interactive use (a dashboard table, a CLI list command). For continuous sync, the cost of pagination dominates and webhooks are the right answer.

## What's next {#next-steps}

- [Conventions](/docs/conventions) — the rest of the request shape (status codes, errors, idempotency).
- [Webhooks](/docs/webhooks) — push-based alternative for continuous sync.
- Any list endpoint's reference page — endpoint-specific filters and sort options.
