---
title: Request Bins reference
description: Every route of the Request Bins API, what a bin URL answers and records, who may do what, and each plan's limits.
publishedAt: 2026-10-22
updatedAt: 2026-10-30
kind: reference
---

# Request Bins reference

Request Bins has two sides. **Bin URLs** on `nnbin.net` take requests from anyone and record them. **The API** at `https://bins.nimbusnexus.net/v1` creates and manages bins and reads what they recorded, for your workspace only. This page covers both, then who may do what and each plan's limits. The [overview](/docs/product-bins) explains the product, and the [quickstart](/docs/product-bins/quickstart) walks through it.

## Bin URLs {#edge}

| | |
| --- | --- |
| URL | `https://nnbin.net/b/<slug>`, and any path under it: `https://nnbin.net/b/<slug>/<anything>` |
| Slug | 12 characters: the letters `a`–`z` except `l` and `o`, and the digits `2`–`9`. Case doesn't matter. |
| Methods | Any: `GET`, `POST` and the other common ones, WebDAV's `PROPFIND` or `COPY`, or a sender's own. A method is recorded in capitals, cut at 16 characters. `TRACE` and `CONNECT` are refused in front of the bin and never recorded. |
| Recorded path | Everything after the slug, as sent, percent-encoding kept: `/b/<slug>/stripe/events` records `/stripe/events`, and `/b/<slug>` records `/`. |
| Recorded query | The query string as sent, without the `?`. |

### What a bin URL answers {#edge-answers}

| Status | Body | When |
| --- | --- | --- |
| `200` | `{"status":"accepted"}` | Every request to a well-formed slug, recorded or not, unless a row below applies. A bin that doesn't exist, was deleted, has expired, is disabled or suspended, or is past its plan's monthly requests answers the same way. |
| `429` | `{"status":"rate_limited"}`, with `Retry-After: 30` | The sending address is over 120 requests a minute to bin URLs, or the bin is over 600 a minute from all its senders together. Checked before the body is read; nothing is recorded or counted. |
| `503` | `{"status":"unavailable"}`, with `Retry-After: 30` | The request couldn't be stored just now. Nothing is recorded; send it again. |
| `404` | none | The slug can't be one Request Bins ever issued: it is the wrong length, or has a character outside the slug alphabet. |

The `200` is the same for every outcome on purpose. A sender that gets an error may stop sending or switch its webhook off, and a different answer for a live bin would let anyone probe for bins. Whether a request was recorded is something the bin's owner reads in the API or the console, never the sender.

A `200` carries an `X-Request-ID` header, and the captured request's `request_id` holds the same value, so a sender's log line can be matched to what the bin recorded.

### What a bin records {#edge-records}

- **Body:** a body of any size is accepted. Its full size is counted in `size_bytes`, and its first 1 MiB is stored, so a body up to 1 MiB is stored whole. `truncated` is `true` when the body was over 1 MiB, and the stored body is then shorter than `size_bytes`. The body is stored as the bytes that arrived, never parsed or changed.
- **Headers:** in arrival order with duplicates kept, up to 256 of them; a name is cut at 256 characters and a value at 8,192. The values of `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` and `X-API-Key` are replaced with `[redacted]` before anything is stored. Every other header is kept as sent.
- **Path:** cut at 2,048 characters.
- **Content type:** the `Content-Type` header, as `content_type`.
- **Source address:** the address that sent the request, as `source_ip`.

### Every request is a row {#edge-repeats}

Every request is stored as a row of its own. A request sent again, even with the same method, path, query string and body as one the bin already holds, is a new row with its own headers, source address, time and `request_id`, and it counts toward the month's requests like any other. So a provider's retries appear one by one, each with its own signature and timestamp. `seen_count` is `1` on every new row. A request stored before 25 October 2026 may differ until it ages out: its body may have been cut at 64 KiB, and its `seen_count` may count every time the same request arrived.

### When nothing is recorded {#edge-refusals}

The sender gets `200` in every case below. What the bin shows:

| The bin | What the bin shows |
| --- | --- |
| doesn't exist, was deleted, or has expired | — |
| is disabled (`status` `disabled`) | — |
| is suspended | — |
| belongs to a workspace suspended for an unpaid charge | `refused_count` goes up; `last_refused_reason` is `workspace_suspended` |
| is past the month's requests, or past its own share of them | `refused_count` goes up; `last_refused_reason` is `quota_exceeded` |

