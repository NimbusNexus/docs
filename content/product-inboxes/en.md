---
title: Inboxes
description: Disposable email addresses for testing — create one, point the system under test at it, and read what arrives in the dashboard or over the API.
publishedAt: 2026-08-18
updatedAt: 2026-10-27
kind: concept
---

# Inboxes

NimbusNexus Inboxes gives you throwaway **email addresses** that accept real mail. You create one, point a signup form or a test suite at it, and read what arrived in the dashboard or over the REST API.

> **Not the page you wanted?** Inboxes only ever receives email. To *send* mail from your application, this is not the product. To capture **HTTP requests** — a provider's webhooks, or what your own app sends — use [Request Bins](/docs/product-bins).

## At a glance {#at-a-glance}

| | |
| --- | --- |
| What you create | An **inbox**: a disposable email address |
| API base URL | `{{INBOXES_BASE_URL}}` |
| Authentication | `Authorization: Bearer <key>`, a key minted in the account console with **Inboxes** as the product |
| Identifier every route takes | The inbox `id`, for example `inb_7f820a77f64ea18174499945` — never the address |
| Find an inbox by its address | `GET /v1/inboxes?address=<address>` |
| Read what arrived | `GET /v1/inboxes/{id}/messages`, or `GET /v1/messages` for every inbox at once (paid plans; free reads in the dashboard) |
| Search what arrived | `q` on either list, narrowed with `in` or `header` ([Searching messages](#search)) |
| Delete an inbox | `DELETE /v1/inboxes/{id}` — permanent, and the address is never issued again |
| Every route, with examples | The [Inboxes API reference](/docs/reference/inboxes) |

## How it works {#how}

1. **Create** an inbox — in the dashboard with **Create an inbox**, or with `POST /v1/inboxes`.
2. **Send** mail to its address from the system under test, with the inbox's `phrase` in the subject if it has one.
3. **Read** what arrived. It shows up within seconds in the dashboard, and on paid plans at `GET /v1/inboxes/{id}/messages`. To find one message among many, search the subjects, senders, headers and bodies: **Search** above the list in the dashboard, `q` in the API ([Searching messages](#search)). **All inboxes** in the dashboard, and `GET /v1/messages` in the API, list what arrived at every inbox at once.
4. **Delete** it when you are done, or let it expire.

The [quickstart](/docs/product-inboxes/quickstart) does all four with `curl`.

Use the `address` exactly as the API returns it. Addresses live on a dedicated domain, not on `{{ROOT_DOMAIN}}`, so that disposable traffic never shares a reputation with the domain your real mail uses.

## How acceptance behaves {#acceptance}

Mail is refused at the door rather than accepted and hidden. A message is stored only if all of these hold:

- the recipient address is a live, enabled inbox;
- the **subject contains that inbox's phrase**, if it has one;
- the workspace is inside its monthly allowance;
- the message is no larger than 5 MiB.

Anything else is refused during the SMTP conversation, so the sending server is told and generates the bounce. A refused message is never stored and never counted against your usage.

Accepted mail is sanitised before storage: HTML goes through an allow-list sanitiser, and the dashboard renders it in a sandboxed frame with remote images blocked until you ask for them. Anyone can mail a disposable address, so the content is treated as attacker-authored.

## Limits by plan {#limits}

| | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- |
| Inboxes at once | 1 | 5 | 25 | 250 |
| Messages per month | 1,000 | 25,000 | 250,000 | 5,000,000 |
| Kept for (retention) | 1 day | 7 days | 30 days | 90 days |
| Inbox lifetime | 24 hours | until deleted, or up to 7 days if you set one | until deleted, or up to 30 days | until deleted, or any lifetime |
| Phrase in the subject | always required | optional | optional | optional |
| Read over the API | no (dashboard only) | yes | yes | yes |
| Mail accepted per minute, per inbox | 60 | 300 | 1,200 | 6,000 |

Size limits are the same on every plan:

| | Limit |
| --- | --- |
| One email | 5 MiB. Larger mail is refused, never truncated. |
| Text or HTML body | 256K characters each are kept; the rest is cut and the message is marked `truncated: true`. |
| Attachments | Name, content type, size and digest are kept. The file itself is not stored, on any plan. |

## How an inbox ends {#lifecycle}

| | What happens | Can you undo it? |
| --- | --- | --- |
| **Disable** | The inbox stops accepting mail and keeps what it has; mail sent to it is refused. | Yes — enable it again |
| **Delete** | The inbox and its mail are deleted, and its address is retired: it is never issued again, to you or anyone. | No |
| **Expiry** | At `expires_at`, the same as Delete. Every free inbox expires, after 24 hours at most; on a paid plan, only an inbox created with a lifetime does. | No |

In the dashboard, the ⋯ menu on an inbox's page holds **Rename…**, **Disable** or **Enable**, **Empty inbox…**, which deletes its mail and keeps the inbox, and **Delete inbox…**. Deleting is `DELETE /v1/inboxes/{id}`; older versions of these docs and the API's audit log call it *release*. A retired address is never reissued, deliberately: a recycled address would deliver a stranger's password reset to whoever held it next. [Addresses and the phrase](/docs/product-inboxes/addresses#lifecycle) has the details, including how expiry and retention interact.

## Reading over the API {#reading}

Messages are readable in the dashboard on every plan, including free. Reading them **programmatically** is what the paid plans add: `GET /v1/inboxes/{id}/messages` lists an inbox's messages, newest first, with each one's sender, subject and authentication verdicts, and with `extract=otp` an `extracted` field carrying any one-time code we found — which is usually the only thing a test wants. `GET /v1/messages` lists the messages of every inbox in the workspace in one list, each with its `inbox_id`. `GET /v1/inboxes/{id}/messages/{message_id}` returns one message in full: both body parts, its attachments' details and its [headers](#headers).

Every route takes the inbox `id`. The dashboard shows it on the inbox's page, beside **ID**, with a copy button. If all you have is the address, look it up:

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes?address=ff25m3tue9vm@nninbox.com" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

The response is the usual list with at most one item. `GET /v1/inboxes` and `GET /v1/inboxes/{id}` return the `id`, `address` and `phrase` together, so one call gives you everything needed to send and to read.

## Searching messages {#search}

Both message lists take a search, `GET /v1/inboxes/{id}/messages` for one inbox and `GET /v1/messages` for all of them. The dashboard's **Search** box above each list sends the same parameters:

| Parameter | What |
| --- | --- |
| `q` | Only messages containing this text, up to 200 characters, ignoring case. |
| `in` | Where `q` looks: `all`, the default, or only `subject`, `from` (the sender, as its From header reads), `headers` (each one as `name: value`) or `body` (the text body, or for an email with only an HTML body, the text of its HTML). |
| `header` | Only this header's values, its name in any case, and any of them when the header arrived more than once. Without `q`, every message that carries the header. It goes with `in` `all` or `headers`. |

```bash
curl -G "{{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945/messages" \
  --data-urlencode "q=verification code" \
  --data-urlencode "in=subject" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

`since`, `until`, `extract` and `limit` work with a search as they do without one. A `header` with `in` set to `subject`, `from` or `body` is refused with a `422` `validation_error` whose entry has the type `inboxes.search_conflict`.

A search pages differently from the plain list. It reads the messages newest first and stops when it has `limit` matches or has read 16 MiB of mail (or 5,000 messages), whichever comes first, so a page can hold fewer matches than `limit`, or none, while older messages are still unread. A search's page has `next_offset` `null` and, until the search has read the list's oldest message, a `next_until`: pass it back as `until`, with the same search and `since`, to search on from where it stopped. With a search, `offset` skips that many messages before the search starts reading. Without a search, `next_until` is always `null`, and the list pages by `next_offset`.

A search of the headers finds only mail that arrived after Inboxes began keeping headers ([Headers](#headers)).

## Headers {#headers}

`GET /v1/inboxes/{id}/messages/{message_id}` carries the email's header lines as `headers`: objects with a `name` and a `value`, in the order they arrived, duplicates kept, each value unfolded and its encoded words (RFC 2047) decoded. Up to 256 lines are kept, a name is cut at 256 characters, and a value at 8,192. The lists don't carry headers. In the dashboard, they are in the message's **Headers** section.

`headers` is `null` for an email that arrived before Inboxes began keeping headers: they weren't kept for it, and can't be added later. The raw email isn't kept, only its parsed parts.

## Getting access {#access}

Register for Inboxes and you get a workspace on the free plan: one inbox at a time, 24-hour retention, and reading in the dashboard. Pricing is on the [Inboxes page](/inboxes).

Keys are not issued with the workspace, and the Inboxes API does not issue them. Mint one in your NimbusNexus account console under **API keys**, choosing **Inboxes** as the product — Identity is the single API-key issuer across the estate. A key is a JWT, so it begins `eyJ`. Present it as `Authorization: Bearer <key>` or `X-API-Key: <key>`.

Choose the scope when you mint it: `admin` can create, change, empty and delete inboxes as well as read, `read` can only read. An Inboxes key cannot be confined to a single project.

> **An `inbx_…` key no longer authenticates.** Inboxes used to issue keys of its own with that prefix. If you hold one, mint a replacement in the account console.

## What it will not do {#not}

- **It does not send.** There is no send or relay API. An address that could originate mail would be a spam service.
- **It is not an archive.** A message is deleted when the plan's retention runs out, and everything in an address goes when the address is deleted or expires.
- **It does not forward yet.** Forwarding what arrives to a URL you own is planned and not built.
- **It does not capture HTTP.** An inbox only ever receives mail. For webhooks and other HTTP requests, use [Request Bins](/docs/product-bins), whose URLs record any request sent to them.

## What's next {#next-steps}

- [Quickstart](/docs/product-inboxes/quickstart) — create an inbox, send it a message, read it back.
- [Addresses and the phrase](/docs/product-inboxes/addresses) — the subject gate, expiry and retention.
- [Inboxes API reference](/docs/reference/inboxes) — every route, with the request in curl, TypeScript, Python or Go.
