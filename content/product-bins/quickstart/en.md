---
title: Request Bins quickstart
description: Create a bin, send it a request with curl, and read what it recorded — in the console, then over the API.
publishedAt: 2026-10-22
updatedAt: 2026-10-26
kind: quickstart
---

# Request Bins quickstart

From nothing to a recorded request in a couple of minutes. You will create a bin, send it a request with `curl`, and read back exactly what arrived: first in the console, then over the API.

## Before you start {#before}

- **In the console, on any plan.** Open `https://bins.nimbusnexus.net` and sign in with your NimbusNexus account. Steps 1 to 3 need nothing else, on Free too.
- **Over the API, with a key.** Step 4 needs an API key created in your [account console]({{ACCOUNT_BASE_URL}}/api-keys?product=bins) with **Request Bins** as the product and **Read & write** as its permission. A key can create bins on any plan; reading what they recorded with a key needs Starter or above, and on Free those routes answer `402` `not_entitled`.

## 1. Create a bin {#create}

In the console, choose **Create a bin** (**New bin** once you have one). The label is optional and senders never see it. On a paid plan you can also pick a lifetime, which can't be changed later. Choose **Create bin**.

The bin's page opens. At the top are its **Bin URL**, such as `https://nnbin.net/b/k7xq2mbn9tfa`, and a **Try it** command, each with a copy button.

## 2. Send it a request {#send}

From any terminal, send the bin a `POST` with a path and a query after the slug. Use your own bin URL:

```bash
curl -X POST "https://nnbin.net/b/k7xq2mbn9tfa/orders?source=quickstart" \
  -H "Content-Type: application/json" \
  -d '{"order_id": 1042, "status": "paid"}'
```

```json
{"status":"accepted"}
```

That answer is the same for every request to a bin URL, recorded or not, so it tells a sender nothing about your bin. What arrived is what the console shows.

Any method, path, header or body works. In real use, put the bin URL wherever an app, a provider's webhook settings, a script or a CI job expects a URL, and let it send.

## 3. See it in the console {#console}

Back on the bin's page, the request is at the top of the list within a few seconds; the list refreshes every 3 seconds. Select it to see:

- the method and the path after the slug: `POST /orders`;
- the query, decoded: `source=quickstart`;
- the headers, in the order they arrived;
- the body, formatted as JSON, with the raw text one click away;
- the address it came from, its size and when it arrived.

On Free, this is the whole flow: the console reads what bins recorded on every plan.

## 4. Do the same over the API {#api}

Put your key in an environment variable:

```bash
export BINS_API_KEY="<your-api-key>"
```

Every path below is relative to `https://bins.nimbusnexus.net`, and every request carries `Authorization: Bearer <your key>`. First, create a bin:

```bash
curl -X POST https://bins.nimbusnexus.net/v1/bins \
  -H "Authorization: Bearer $BINS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"label": "Quickstart"}'
```

```json
{
  "id": "bin_3f9a1c7e5b2d8f4a6c0e9b17",
  "slug": "w4tz8hcv2qnd",
  "url": "https://nnbin.net/b/w4tz8hcv2qnd",
  "label": "Quickstart",
  "status": "active",
  "expires_at": null,
  "created_at": "2026-10-22T09:12:01Z",
  "request_count": 0
}
```