`last_refused_summary` shows the last refused request as `METHOD /path`, and `last_refused_at` when it came. Refused requests don't count toward the month.

### Suspension {#suspension}

Two gates suspend a bin whose traffic looks like collection from strangers rather than a few known senders:

- **Distinct senders:** a bin heard from more distinct addresses than the plan allows: 50 on Free, 200 on Starter, 500 on Pro and 2,000 on Custom.
- **Browser form posts:** a request with a browser header (`Origin`, `Referer`, `Sec-Fetch-Site` or `Sec-Fetch-Mode`) and a form content type (`application/x-www-form-urlencoded` or `multipart/form-data`) is a browser form post. A bin that receives more of them than the plan allows (3 on Free, 5 on Starter and Pro, 10 on Custom), from at least three addresses, is suspended. `browser_post_count`, `last_browser_form_origin` and `last_browser_form_at` show what it has seen.

The request that trips a gate is recorded, and the ones after it aren't. A suspended bin answers `200` and records nothing, whatever its `status`. `suspended_code` says why:

| `suspended_code` | Why | Lifted |
| --- | --- | --- |
| `source_fanout` | The distinct-senders gate | By NimbusNexus; contact support |
| `browser_posts` | The browser-form gate | By NimbusNexus; contact support |
| `abuse` | NimbusNexus suspended it after a report | By NimbusNexus |
| `non_payment` | The workspace is suspended for an unpaid charge | When the charge is settled |
| `plan_downgrade` | The plan allows fewer bins than the workspace holds, and this is one of the newest | When the plan allows it again, oldest bins first |

Treat `suspended_code` as an open string and keep a default for a value you don't know; `suspended_reason` says the same in words. A bin can be suspended for several causes at once, and each is lifted on its own: settling a charge never lifts an abuse suspension, and lifting one never brings back a bin the plan no longer allows.

To report a bin URL that is being abused, write to `abuse@nnbin.net` with the full URL. The page at `https://nnbin.net/` says the same.

### Browsers {#edge-browsers}

Bin URLs send no CORS headers. A web page can send a bin a simple request, such as a form post, but can't read the answer, and a request that needs a preflight stops at its `OPTIONS`, which is what the bin records. `robots.txt` asks search engines not to crawl bin URLs.

## The API {#api}

