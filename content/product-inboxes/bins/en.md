---
title: Request bins
description: A disposable URL that records every HTTP request sent to it — how to create one, send to it, read what it captured, and why it always answers 200.
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: concept
---

# Request bins

A request bin is an inbox that receives HTTP instead of email. It has a URL; anything sent to that URL is recorded — method, path, query, headers and body — and shows up in the dashboard and the API within seconds. Use one to see exactly what your system sends: a payment event, a CI notification, any outgoing webhook or callback.

## Create a bin {#create}

In the dashboard, choose **New address / request bin** and pick **HTTP requests**. Over the API, allocate an inbox with `"transport": "http"`:

```bash
curl -X POST {{INBOXES_BASE_URL}}/v1/inboxes \
  -H "Authorization: Bearer $INBOXES_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"transport": "http", "label": "stripe test"}'
```

```json
{
  "id": "inb_8c1f0e2d9a7b6c5d4e3f2a1b",
  "address": "gs2wr5bjw9m5",
  "transport": "http",
  "bin_url": "https://<bin domain>/b/gs2wr5bjw9m5",
  "label": "stripe test",
  "status": "enabled",
  "phrase": "",
  "expires_at": null
}
```

Two fields matter:

- **`bin_url`** is what you paste into the system under test. Use it exactly as returned: bins live on their own domain, never under `{{ROOT_DOMAIN}}`, so a signed-in browser never sends your session cookie to a bin.
- **`id`** is what every other API call takes.

`address` holds the bin's **slug**, the last part of its URL. On its own it is not something you can send to; it is there so the bin can be looked up and recognised.

## Send it a request {#send}

Any method works — `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` and `OPTIONS` — and so does any path below the bin URL. A request to `<bin_url>/orders/42?retry=1` is recorded with path `/orders/42` and query `retry=1`.

```bash
BIN_URL="$(curl -s {{INBOXES_BASE_URL}}/v1/inboxes/inb_8c1f0e2d9a7b6c5d4e3f2a1b \
  -H "Authorization: Bearer $INBOXES_API_KEY" | jq -r .bin_url)"

curl -X POST "$BIN_URL" \
  -H "Content-Type: application/json" \
  -d '{"hello": "world"}'
```

```json
{ "status": "accepted" }
```

The dashboard shows the same `curl` for each bin, ready to copy.

## What it answers {#responses}

| Answer | When |
| --- | --- |
| `200 {"status": "accepted"}` | Always, unless one of the rows below applies — including when the bin is disabled, deleted, expired, suspended or over its allowance. |
| `429` with `Retry-After` | More than 120 requests a minute from one sender IP, or 600 a minute to one bin. |
| `503` with `Retry-After` | The service could not store the request just now. Nothing was kept, so the sender should retry. |
| `404` | The path is not a bin URL at all. |

**Why `200` even when nothing is stored.** Payment providers and most webhook senders disable an endpoint that answers `4xx` too often, and alert its owner. A bin that refused would take your real webhook configuration down with it. So a bin never tells the sender whether a request was kept, and never reveals whether a bin exists.

The bin's owner sees what happened instead. Requests dropped for being over the allowance are counted on the bin in the dashboard, and a disabled, suspended or deleted bin says so there.

## What is captured {#captured}

| Field | What it holds |
| --- | --- |
| `method`, `path`, `query` | As sent. `path` is relative to the bin URL. |
| `headers_raw` | Every request header. `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` and `X-API-Key` are stored as `[redacted]`; signature headers such as `Stripe-Signature` are kept, because verifying them is often why you are looking. |
| `body_base64`, `text_body` | The body, base64-encoded, and as text when it decodes as text. |
| `source_ip` | The sender's address. |
| `size_bytes`, `truncated` | Up to 1 MiB of body is read and the first 64 KiB is kept; a longer body is marked `truncated: true`. |
| `seen_count` | How many identical requests this row stands for. |

**Retries collapse into one row.** A request with the same method, path and body as one already in the bin bumps that row's `seen_count` instead of adding a new one, so a provider retrying eight times shows as one request marked ×8.

## Read it back {#read}

Captured requests are listed with the same route as mail:

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes/inb_8c1f0e2d9a7b6c5d4e3f2a1b/messages" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

```json
{
  "items": [
    {
      "id": "msg_3b7e91c04a2d58f6e1c0a9b2",
      "inbox_id": "inb_8c1f0e2d9a7b6c5d4e3f2a1b",
      "transport": "http",
      "method": "POST",
      "path": "/",
      "from_addr": "203.0.113.7",
      "seen_count": 1,
      "received_at": "2026-10-19T09:12:04Z"
    }
  ],
  "next_offset": null
}
```

Fetch one item, `GET /v1/inboxes/{id}/messages/{message_id}`, for the headers and body; every field is listed under [Messages in the API reference](/docs/reference/inboxes#ref-messages). Reading over the API needs a paid plan, as it does for mail; on free, read the bin in the dashboard. If you only have the bin URL, `GET /v1/inboxes?address=<bin URL>` returns the bin with its `id`.

## Limits {#limits}

A bin draws on the same monthly allowance as your email addresses, with two caps on top so that a leaked bin URL cannot use up the month:

| | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- |
| Bins at once | 1 | 5 | 25 | 250 |
| All bins together may use | 50% of the month | 80% | 80% | 80% |
| One bin may use | 50% of the month | 50% | 40% | 25% |
| Kept for | 1 day | 7 days | 30 days | 90 days |

Over a cap, requests are still answered `200` and are counted as refused on the bin.

A bin is **suspended** — it stops storing and says so in the dashboard — if it receives from far more distinct sender addresses than any webhook integration does, or receives browser form submissions. Both patterns mean the URL is being used to collect data from people rather than to test a sender. If it was you testing from a browser, contact support to have the suspension lifted.

## Disable, delete and expiry {#lifecycle}

- **Disable** stops storing and keeps what the bin already holds. Senders still get `200`.
- **Delete** removes the bin and everything in it, and retires its slug: no bin or address is ever issued with it again. Requests sent to it afterwards get `200` and are not stored.
- **Expiry** is the same as Delete, at `expires_at`. Free bins expire 24 hours after creation; paid bins only if you set `expires_in_minutes`.

## Where bins are not available {#availability}

A bin can only receive once the service has a public bin domain to give it. Where it has none yet, `GET /v1/plan` returns `"bins_available": false`, every bin's `bin_url` is empty, the dashboard does not offer bins, and an existing bin shows that it cannot receive requests yet. A bin made before the domain existed gets its URL automatically once it does.

## What's next {#next-steps}

- [Inboxes overview](/docs/product-inboxes) — email addresses and bins side by side, and every limit by plan.
- [Quickstart](/docs/product-inboxes/quickstart) — create, send and read with `curl`.
- [Addresses and the phrase](/docs/product-inboxes/addresses) — the email side: the subject gate, expiry and retention.