The answer is trimmed here; [the bin object](/docs/product-bins/reference#bin) lists every field. Two matter now:

- **`url`** is what you give a sender.
- **`id`** is what every later call takes. Keep it.

`expires_at` is `null` because on a paid plan a bin lives until you delete it; on Free it is 24 hours after `created_at`. Free allows one bin at a time, so there this call answers `402` `quota_exceeded` while the bin from step 1 exists. Find that one by its URL instead, with `GET /v1/bins?url=https://nnbin.net/b/k7xq2mbn9tfa`.

Send the new bin the request from step 2, with its own URL, then list what it recorded:

```bash
curl https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17/requests \
  -H "Authorization: Bearer $BINS_API_KEY"
```

```json
{
  "items": [
    {
      "id": "req_8d2e6b1f4a9c3e7d5b0f2a61",
      "bin_id": "bin_3f9a1c7e5b2d8f4a6c0e9b17",
      "method": "POST",
      "path": "/orders",
      "query": "source=quickstart",
      "source_ip": "203.0.113.24",
      "content_type": "application/json",
      "size_bytes": 36,
      "truncated": false,
      "seen_count": 1,
      "received_at": "2026-10-22T09:12:04Z",
      "expires_at": "2026-10-29T09:12:04Z"
    }
  ],
  "next_offset": null
}
```

The newest request comes first. Its `expires_at` is when it will be deleted: here 7 days on, Starter's retention.

To read one request in full, with its query, headers and body:

```bash
curl https://bins.nimbusnexus.net/v1/requests/req_8d2e6b1f4a9c3e7d5b0f2a61 \
  -H "Authorization: Bearer $BINS_API_KEY"
```

```json
{
  "id": "req_8d2e6b1f4a9c3e7d5b0f2a61",
  "method": "POST",
  "path": "/orders",
  "query": "source=quickstart",
  "headers": [
    {"name": "user-agent", "value": "curl/8.7.1"},
    {"name": "accept", "value": "*/*"},
    {"name": "content-type", "value": "application/json"},
    {"name": "content-length", "value": "36"}
  ],
  "body_base64": "eyJvcmRlcl9pZCI6IDEwNDIsICJzdGF0dXMiOiAicGFpZCJ9",
  "size_bytes": 36,
  "truncated": false,
  "request_id": "4b8f2c1d9e7a46b3a0c5d8e2f1a7b9c3"
}
```

This one is trimmed too: the full answer carries every field of the list item, and the real header list also holds the headers added by the proxies in front of `nnbin.net`, such as `x-forwarded-for`. The body is base64 because a body need not be text. To print it:

```bash
curl -s https://bins.nimbusnexus.net/v1/requests/req_8d2e6b1f4a9c3e7d5b0f2a61 \
  -H "Authorization: Bearer $BINS_API_KEY" | jq -r .body_base64 | base64 --decode
```

```text
{"order_id": 1042, "status": "paid"}
```

## Polling, not pushing {#polling}

There is no stream and no callback. To wait for a request, poll the list with `since` set to the newest `received_at` you have seen; it returns only requests received after that instant:

```bash
curl -G https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17/requests \
  --data-urlencode "since=2026-10-22T09:12:04Z" \
  -H "Authorization: Bearer $BINS_API_KEY"
```

`-G` with `--data-urlencode` puts `since` in the query string encoded, so an offset such as `+00:00` survives the trip. A request sent again is a new row of its own, so it comes back in this list too, with its own `id` and `received_at`.

Don't poll a fixed number of times and assert on the last answer. Assert that the request *appears*, with a timeout, or a slow sender will look like one that never sent.

## Cleaning up {#cleanup}

A paid bin lives until you delete it, unless you created it with `expires_in_minutes`, and every plan caps how many bins you may hold at once, so delete it when you are done:

```bash
curl -X DELETE https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17 \
  -H "Authorization: Bearer $BINS_API_KEY"
```

Deleting is **permanent**: the URL stops recording at once, what the bin recorded is deleted, and its slug is never issued again, to you or anyone. Senders still get `200` from it. To stop recording for a while instead, `PATCH` the bin to `{"status": "disabled"}`, and back to `{"status": "active"}` later. To keep the bin and clear what it holds, empty it with `DELETE /v1/bins/{id}/requests`. On Free, a bin expires 24 hours after it is created, which ends it the same way as deleting.

## What's next {#next-steps}

- [Product overview](/docs/product-bins) — plans and limits, suspended bins, and what Request Bins does not do.
- [Forwarding](/docs/product-bins/forwarding) — send each request on to your own server as well, on a paid plan.
- [Request Bins reference](/docs/product-bins/reference) — every route and field, what a bin URL answers, roles and scopes.
- [Request Bins API](/docs/reference/bins) — every operation, with the request in curl, TypeScript, Python or Go.