The base URL is `https://bins.nimbusnexus.net/v1`. Requests and answers are JSON. Send a key as `Authorization: Bearer <key>` or `X-API-Key: <key>` ([Getting access](/docs/product-bins#access)). Timestamps are ISO 8601 in UTC, and one you send without an offset is read as UTC. Errors use the shape in [Errors](/docs/errors).

| Route | What it does | Needs |
| --- | --- | --- |
| `POST /v1/bins` | Create a bin; `201` with [the bin](#bin) | write |
| `GET /v1/bins` | The workspace's bins, newest first; `url` or `slug` finds one | read |
| `GET /v1/bins/{id}` | One bin | read |
| `PATCH /v1/bins/{id}` | Rename a bin, disable and enable it, or set its [forward URL](#forwarding) | write |
| `POST /v1/bins/{id}/forward-test` | Send a [test](#forward-test) to the bin's forward URL and return what it answered | write |
| `DELETE /v1/bins/{id}` | Delete a bin; `204` | admin |
| `GET /v1/bins/{id}/requests` | A bin's [captured requests](#requests), newest first | read; with a key, a paid plan |
| `GET /v1/requests` | Every bin's [captured requests](#all-requests) in one list, newest first | read; with a key, a paid plan |
| `GET /v1/bins/{id}/paths` | A bin's requests [grouped by path](#paths) | read; with a key, a paid plan |
| `GET /v1/requests/{id}` | One captured request in full, with its [forwards](#forwards) | read; with a key, a paid plan |
| `DELETE /v1/bins/{id}/requests` | Empty a bin; `200` with `{"deleted": <count>}` | admin |
| `GET /v1/plan` | The workspace's plan and its limits | read |
| `GET /v1/usage` | This month's requests and the bins held, against the plan | read |

**read**, **write** and **admin** are explained under [Who can do what](#authority).

### Create a bin {#create}

`POST /v1/bins` takes a JSON body, `{}` when you set nothing:

| Field | What |
| --- | --- |
| `label` | Your name for the bin, up to 200 characters. Senders never see it. |
| `expires_in_minutes` | How long the bin lives: 1 to 525,600 (a year). Without it, the plan's default applies: 24 hours on Free, until deleted on paid plans. A lifetime longer than the plan allows is cut to its maximum, not refused: 24 hours on Free, 7 days on Starter, 30 days on Pro and a year on Custom. `expires_at` in the answer shows the result. |

A bin's lifetime can't be changed after it is created. When the workspace already holds its plan's bins, the answer is `402` `quota_exceeded`, with `details.metric` `bins`, `details.limit` and `details.current`. Bins held back by a plan downgrade don't count.

### Find a bin {#list}

`GET /v1/bins` lists the workspace's bins, newest first. With `url` (a bin URL, with or without a path after the slug) or `slug` (in any case), it returns that one bin, or an empty list. Deleted and expired bins are never listed, and reading one answers `404`.

Lists are paged with `limit` (1 to 200, default 50) and `offset` (0 to 10,000). The answer is `{"items": [...], "next_offset": <offset>}`: pass `next_offset` back as `offset` for the next page. It is `null` on the last page, and past offset 10,000.

### The bin object {#bin}

| Field | What |
| --- | --- |
| `id` | `bin_` and 24 hex characters. Every route takes it. |
| `slug` | The part of the URL after `/b/`. |
| `url` | The URL to give senders. |
| `label` | Your name for it. |
| `status` | `enabled` or `disabled`: your switch. A disabled bin answers senders and records nothing. |
| `expires_at` | When the bin ends, or `null` if it lives until deleted. |
| `created_at` | When it was created. |
| `suspended` | `true` while NimbusNexus has the bin switched off ([Suspension](#suspension)). |
| `suspended_code`, `suspended_reason` | Why, as a word and in words; empty when the bin isn't suspended. |
| `refused_count` | Requests answered and not recorded because the workspace was past its requests or suspended. |
| `last_refused_summary`, `last_refused_reason`, `last_refused_at` | The last of those, as `METHOD /path`; `quota_exceeded` or `workspace_suspended`; and when it came. |
| `browser_post_count` | Browser form posts the bin has received. |
| `last_browser_form_origin`, `last_browser_form_at` | The page that sent the last one, and when. |
| `request_count` | Requests recorded since the bin was created or last emptied. |
| `last_request_at` | When the last one arrived, or `null`. |
| `period_requests` | This month's requests counted for the bin, against `bin_request_ceiling` in [`GET /v1/usage`](#plan). |
| `forward_url` | Where the bin [forwards](#forwarding) each request it records, or `null` when it doesn't. |
| `forward_paused_at`, `forward_paused_reason` | When forwarding [paused](/docs/product-bins/forwarding#paused) after failed sends, and why: `failed_in_a_row` or `failing_for_an_hour`. `null` and empty while it isn't paused. |
| `forward_last_error`, `forward_last_error_at` | The last send that failed: what went wrong, such as `HTTP 503` or a timeout, never what the request held; and when. |

### Change or delete a bin {#change}

`PATCH /v1/bins/{id}` takes `label`, `status` (`enabled` or `disabled`), `forward_url` ([Forwarding](#forwarding)), or any of them, and answers with the bin. Disabling stops recording and keeps what the bin holds. A disabled bin still counts toward the plan's bins.

`status` used to be `active` where it is now `enabled`, and no answer says `active` any more. `PATCH` still accepts `"status": "active"` and the bin comes back `enabled`, but the spelling is deprecated and will be refused from a date still to be announced, so send `enabled`.

In the console, the ⋯ menu on a bin's page holds **Rename…**, **Disable** or **Enable**, **Empty bin…** and **Delete bin…**, and forwarding is set on its **Forwarding** card. A disabled bin's page says so, with an **Enable** button.

`DELETE /v1/bins/{id}` deletes a bin for good. Its URL stops recording at once, though senders still get `200`; its slug is never issued again, to you or anyone; and what it recorded is deleted shortly after. Its place among the plan's bins frees at once.

`DELETE /v1/bins/{id}/requests` empties a bin: every request it holds is deleted and `request_count` goes back to `0`. The bin keeps its URL and keeps recording.

### Captured requests {#requests}

`GET /v1/bins/{id}/requests` lists a bin's requests, newest first, and `GET /v1/requests` lists [every bin's](#all-requests) in one list. Both take these parameters:

| Parameter | What |
| --- | --- |
| `since` | Only requests received after this instant. Pass the newest `received_at` you have seen to poll for new ones. |
| `until` | Only requests received at or before this instant: the way back through older ones. |
| `method` | Only requests sent with this method, in any case. Repeat it for any of several: `?method=PUT&method=DELETE`. |
| `path` | Only requests sent to exactly this path: what followed the slug, from its `/`, without the query string, as the list shows it. Case matters. [Requests by path](#paths) lists a bin's paths. |
| `q` | Only requests containing this text, up to 200 characters, ignoring case: in the path and query string as sent (`/orders?id=42`), in a header as `name: value`, or in the stored body. A body that isn't UTF-8 text is searched with each byte above 127 (and NUL) written as `\` and three octal digits, and a backslash doubled. |
| `in` | Where `q` looks: `all`, the default, or only `path` (the path and query string), `headers` (each one as `name: value`) or `body`. |
| `header` | Only this header's values, its name in any case, and any of them when it was sent more than once. Without `q`, every request that carries the header. It goes with `in` `all` or `headers`. |
| `field` | Only this field of a JSON body, named as `data.object.id` or `items[0].sku`: a string is searched as itself, a number as JSON writes it, an object or array as JSON text. Without `q`, every request whose body has the field. A body that isn't JSON, or was cut at 1 MiB, has no fields. It goes with `in` `all` or `body`, and not with `header`. |
| `limit`, `offset` | Paging, as for bins. Past offset 10,000, narrow the window with `until` instead. |

A `header` or a `field` with another `in`, or a `header` and a `field` together, is refused with a `422` `validation_error` whose entry has the type `bins.search_conflict`.

A search (`q`, `header` or `field`) pages differently from the rest. It reads the list's requests newest first and stops when it has `limit` matches or has read 16 MiB of requests (or 5,000 of them), whichever comes first, so a page can hold fewer matches than `limit`, or none, while older requests are still unread. A search's page has `next_offset` `null` and, until the search has read the list's oldest request, a `next_until`: pass it back as `until`, with the same search, `method`, `path` and `since`, to search on from where it stopped. With a search, `offset` skips that many requests before the search starts reading.

```json
{
  "items": [],
  "next_offset": null,
  "next_until": "2026-10-23T14:02:11.408211+00:00"
}
```

Each item:

| Field | What |
| --- | --- |
| `id` | `req_` and 24 hex characters. |
| `bin_id` | The bin it came to. |
| `method` | The HTTP method. |
| `path` | What followed the slug, as sent; `/` for the bare bin URL. |
| `query` | The query string as sent, without the `?`; empty when there was none. |
| `source_ip` | The address it came from. |
| `content_type` | Its `Content-Type` header, or empty. |
| `size_bytes` | The body's full size, as sent. |
| `truncated` | `true` when the body was over 1 MiB, so only its first 1 MiB is stored. |
| `seen_count` | `1`: every request is a [row of its own](#edge-repeats). |
| `received_at` | When it arrived. |
| `expires_at` | When it will be deleted: the plan's retention after `received_at`, or the bin's own `expires_at` if that comes first. |

`GET /v1/requests/{id}` returns one request with every field above, and:

| Field | What |
| --- | --- |
| `headers` | Objects with a `name` and a `value`, in arrival order, duplicates kept, credentials `[redacted]`. |
| `body_base64` | The stored body, base64-encoded because it need not be text: at most 1 MiB. |
| `request_id` | The id the bin URL gave this request, which is the `X-Request-ID` its sender got back. |
| `forwards` | What became of [forwarding](#forwards) it, the newest first; empty when its bin wasn't forwarding when it arrived. |

With an API key, `GET /v1/bins/{id}/requests`, `GET /v1/requests` and `GET /v1/requests/{id}` need a paid plan: on Free they answer `402` `not_entitled`, with `details.feature` `read_api`. The console reads them on every plan. A request past its `expires_at`, or in a bin that has been emptied, deleted or has expired, answers `404`.

### Every bin's requests {#all-requests}

`GET /v1/requests` lists the requests of all the workspace's bins in one list, newest first. It takes the parameters of a bin's list above and pages the same way, by `next_offset`, or by `next_until` for a search. Its items are a bin's list's items, each with the `bin_id` it came to; to show a bin's label or URL beside each, match `bin_id` with `GET /v1/bins`.

It holds the requests of the bins that still exist. A deleted or expired bin's requests leave it at once, and a disabled or suspended bin's stay, as they stay in that bin's own list. The console's **All bins** page shows this list, with the same search and method filters as a bin's page and without **By path**.

### Requests by path {#paths}

`GET /v1/bins/{id}/paths` groups a bin's newest 10,000 requests by path, the most recently used path first. The query string is left out, so `/orders?id=1` and `/orders?id=2` are one path, while paths are compared as sent, so `/users/1` and `/users/2` are two. `method` keeps only those methods, as on the request list, and `limit` and `offset` page as they do for bins.

```json
{
  "items": [
    {
      "path": "/stripe/events",
      "requests": 42,
      "methods": ["POST", "GET"],
      "last_received_at": "2026-10-26T09:12:04Z"
    }
  ],
  "next_offset": null,
  "counted": 57,
  "capped": false
}
```

| Field | What |
| --- | --- |
| `path` | What followed the slug, without the query string. |
| `requests` | How many of the counted requests were sent to it. |
| `methods` | The methods they were sent with, the most used first. |
| `last_received_at` | When the last of them arrived. |

`counted` says how many requests were grouped, and `capped` is `true` when the bin holds more than that, so older paths and counts are missing. Counting only the newest 10,000 keeps one call as quick on a bin of millions as on a bin of ten. To list one path's requests, pass it as `path` to `GET /v1/bins/{id}/requests`. With an API key the route needs a paid plan, as the request routes do.

In the console, **By path** above a bin's list shows the same groups, refreshed every 10 seconds, with the method chips applied. Picking a path lists its requests, with the path shown as a chip above the list; removing the chip lists every request again.

### Forwarding {#forwarding}

A bin on Starter, Pro or Custom can send each request it records on to one https URL of yours. [Forwarding](/docs/product-bins/forwarding) covers what is sent, the retries, the limits and when forwarding pauses; this section covers the API.

`PATCH /v1/bins/{id}` with `forward_url` sets the URL, and `null` or `""` stops forwarding. Setting a URL again, even the same one, resumes a bin whose forwarding [paused](/docs/product-bins/forwarding#paused), and starts its count of failed sends again. On Free the answer is `402` `not_entitled`, with `details.feature` `forwarding`. A URL a bin won't forward to is a `422` `validation_error` whose entry has the type `bins.forward_target`, the `loc` `["body", "forward_url"]`, and a `params.reason`:

| `reason` | Why |
| --- | --- |
| `scheme` | It isn't `https`. |
| `credentials` | It carries a user name or password. |
| `host` | It has no host, or its host isn't a valid name. |
| `port` | Its port isn't between 1 and 65535. |
| `length` | It is over 2,048 characters. |
| `own_domain` | Its host is `nnbin.net`, `nimbusnexus.net` or a name under them, or resolves to one of our own addresses. |
| `not_public` | Its host doesn't resolve, or resolves to an address that isn't public, such as a private, loopback or link-local one. |
| `missing` | A test send to a bin with no forward URL. |

Treat `reason`, `forward_paused_reason` and a forward's `reason` as open strings, and keep a default for a value you don't know.

When forwarding pauses, the workspace is told once, by email and by a webhook with the event type `bind.forwarding.paused`; [When forwarding pauses](/docs/product-bins/forwarding#paused) shows the webhook's body.

### Test a forward URL {#forward-test}

`POST /v1/bins/{id}/forward-test` takes no body. It sends a test event to the bin's forward URL at once and answers `200` with what came back ([Checking the URL first](/docs/product-bins/forwarding#test) shows the event):

| Field | What |
| --- | --- |
| `ok` | `true` when your server answered `2xx` or `3xx`. |
| `answer` | What it answered: `status`; `headers`, objects with a `name` and a `value`, in the order sent; the first 8 KiB of the body as `body_base64`; and `truncated`, `true` when the body went on past that. `null` when no answer came. |
| `duration_ms` | How long the send took. |
| `error` | Why no answer came, such as a timeout or a refused connection; empty when one did. |

The call waits up to 13 seconds for the answer, and a server slower than that gives `ok` `false` with an `error` saying so. A bin can send 10 tests a minute: past that, the answer is `429` `rate_limited`, and `details.retry_after` says how many seconds until the next is allowed. `503` `unavailable`, with `details.reason` `forwarder_unavailable`, means the test wasn't picked up for sending within 3 seconds, so nothing was sent: try again shortly. A URL found not to be public at the send is refused with the `422` above.

### A request's forwards {#forwards}

`GET /v1/requests/{id}` carries `forwards`: what became of forwarding the request, the newest first, and empty when its bin wasn't forwarding when it arrived. [Seeing what happened](/docs/product-bins/forwarding#forwards) shows one in full. Each item:

| Field | What |
| --- | --- |
| `id` | `fwd_` and 24 hex characters. |
| `state` | Where it stands, from the table below. |
| `reason` | Why it wasn't forwarded, when `state` is `not_forwarded`; empty otherwise. |
| `url` | Where it goes: the forward URL as it was when the request arrived, with the request's path and query added. |
| `attempts`, `max_attempts` | The attempts made so far, and the most the plan allowed when it was queued. |
| `next_attempt_at` | When the next attempt is due, while `state` is `retrying`; otherwise `null`. |
| `last_error` | What went wrong on the last attempt, such as `HTTP 503` or a timeout, or why it is waiting; empty once it is sent. |
| `answer` | What your server answered on the last attempt, shaped as in a [test](#forward-test). `null` when that attempt got no answer. |
| `duration_ms` | How long the last attempt took; `null` before the first. |
| `created_at` | When it was queued. |
| `sent_at` | When it was sent; `null` until then. |

| `state` | What it means |
| --- | --- |
| `queued` | Waiting for its first attempt. |
| `sending` | An attempt is under way. |
| `sent` | Your server answered `2xx` or `3xx`. |
| `retrying` | An attempt failed, and another is due at `next_attempt_at`. |
| `failed` | Given up: the plan's attempts are used up, or an attempt ended in a way that isn't retried, such as a `404`. |
| `not_forwarded` | Recorded and never sent; `reason` says why. |

| `reason` | Why it wasn't forwarded |
| --- | --- |
| `paused` | Forwarding was paused when the request arrived, or when its turn came. |
| `body_too_large` | The body is larger than the plan forwards, or was over 1 MiB. |
| `url_too_long` | The forward URL with the request's path and query added is over 8,192 characters. |
| `queue_full` | 1,000 of the bin's forwards hadn't finished yet. |
| `forwarding_off` | Forwarding was stopped before its turn. |
| `bin_gone` | The bin was deleted or expired before its turn. |
| `suspended` | The bin or its workspace was suspended before its turn. |
| `not_entitled` | The plan stopped including forwarding before its turn. |
| `request_gone` | The request reached the end of its retention before its turn. |

### Plan and usage {#plan}

`GET /v1/plan` says which limits apply:

```json
{
  "plan": "starter",
  "enforced_as": "starter",
  "ceilings": {
    "max_bins": 5,
    "monthly_requests": 25000,
    "retention_days": 7,
    "bin_ttl_minutes": 0,
    "bin_ttl_max_minutes": 10080,
    "read_api": 1,
    "bin_max_sources": 200,
    "bin_max_browser_posts": 5,
    "bin_share_pct": 50,
    "forwarding": 1,
    "forward_max_body_bytes": 262144,
    "forward_rate_per_min": 60,
    "forward_max_attempts": 3
  },
  "past_due": false,
  "suspended": false,
  "system": false
}
```

`plan` is the plan on record, empty when the workspace has none; `enforced_as` is the plan whose limits apply, `free` when there is none. `ceilings` holds the limits by name ([Plans and limits](#limits)). `past_due` is `true` while a charge is unsettled, and `suspended` once the grace period after it has ended. `system` is for NimbusNexus's own workspace.

`GET /v1/usage` says how much of them is used:

```json
{
  "period": "2026-10-01",
  "requests": 26834,
  "monthly_requests": 35000,
  "purchased_requests": 10000,
  "credit": null,
  "bins": 2,
  "max_bins": 5,
  "bin_request_ceiling": 17500
}
```

`period` is the month, as its first day. `requests` counts what the workspace's bins recorded this month, against `monthly_requests`: the plan's month plus `purchased_requests`, the requests bought with [credit](#credit) this month. Here a Starter workspace has bought one block on top of its 25,000. `bins` counts the bins held, against `max_bins`. `bin_request_ceiling` is the most one bin may record this month, bought requests included.

`credit` is `null` while the month has requests left. Once they are used up, it says what credit is doing: `pending` while more are being bought, so bins record again within minutes; `empty` when the balance is too low for a block; and `off` when credit is switched off for Request Bins, or the plan buys none, as on Custom. Treat it as an open string, and keep a default for a value you don't know.

## Who can do what {#authority}

| | Read bins, plan and usage | Read captured requests | Create, rename, disable and enable bins, and set up forwarding | Delete and empty bins |
| --- | --- | --- | --- | --- |
| Workspace owner or admin | yes | yes | yes | yes |
| Member | yes | yes | yes | no |
| Viewer, or any other role | yes | yes | no | no |
| Key with **Read & write** (`admin` scope) | yes | on paid plans | yes | yes |
| Key with **Read** (`read` scope) | yes | on paid plans | no | no |

A refused action answers `403` `forbidden` with `details.reason` `role`, and `details.required` names the role it needs: `member` to create or change a bin, `admin` to delete or empty one. For a key, both mean **Read & write** (the `admin` scope). The account console creates **Read** and **Read & write** keys, and a key with any other scope, such as `write`, is treated as **Read**.

Request Bins serves whole workspaces. A guest seat, or a key limited to one project, is refused on every route with `403` `project_confined`.

A workspace has Request Bins once an owner or admin has opened the console, or added it from **Add a product**. Until then, other members are refused with `403` `product_not_enabled`. Keys aren't affected.

## Plans and limits {#limits}

| `ceilings` key | What | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- | --- |
| `max_bins` | Bins at once | 1 | 5 | 25 | 250 |
| `monthly_requests` | Requests recorded per month | 1,000 | 25,000 | 250,000 | 5,000,000 |
| `bin_share_pct` | The most of the month one bin may use | 100% | 50% | 40% | 25% |
| `retention_days` | How long a request is kept | 1 day | 7 days | 30 days | 90 days |
| `bin_ttl_minutes` | A new bin's default lifetime | 24 hours | until deleted | until deleted | until deleted |
| `bin_ttl_max_minutes` | The longest lifetime you may set | 24 hours | 7 days | 30 days | no plan limit; the API's maximum is a year |
| `read_api` | Reading captured requests with a key | no | yes | yes | yes |
| `bin_max_sources` | Distinct senders before a bin is suspended | 50 | 200 | 500 | 2,000 |
| `bin_max_browser_posts` | Browser form posts before a bin is suspended | 3 | 5 | 5 | 10 |
| `forwarding` | [Forwarding](#forwarding) each request to your own server | no | yes | yes | yes |
| `forward_max_body_bytes` | The largest body a forward carries | — | 256 KiB | 1 MiB | 1 MiB |
| `forward_rate_per_min` | Forwards one bin sends a minute; more wait their turn | — | 60 | 300 | 600 |
| `forward_max_attempts` | Attempts to send one forward | — | 3 | 5 | 5 |

`GET /v1/plan` reports lifetimes in minutes, with `0` meaning until deleted (`bin_ttl_minutes`) or no plan limit (`bin_ttl_max_minutes`), `read_api` and `forwarding` as `1` or `0`, `forward_max_body_bytes` in bytes, and the forwarding numbers as `0` on Free. Prices are on the [overview](/docs/product-bins#limits).

- **The month** is a calendar month in UTC: `period` in `GET /v1/usage`. Every request a bin records counts. A refused or rate-limited request doesn't.
- **Past the month's requests**, or past one bin's share of them (`bin_request_ceiling`), bins answer `200` and record nothing until [credit](#credit) buys more or the next month begins, and `refused_count` shows it. No API call is refused for it.
- **Retention and lifetime are separate clocks.** A request is deleted when the plan's retention runs out or when its bin ends, whichever comes first.
- **Notices:** when the workspace reaches 80% and then 100% of the month's requests, bought requests included, it is told by email, which goes to the workspace owner unless you choose another address, and by a webhook with the event type `bind.quota.threshold_reached` if you set one up. Both are under **Notifications** in your account console. The email says what credit will do.
- **While a payment is overdue,** creating and changing bins is refused with `402` `workspace_frozen`, and bins keep recording. If the grace period ends, the workspace is suspended: the same refusals come as `402` `workspace_suspended`, and bins answer `200` and record nothing. Deleting and reading still work, and nothing is deleted.
- **On a smaller plan,** bins over its `max_bins` are held back, newest first, as [`plan_downgrade`](#suspension), and come back, oldest first, once the plan allows them.

### More requests with credit {#credit}

Credit is a balance your workspace keeps for NimbusNexus products to spend when their month runs out. You add it in the [account console]({{ACCOUNT_BASE_URL}}/billing#credit), under **Billing**, where the **Credit** card also switches each product's spending on or off. It is on for Request Bins until you switch it off.

- **The block:** 10,000 requests for $4, on Free, Starter and Pro. On Custom, more requests come by contract, so credit buys none.
- **When:** about every 5 minutes, Request Bins buys one block for each workspace whose month is 90% used with fewer than 10,000 requests left, for as long as the balance lasts.
- **What it adds:** 10,000 requests to the month, and to each bin's share its part of them, such as 5,000 on Starter, so `monthly_requests`, `purchased_requests` and `bin_request_ceiling` in [`GET /v1/usage`](#plan) grow with it.
- **For the month only:** bought requests lapse when the month ends. A partly used block isn't refunded, and nothing carries over.
- **When it can't buy:** with credit switched off, or a balance too low for a block, bins answer `200` and record nothing past the month's requests until the next month, and `credit` in `GET /v1/usage` says which. A sender fast enough to use up the last requests before the next purchase finds the month used up too, for a few minutes, and what it sends then isn't recorded.

## Errors {#errors}

The API's errors use the shape described in [Errors](/docs/errors), with the codes Inboxes sends for the same situations:

| Status | `code` | When |
| --- | --- | --- |
| `400` | `bad_request` | A JSON body that isn't valid UTF-8. |
| `401` | `unauthorized` | No credential, a revoked one, or a console sign-in that has ended; `details.reason` says which. |
| `401` | `invalid_credential` | A key that doesn't verify, has expired, or was created for another product. |
| `402` | `quota_exceeded` | Creating a bin while the plan's bins are all in use. |
| `402` | `not_entitled` | On Free: reading captured requests with a key (`details.feature` `read_api`), or setting a forward URL or sending a test (`forwarding`). |
| `402` | `workspace_frozen`, `workspace_suspended` | Creating or changing a bin while a payment is overdue, or after service has stopped. |
| `403` | `forbidden` | `details.reason` is `role`, `project_confined`, `product_not_enabled`, `csrf` or `no_workspace`. |
| `404` | `not_found` | No such bin or request in your workspace, or it has been deleted or has expired; `details.reason` is `bin` or `request`. |
| `405` | `method_not_allowed` | The path exists, but not for this method. |
| `413` | `payload_too_large` | A request body over 2 MiB. |
| `422` | `validation_error` | A parameter or field failed validation. A NUL character in the path, the query or a JSON body is the entry type `bins.nul_character`, a forward URL a bin won't forward to is `bins.forward_target` ([Forwarding](#forwarding)), and a search whose parts contradict each other is `bins.search_conflict` ([Captured requests](#requests)). |
| `429` | `rate_limited` | More than 10 test sends to one bin in a minute; `details.retry_after` says when to try again. |
| `500` | `internal_error` | Something broke on our side. |
| `503` | `unavailable` | Setting a forward URL or sending a test while forwarding is switched off for the whole service (`details.reason` `forwarding_disabled`), or a test that wasn't picked up for sending within 3 seconds, so nothing was sent (`forwarder_unavailable`). |

The API sends no `409`, and `429` only for test sends.

## What's next {#next-steps}

- [Quickstart](/docs/product-bins/quickstart) — create a bin and read what it recorded.
- [Forwarding](/docs/product-bins/forwarding) — what a forward sends, the retries, the limits and where forwards come from.
- [Request Bins API](/docs/reference/bins) — every operation, with the request in curl, TypeScript, Python or Go.
- [Errors](/docs/errors) — the error shape, every `details` key, and a pattern for handling them.
- [Product overview](/docs/product-bins) — prices, and what Request Bins does not do.
