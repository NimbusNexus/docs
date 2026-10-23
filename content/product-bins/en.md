---
title: Request Bins
description: Public URLs that record every HTTP request sent to them — point any app, script or service at one and read exactly what it sent, in the console or over the API.
publishedAt: 2026-10-22
updatedAt: 2026-10-23
kind: concept
---

# Request Bins

NimbusNexus Request Bins gives you **bins**: public URLs that record every HTTP request sent to them, with any method, to any path under the URL, with any body. Point whatever sends HTTP at one — a webhook provider, your own app, a script, a CI job — and read exactly what arrived: the method, path, query, headers, body and the address it came from, in the console or over the REST API.

> **Not the page you wanted?** A bin records what it receives and stops there: it doesn't pass requests on, and it answers every sender the same way. To receive a provider's webhooks and deliver them to your own endpoints, with retries, use a [Webhooks source](/docs/product-webhooks/sources).

## At a glance {#at-a-glance}

| | |
| --- | --- |
| What you create | A **bin**: a URL such as `https://nnbin.net/b/k7xq2mbn9tfa` |
| What it records | Every request to that URL or any path under it: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` or `OPTIONS`, with any headers and any body |
| What a sender gets back | `200` and `{"status":"accepted"}`, at once |
| Console | `https://bins.nimbusnexus.net` |
| API base URL | `https://bins.nimbusnexus.net/v1` |
| Authentication | `Authorization: Bearer <key>`, a key created in the account console with **Request Bins** as the product |
| Identifier every route takes | The bin `id`, for example `bin_3f9a1c7e5b2d8f4a6c0e9b17` — not its URL |
| Find a bin by its URL | `GET /v1/bins?url=<url>` |
| Read what arrived | `GET /v1/bins/{id}/requests` (paid plans; Free reads in the console) |
| Every route, what a bin URL answers, roles and limits | The [Request Bins reference](/docs/product-bins/reference) |

## How it works {#how}

1. **Create** a bin — in the console with **New bin**, or with `POST /v1/bins`. Its URL records from that moment.
2. **Send** it requests. Give the URL to whatever you want to watch — a provider's webhook settings, your app's configuration, a script, a CI job — or `curl` it yourself. Anything after the slug is yours to choose: a request to `https://nnbin.net/b/k7xq2mbn9tfa/orders/42` is recorded with the path `/orders/42`.
3. **Read** what arrived. It appears in the console within seconds, and on paid plans at `GET /v1/bins/{id}/requests`.
4. **Delete** the bin when you are done, or let it expire.

The [quickstart](/docs/product-bins/quickstart) does all four.

Use the `url` exactly as the API returns it. Bin URLs live on their own domain, `nnbin.net`, not on `{{ROOT_DOMAIN}}`.

## What a sender gets back {#answers}

A bin answers every request at once with `200` and the body `{"status":"accepted"}`, whether it recorded the request or not. A bin that is disabled, suspended or past its plan's monthly requests answers the same way, and so does a URL whose bin never existed or was deleted. That is deliberate: a sender that gets an error may stop sending, or switch your webhook off, and a different answer for a live bin would let anyone probe for bins.

A bin URL answers anything else only when nothing was recorded:

- `429`, with `Retry-After`, when the sender or the bin is over its per-minute limit;
- `503`, with `Retry-After`, when the request couldn't be stored just now, so the sender should send it again;
- `404`, when the slug in the URL isn't one Request Bins could ever have issued.

