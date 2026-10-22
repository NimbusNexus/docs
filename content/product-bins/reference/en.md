---
title: Request Bins reference
description: Every route of the Request Bins API, what a bin URL answers and records, who may do what, and each plan's limits.
publishedAt: 2026-10-22
updatedAt: 2026-10-22
kind: reference
---

# Request Bins reference

Request Bins has two sides. **Bin URLs** on `nnbin.net` take requests from anyone and record them. **The API** at `https://bins.nimbusnexus.net/v1` creates and manages bins and reads what they recorded, for your workspace only. This page covers both, then who may do what and each plan's limits. The [overview](/docs/product-bins) explains the product, and the [quickstart](/docs/product-bins/quickstart) walks through it.

## Bin URLs {#edge}

| | |
| --- | --- |
| URL | `https://nnbin.net/b/<slug>`, and any path under it: `https://nnbin.net/b/<slug>/<anything>` |
| Slug | 12 characters: the letters `a`–`z` except `l` and `o`, and the digits `2`–`9`. Case doesn't matter. |
| Methods | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` and `OPTIONS`. Any other method is answered `405` and not recorded. |
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

- **Body:** a body of any size is accepted. Its full size is counted in `size_bytes`; the first 1 MiB is passed on for storage, and the first 64 KiB of that is stored. `truncated` is `true` when the stored body is shorter than `size_bytes`. The body is stored as the bytes that arrived, never parsed or changed.
- **Headers:** in arrival order with duplicates kept, up to 256 of them; a name is cut at 256 characters and a value at 8,192. The values of `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` and `X-API-Key` are replaced with `[redacted]` before anything is stored. Every other header is kept as sent.
- **Path:** cut at 2,048 characters.
- **Content type:** the `Content-Type` header, as `content_type`.
- **Source address:** the address that sent the request, as `source_ip`.

### Repeats {#edge-repeats}

A request with the same method, path and body as one the bin already holds isn't stored again, even when its query string or headers differ. Instead, that request's `seen_count` goes up by one, and its `received_at`, `expires_at` and `request_id` move to the latest arrival, while its query string and headers stay those of the first arrival. Headers are left out of the match because a provider's retry carries a new signature and timestamp. A repeat counts toward the month's requests.

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
| `PATCH /v1/bins/{id}` | Rename a bin, or disable and enable it | write |
| `DELETE /v1/bins/{id}` | Delete a bin; `204` | admin |
| `GET /v1/bins/{id}/requests` | A bin's [captured requests](#requests), newest first | read; with a key, a paid plan |
| `GET /v1/requests/{id}` | One captured request in full | read; with a key, a paid plan |
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
| `status` | `active` or `disabled`: your switch. A disabled bin answers senders and records nothing. |
| `expires_at` | When the bin ends, or `null` if it lives until deleted. |
| `created_at` | When it was created. |
| `suspended` | `true` while NimbusNexus has the bin switched off ([Suspension](#suspension)). |
| `suspended_code`, `suspended_reason` | Why, as a word and in words; empty when the bin isn't suspended. |
| `refused_count` | Requests answered and not recorded because the workspace was past its requests or suspended. |
| `last_refused_summary`, `last_refused_reason`, `last_refused_at` | The last of those, as `METHOD /path`; `quota_exceeded` or `workspace_suspended`; and when it came. |
| `browser_post_count` | Browser form posts the bin has received. |
| `last_browser_form_origin`, `last_browser_form_at` | The page that sent the last one, and when. |
| `request_count` | Requests recorded since the bin was created or last emptied, repeats included. |
| `last_request_at` | When the last one arrived, or `null`. |
| `period_requests` | This month's requests counted for the bin, against `bin_request_ceiling` in [`GET /v1/usage`](#plan). |

### Change or delete a bin {#change}

`PATCH /v1/bins/{id}` takes `label`, `status` (`active` or `disabled`), or both, and answers with the bin. Disabling stops recording and keeps what the bin holds. A disabled bin still counts toward the plan's bins.

`DELETE /v1/bins/{id}` deletes a bin for good. Its URL stops recording at once, though senders still get `200`; its slug is never issued again, to you or anyone; and what it recorded is deleted shortly after. Its place among the plan's bins frees at once.

`DELETE /v1/bins/{id}/requests` empties a bin: every request it holds is deleted and `request_count` goes back to `0`. The bin keeps its URL and keeps recording.

### Captured requests {#requests}

`GET /v1/bins/{id}/requests` lists a bin's requests, newest first:

| Parameter | What |
| --- | --- |
| `since` | Only requests received after this instant. Pass the newest `received_at` you have seen to poll for new ones. |
| `until` | Only requests received at or before this instant: the way back through older ones. |
| `limit`, `offset` | Paging, as for bins. Past offset 10,000, narrow the window with `until` instead. |

Each item:

| Field | What |
| --- | --- |
| `id` | `req_` and 24 hex characters. |
| `bin_id` | The bin it came to. |
| `method` | The HTTP method. |
| `path` | What followed the slug, as sent; `/` for the bare bin URL. |
| `source_ip` | The address it came from. |
| `content_type` | Its `Content-Type` header, or empty. |
| `size_bytes` | The body's full size, as sent. |
| `truncated` | `true` when the stored body is shorter than `size_bytes`. |
| `seen_count` | How many times this request arrived: the same method, path and body. |
| `received_at` | When it last arrived. |
| `expires_at` | When it will be deleted: the plan's retention after `received_at`, or the bin's own `expires_at` if that comes first. |

`GET /v1/requests/{id}` returns one request with every field above, and:

| Field | What |
| --- | --- |
| `query` | The query string as sent, without the `?`. |
| `headers` | Objects with a `name` and a `value`, in arrival order, duplicates kept, credentials `[redacted]`. |
| `body_base64` | The stored body, base64-encoded because it need not be text: at most 64 KiB. |
| `request_id` | The id the bin URL gave the delivery that last wrote this request, which is the `X-Request-ID` that sender got back. |

With an API key, both routes need a paid plan: on Free they answer `402` `not_entitled`, with `details.feature` `read_api`. The console reads them on every plan. A request past its `expires_at`, or in a bin that has been emptied, deleted or has expired, answers `404`.

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
    "bin_share_pct": 50
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
  "requests": 1834,
  "monthly_requests": 25000,
  "bins": 2,
  "max_bins": 5,
  "bin_request_ceiling": 12500
}
```

