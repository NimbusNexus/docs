---
title: Inboxes (product)
description: Disposable email addresses and HTTP request bins for testing — create one, point the system under test at it, and read what arrives in the dashboard or over the API.
publishedAt: 2026-08-18
updatedAt: 2026-10-19
kind: concept
---

# Inboxes (product)

NimbusNexus Inboxes gives you throwaway places to receive test traffic: **email addresses** that accept real mail, and **request bins** that record any HTTP request sent to them. You create one, point a signup form, a test suite or a webhook sender at it, and read what arrived in the dashboard or over the REST API.

> **Not the page you wanted?** Inboxes only ever receives. To *send* mail from your application, or to receive and route production webhooks, this is not the product — see [What it will not do](#not).

## At a glance {#at-a-glance}

| | |
| --- | --- |
| What you create | An **inbox**: either an email address (`transport: "email"`) or a request bin (`transport: "http"`) |
| API base URL | `{{INBOXES_BASE_URL}}` |
| Authentication | `Authorization: Bearer <key>`, a key minted in the account console with **Inboxes** as the product |
| Identifier every route takes | The inbox `id`, for example `inb_7f820a77f64ea18174499945` — never the address |
| Find an inbox by its address | `GET /v1/inboxes?address=<address, bin slug or bin URL>` |
| Read what arrived | `GET /v1/inboxes/{id}/messages` (paid plans; free reads in the dashboard) |
| Delete an inbox | `DELETE /v1/inboxes/{id}` — permanent, and the address is never issued again |

## Email address or request bin? {#kinds}

Both are inboxes: they share one list, one API, one monthly allowance and one retention window. What differs is what they receive.

| | Email address | Request bin |
| --- | --- | --- |
| Receives | Email, over SMTP | Any HTTP request: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS` |
| You hand out | `address`, e.g. `ff25m3tue9vm@nninbox.com` | `bin_url`, e.g. `https://<bin domain>/b/gs2wr5bjw9m5` |
| Use it to test | Signup confirmations, password resets, one-time codes, receipts | Webhooks and callbacks your system sends: payment events, CI notifications, any outgoing HTTP |
| What is kept | Headers, text and HTML bodies, SPF/DKIM/DMARC verdicts, attachment names and sizes, any one-time code we find | Method, path, query, headers, body |
| Refused traffic | Refused during the SMTP conversation, so the sender is told | Always answered `200`, so a provider never disables your endpoint; refusals are counted on the bin |
| Phrase gate | Optional (always on, on free) — see [the phrase](/docs/product-inboxes/addresses#phrase) | None: a request has no subject |

Use the `address` and the `bin_url` exactly as the API returns them. Neither lives on `{{ROOT_DOMAIN}}`: addresses and bins each have a dedicated domain, so that disposable traffic never shares a reputation or a cookie scope with the domain your real mail and dashboard use.

**Inboxes or Webhooks?** A request bin is a disposable endpoint you create to see what *your* system sends. The Webhooks product receives production webhooks from providers, verifies them and delivers them to your endpoints. Its **Captured requests** view is a recording of what reached a Webhooks source, not a bin you create.

## How it works {#how}

1. **Create** an address or a bin — in the dashboard with **New address / request bin**, or with `POST /v1/inboxes`.
2. **Send** to it from the system under test: mail to the `address` (with the `phrase` in the subject, if the inbox has one), or an HTTP request to the `bin_url`.
3. **Read** what arrived. It shows up within seconds in the dashboard, and on paid plans at `GET /v1/inboxes/{id}/messages`.
4. **Delete** it when you are done, or let it expire.

The [quickstart](/docs/product-inboxes/quickstart) does all four with `curl`. Request bins have [their own page](/docs/product-inboxes/bins).

## How acceptance behaves {#acceptance}

Mail is refused at the door rather than accepted and hidden. A message is stored only if all of these hold:

- the recipient address is a live, enabled inbox;
- the **subject contains that inbox's phrase**, if it has one;
- the workspace is inside its monthly allowance;
- the message is no larger than 5 MiB.

Anything else is refused during the SMTP conversation, so the sending server is told and generates the bounce. A refused message is never stored and never counted against your usage.

A request bin cannot refuse that way. Answering a payment provider with a `4xx` gets your endpoint disabled at the provider, so a bin answers `200` even when it drops a request — because it is disabled or deleted, or over its share of the allowance. Requests dropped for the allowance are counted on the bin in the dashboard. See [Request bins](/docs/product-inboxes/bins#responses).

Accepted mail is sanitised before storage: HTML goes through an allow-list sanitiser, and the dashboard renders it in a sandboxed frame with remote images blocked until you ask for them. Anyone can mail a disposable address, so the content is treated as attacker-authored.

## Limits by plan {#limits}

| | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- |
| Email addresses at once | 1 | 5 | 25 | 250 |
| Request bins at once | 1 | 5 | 25 | 250 |
| Messages and requests per month | 1,000 | 25,000 | 250,000 | 5,000,000 |
| Of that, all bins together may use | 50% | 80% | 80% | 80% |
| Of that, one bin may use | 50% | 50% | 40% | 25% |
| Kept for (retention) | 1 day | 7 days | 30 days | 90 days |
| Address and bin lifetime | 24 hours | until deleted, or up to 7 days if you set one | until deleted, or up to 30 days | until deleted, or any lifetime |
| Phrase in the subject | always required | optional | optional | optional |
| Read over the API | no (dashboard only) | yes | yes | yes |
| Mail accepted per minute, per address | 60 | 300 | 1,200 | 6,000 |

Addresses and bins are counted separately: holding a bin never uses up an address, or the other way round. The bin shares exist so that a bin URL that leaks cannot use up the month and leave your email addresses refusing mail.

Size limits are the same on every plan:

| | Limit |
| --- | --- |
| One email | 5 MiB. Larger mail is refused, never truncated. |
| Text or HTML body of an email | 256K characters each are kept; the rest is cut and the message is marked `truncated: true`. |
| Attachments | Name, content type, size and digest are kept. The file itself is not stored, on any plan. |
| Request body sent to a bin | Up to 1 MiB is read and the first 64 KiB is kept; a longer body is marked `truncated: true`. |
| Requests to a bin | 120 per minute from one sender IP, 600 per minute to one bin. Over that, the sender gets `429` with `Retry-After`. |

## How an inbox ends {#lifecycle}

| | What happens | Can you undo it? |
| --- | --- | --- |
| **Disable** | The inbox stops accepting and keeps what it has. Mail to a disabled address is refused; a request to a disabled bin is answered `200` and not stored. | Yes — enable it again |
| **Delete** | The inbox and everything in it are deleted, and the address or slug is retired: it is never issued again, to you or anyone. | No |
| **Expiry** | At `expires_at`, the same as Delete. Only free inboxes (24 hours) and inboxes created with `expires_in_minutes` expire. | No |

Deleting is `DELETE /v1/inboxes/{id}`; older versions of these docs and the API's audit log call it *release*. A retired address is never reissued, deliberately: a recycled address would deliver a stranger's password reset to whoever held it next. [Addresses and the phrase](/docs/product-inboxes/addresses#lifecycle) has the details, including how expiry and retention interact.

## Reading over the API {#reading}

Messages are readable in the dashboard on every plan, including free. Reading them **programmatically** is what the paid plans add: `GET /v1/inboxes/{id}/messages` returns the parsed message or captured request, and for mail an `extracted` field carrying any one-time code we found — which is usually the only thing a test wants.

Every route takes the inbox `id`. The dashboard shows it on the inbox's card, with a copy button. If all you have is the address or the bin URL, look it up:

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes?address=ff25m3tue9vm@nninbox.com" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

The response is the usual list with at most one item. `GET /v1/inboxes` and `GET /v1/inboxes/{id}` return the `id`, `address`, `phrase` and `bin_url` together, so one call gives you everything needed to send and to read.

## Getting access {#access}

Register for Inboxes and you get a workspace on the free plan: one address and one bin at a time, 24-hour retention, and reading in the dashboard. Pricing is on the [Inboxes page](/inboxes).

Keys are not issued with the workspace, and the Inboxes API does not issue them. Mint one in your NimbusNexus account console under **API keys**, choosing **Inboxes** as the product — Identity is the single API-key issuer across the estate. A key is a JWT, so it begins `eyJ`. Present it as `Authorization: Bearer <key>` or `X-API-Key: <key>`.

Choose the scope when you mint it: `admin` can create, change and delete inboxes as well as read, `read` can only read. An Inboxes key cannot be confined to a single project.

> **An `inbx_…` key no longer authenticates.** Inboxes used to issue keys of its own with that prefix. If you hold one, mint a replacement in the account console.

## What it will not do {#not}

- **It does not send.** There is no send or relay API. An address that could originate mail would be a spam service.
- **It is not an archive.** Everything is deleted when its plan's retention runs out.
- **It does not forward yet.** Forwarding what arrives to a URL you own is planned and not built.
- **It does not route production webhooks.** A request bin records and stores; it delivers nothing onward. That is the Webhooks product.

## What's next {#next-steps}

- [Quickstart](/docs/product-inboxes/quickstart) — create an address and a bin, send to both, read them back.
- [Request bins](/docs/product-inboxes/bins) — the bin URL, what is captured, and why it always answers `200`.
- [Addresses and the phrase](/docs/product-inboxes/addresses) — the subject gate, expiry and retention.
