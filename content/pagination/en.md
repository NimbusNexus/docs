---
title: Pagination
description: How each API pages its lists, with limit and offset or marker, and how to know you've reached the end.
publishedAt: 2026-05-20
updatedAt: 2026-11-11
kind: concept
---

# Pagination

NimbusNexus has two kinds of API, and they page lists differently. The app APIs page with `limit` and `offset`. On the infrastructure API, most lists answer with everything at once, and a few take `limit` with `marker` or `offset`.

## The app APIs {#shape}

Most lists on Webhooks, Inboxes, Request Bins and Transforms take two query parameters:

- `limit` — page size. Default 50, max 200. Past 200 the request fails validation: `422` `validation_error` ([Errors](/docs/errors#codes-validation)).
- `offset` — how many items to skip. Default 0, max 10,000.

Each list answers with its items and the next offset:

```json
{
  "items": [],
  "next_offset": 50
}
```

Pass `next_offset` back as `offset` for the next page. When it's `null`, you're on the last page.

An offset counts positions, so an item created or deleted while you walk a list can make you see another item twice, or miss one. If that matters, compare ids. Keep the same filters for the whole walk, and start again from offset 0 when you change them.

Three cases differ:

- **Searches** on Inboxes and Request Bins page with `next_until` instead: see [Searching messages](/docs/product-inboxes#search) and [Captured requests](/docs/product-bins/reference#requests).
- **QR Codes** answers most lists in one response. A code's scans (`GET /v1/qr-tracked/codes/{code_id}/scans`) take `limit` alone, and a webhook's deliveries (`GET /v1/qr-tracked/webhooks/{webhook_id}/deliveries`) page with `limit` and `cursor`, with the next cursor in `nextCursor`.
- **The templates list** on Transforms (`GET /v1/pipelines/templates`) answers every template as one plain array, with no `limit` or `offset`.

## The infrastructure API {#infrastructure}

Most lists, such as `GET /api/v1/instance/`, answer with the whole list and take no paging parameters. The ones that page do it one of two ways.

### `limit` and `marker` {#marker}

`marker` is the last item you've seen: its id or, on object storage, its name. The answer starts after it.

- VM images: `GET /api/v1/image/`.
- DNS: `GET /api/v1/zones/`, `GET /api/v1/recordsets/`, `GET /api/v1/zones/{zone_id}/recordsets/`, `GET /api/v1/zones/{zone_id}/ptr/` and `GET /api/v1/zones/{zone_id}/shares/`.
- Object storage: `GET /api/v1/object_storage/` for containers and `GET /api/v1/object_storage/{container_name}/objects` for objects. On objects, `full_listing=true` returns them all in one response.

These answers hold only `data`, with nothing to say whether more remain. Keep going until a page comes back shorter than your `limit`.

### `limit` and `offset` {#offset}

`offset` is how many items to skip.

- Volume backups: `GET /api/v1/backup_restore/volume_backups/`, with a default `limit` of 10.
- Backup schedules: `GET /api/v1/backup_restore/backup_scheduler/list` and `GET /api/v1/backup_restore/volume_scheduler/list`.
- External storage connections: `GET /api/v1/external/connections/`.
- Notifications: `GET /api/v1/notifications/list`, with a default `limit` of 50 and a maximum of 200.

These answers also carry `total`, the number of items across all pages, so you've reached the end when you've read that many.

## Walking pages {#walking}

On an app API, follow `next_offset`:

```ts
async function listAllEndpoints() {
  const all = []
  let offset = 0

  while (offset !== null) {
    const url = new URL('{{WEBHOOKS_BASE_URL}}/v1/endpoints')
    url.searchParams.set('limit', '200')
    url.searchParams.set('offset', String(offset))

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.WEBHOOKS_API_KEY}` },
    })
    const page = await res.json()

    all.push(...page.items)
    offset = page.next_offset
  }

  return all
}
```

On the infrastructure API, follow the last id until a short page:

```ts
async function listAllZones() {
  const all = []
  const limit = 100
  let marker

  while (true) {
    const url = new URL('{{API_BASE_URL}}/api/v1/zones/')
    url.searchParams.set('limit', String(limit))
    if (marker) url.searchParams.set('marker', marker)

    const res = await fetch(url, {
      headers: { 'X-API-Key': process.env.NIMBUS_KEY },
    })
    const { data } = await res.json()

    all.push(...data)
    if (data.length < limit) return all
    marker = data.at(-1).id
  }
}
```

Each page is a request, and it counts toward the [rate limit](/docs/rate-limiting).

## Sort order {#sort}

Lists that sort name their parameters on their reference pages. On the infrastructure API, those are `sort_by` and `sort_desc` on the `offset` lists that sort, and `sort_key` and `sort_dir` on VM images and DNS record sets. Keep the same sort for the whole walk.

## What's next {#next-steps}

- [Conventions](/docs/conventions) — the rest of the request shape: ids, status codes, errors.
- [Rate limiting](/docs/rate-limiting) — how many requests a walk can make.
- [Errors](/docs/errors) — what a refused request answers.