`period` is the month, as its first day. `requests` counts what the workspace's bins recorded this month, against `monthly_requests`. `bins` counts the bins held, against `max_bins`. `bin_request_ceiling` is the most one bin may record this month.

## Who can do what {#authority}

| | Read bins, plan and usage | Read captured requests | Create, rename, disable and enable bins | Delete and empty bins |
| --- | --- | --- | --- | --- |
| Workspace owner or admin | yes | yes | yes | yes |
| Member | yes | yes | yes | no |
| Viewer, or any other role | yes | yes | no | no |
| Key with **Read & write** (`admin` scope) | yes | on paid plans | yes | yes |
| Key with **Read** (`read` scope) | yes | on paid plans | no | no |

A refused action answers `403` `forbidden` with `details.reason` `role`, and `details.required` names the role it needs: `member` to create or change a bin, `admin` to delete or empty one. For a key, `member` means the `write` or `admin` scope, and `admin` means `admin`. The API also takes keys with the `write` scope, which create and change bins but don't delete or empty them; the account console creates **Read** and **Read & write** keys.

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

`GET /v1/plan` reports lifetimes in minutes, with `0` meaning until deleted (`bin_ttl_minutes`) or no plan limit (`bin_ttl_max_minutes`), and `read_api` as `1` or `0`. Prices are on the [overview](/docs/product-bins#limits).

- **The month** is a calendar month in UTC: `period` in `GET /v1/usage`. Every request a bin records counts, repeats included. A refused or rate-limited request doesn't.
- **Past the month's requests**, or past one bin's share of them (`bin_request_ceiling`), bins answer `200` and record nothing until the next month, and `refused_count` shows it. No API call is refused for it.
- **Retention and lifetime are separate clocks.** A request is deleted when the plan's retention runs out or when its bin ends, whichever comes first.
- **Notices:** when the workspace reaches 80% and then 100% of the month's requests, it is told by email, which goes to the workspace owner unless you choose another address, and by a webhook with the event type `binsd.quota.threshold_reached` if you set one up. Both are under **Notifications** in your account console.
- **While a payment is overdue,** creating and changing bins is refused with `402` `workspace_frozen`, and bins keep recording. If the grace period ends, the workspace is suspended: the same refusals come as `402` `workspace_suspended`, and bins answer `200` and record nothing. Deleting and reading still work, and nothing is deleted.
- **On a smaller plan,** bins over its `max_bins` are held back, newest first, as [`plan_downgrade`](#suspension), and come back, oldest first, once the plan allows them.

## Errors {#errors}

The API's errors use the shape described in [Errors](/docs/errors), with the codes Inboxes sends for the same situations:

| Status | `code` | When |
| --- | --- | --- |
| `400` | `bad_request` | A JSON body that isn't valid UTF-8. |
| `401` | `unauthorized` | No credential, a revoked one, or a console sign-in that has ended; `details.reason` says which. |
| `401` | `invalid_credential` | A key that doesn't verify, has expired, or was created for another product. |
| `402` | `quota_exceeded` | Creating a bin while the plan's bins are all in use. |
| `402` | `not_entitled` | Reading captured requests with a key on Free. |
| `402` | `workspace_frozen`, `workspace_suspended` | Creating or changing a bin while a payment is overdue, or after service has stopped. |
| `403` | `forbidden` | `details.reason` is `role`, `project_confined`, `product_not_enabled`, `csrf` or `no_workspace`. |
| `404` | `not_found` | No such bin or request in your workspace, or it has been deleted or has expired; `details.reason` is `bin` or `request`. |
| `405` | `method_not_allowed` | The path exists, but not for this method. |
| `413` | `payload_too_large` | A request body over 2 MiB. |
| `422` | `validation_error` | A parameter or field failed validation. A NUL character in the path, the query or a JSON body is the entry type `bins.nul_character`. |
| `500` | `internal_error` | Something broke on our side. |

The API sends no `409` and no `429`.

## What's next {#next-steps}

- [Quickstart](/docs/product-bins/quickstart) — create a bin and read what it recorded.
- [Request Bins API](/docs/reference/bins) — every operation, with the request in curl, TypeScript, Python or Go.
- [Errors](/docs/errors) — the error shape, every `details` key, and a pattern for handling them.
- [Product overview](/docs/product-bins) — prices, and what Request Bins does not do.