The reference has the details: [what a bin URL answers](/docs/product-bins/reference#edge-answers).

## What is recorded {#recorded}

For each request, a bin keeps the method, the path after the slug, the query string, the headers in the order they arrived, the body, the address it came from, and when it arrived. A few rules shape what you read back:

- **Bodies are stored up to 64 KiB.** A larger body keeps its first 64 KiB, `truncated` is `true`, and `size_bytes` still says how large it really was.
- **Credentials are redacted.** The values of `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` and `X-API-Key` are replaced with `[redacted]` before anything is stored. Every other header is kept as sent, signature headers included, since a signature is what you need to see when verifying one fails.
- **Nothing is changed or run.** A body is stored as the bytes that arrived, and the console shows it as text, never as markup.
- **A repeat is one row.** A request with the same method, path, query string and body as one the bin already holds adds one to that request's `seen_count` rather than being stored again, so a sender's retries are counted, not duplicated.

## Plans and limits {#limits}

| | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- |
| Price | $0 | $9 a month, or $86.40 a year | $29 a month, or $278.40 a year | by contract |
| Bins at once | 1 | 5 | 25 | 250 |
| Requests recorded per month | 1,000 | 25,000 | 250,000 | 5,000,000 |
| Kept for (retention) | 1 day | 7 days | 30 days | 90 days |
| Bin lifetime | 24 hours | until deleted, or up to 7 days if you set one | until deleted, or up to 30 days | until deleted, or up to a year |
| Read over the API | no (console only) | yes | yes | yes |
| Distinct senders per bin | 50 | 200 | 500 | 2,000 |
| Browser form posts per bin | 3 | 5 | 5 | 10 |

Free is enough to see exactly what any app, script or service sends: one bin, 1,000 requests a month, read in the console.

The month is a calendar month in UTC, and every request a bin records counts, repeats included. Past the month's requests, bins keep answering `200` and record nothing until the next month begins; requests refused that way don't count. One bin may use only part of the month — all of it on Free, half on Starter, 40% on Pro and a quarter on Custom — so one busy or leaked URL can't use up the requests of the workspace's other bins.

The last two rows are abuse limits, described under [Suspended bins](#suspended).

## Suspended bins {#suspended}

A bin URL is public: anyone who has it can send to it. That would make a bin a convenient place to collect what a phishing page's form submits, or data taken from strangers' machines, so a bin is suspended when its traffic looks like that:

- it hears from more distinct addresses than the plan's **distinct senders**; or
- it receives more form posts from web browsers than the plan's **browser form posts**, from at least three addresses.

A suspended bin keeps answering `200` and records nothing. The console says why, and so does `suspended_code` in the API. A suspension is ours, not your switch: enabling the bin doesn't lift it, so contact support if you think one is a mistake. Bins are also held back, without being deleted, when a plan change leaves the workspace more bins than the new plan allows, and while the workspace is suspended for an unpaid charge; each comes back once its cause is resolved.

To report a bin URL that is being abused, write to `abuse@nnbin.net` with the full URL.

## Getting access {#access}

Open the console at `https://bins.nimbusnexus.net` and sign in with your NimbusNexus account, or add Request Bins from **Add a product** in any NimbusNexus console. The first visit by a workspace owner or admin adds Request Bins to the workspace; other members can open it from then on. A personal workspace starts on Free, and a team workspace starts with a 7-day Starter trial.

Keys are not issued by the Request Bins API. Create one in your [account console]({{ACCOUNT_BASE_URL}}/api-keys?product=bins) under **API keys**, with **Request Bins** as the product. A key is a JWT, so it begins `eyJ`. Present it as `Authorization: Bearer <key>` or `X-API-Key: <key>`.

Choose its permission when you create it: **Read** reads bins and what they recorded, and **Read & write** can also create, change, empty and delete bins. On Free a key can manage bins, but reading what they recorded over the API needs Starter or above; the console reads it on every plan. [Who can do what](/docs/product-bins/reference#authority) has the full table, workspace roles included.

## What it will not do {#not}

- **It does not answer with your response.** Every bin answers `200` with `{"status":"accepted"}`; a status, headers or body of your choosing is not built.
- **It does not forward.** What arrives is recorded, not passed on to another URL, and it can't be replayed.
- **It does not push.** There is no stream and no callback: poll `GET /v1/bins/{id}/requests` with `since`, as the console does every 3 seconds.
- **It is not an archive.** A request is deleted when the plan's retention runs out, and everything in a bin goes when the bin is deleted or expires.
- **It does not split a workspace by project.** Request Bins serves whole workspaces, so guest seats and keys limited to one project are refused.

## What's next {#next-steps}

- [Quickstart](/docs/product-bins/quickstart) — create a bin, send it a request, read it back.
- [Request Bins reference](/docs/product-bins/reference) — every route and field, what a bin URL answers, roles, scopes and limits.
- [Request Bins API](/docs/reference/bins) — every operation, with the request in curl, TypeScript, Python or Go.
- [Errors](/docs/errors) — the error shape and the codes the API sends.
