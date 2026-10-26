---
title: Inboxes
description: Disposable email addresses for testing — create one, point the system under test at it, and read what arrives in the dashboard or over the API.
publishedAt: 2026-08-18
updatedAt: 2026-10-26
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
| Read what arrived | `GET /v1/inboxes/{id}/messages` (paid plans; free reads in the dashboard) |
| Delete an inbox | `DELETE /v1/inboxes/{id}` — permanent, and the address is never issued again |
| Every route, with examples | The [Inboxes API reference](/docs/reference/inboxes) |

## How it works {#how}

1. **Create** an address — in the dashboard with **New address**, or with `POST /v1/inboxes`.
2. **Send** mail to it from the system under test, with the inbox's `phrase` in the subject if it has one.
3. **Read** what arrived. It shows up within seconds in the dashboard, and on paid plans at `GET /v1/inboxes/{id}/messages`.
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
| Addresses at once | 1 | 5 | 25 | 250 |
| Messages per month | 1,000 | 25,000 | 250,000 | 5,000,000 |
| Kept for (retention) | 1 day | 7 days | 30 days | 90 days |
| Address lifetime | 24 hours | until deleted, or up to 7 days if you set one | until deleted, or up to 30 days | until deleted, or any lifetime |
| Phrase in the subject | always required | optional | optional | optional |
| Read over the API | no (dashboard only) | yes | yes | yes |
| Mail accepted per minute, per address | 60 | 300 | 1,200 | 6,000 |

Size limits are the same on every plan:

| | Limit |
| --- | --- |
| One email | 5 MiB. Larger mail is refused, never truncated. |
| Text or HTML body | 256K characters each are kept; the rest is cut and the message is marked `truncated: true`. |
| Attachments | Name, content type, size and digest are kept. The file itself is not stored, on any plan. |

## How an address ends {#lifecycle}

| | What happens | Can you undo it? |
| --- | --- | --- |
| **Disable** | The address stops accepting mail and keeps what it has; mail sent to it is refused. | Yes — enable it again |
| **Delete** | The address and its mail are deleted, and the address is retired: it is never issued again, to you or anyone. | No |
| **Expiry** | At `expires_at`, the same as Delete. Only free addresses (24 hours) and addresses created with `expires_in_minutes` expire. | No |

Deleting is `DELETE /v1/inboxes/{id}`; older versions of these docs and the API's audit log call it *release*. A retired address is never reissued, deliberately: a recycled address would deliver a stranger's password reset to whoever held it next. [Addresses and the phrase](/docs/product-inboxes/addresses#lifecycle) has the details, including how expiry and retention interact.

## Reading over the API {#reading}

Messages are readable in the dashboard on every plan, including free. Reading them **programmatically** is what the paid plans add: `GET /v1/inboxes/{id}/messages` returns the parsed message, both body parts, the authentication verdicts, and an `extracted` field carrying any one-time code we found — which is usually the only thing a test wants.

Every route takes the inbox `id`. The dashboard shows it on the address's card, with a copy button. If all you have is the address, look it up:

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes?address=ff25m3tue9vm@nninbox.com" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

The response is the usual list with at most one item. `GET /v1/inboxes` and `GET /v1/inboxes/{id}` return the `id`, `address` and `phrase` together, so one call gives you everything needed to send and to read.

## Getting access {#access}

Register for Inboxes and you get a workspace on the free plan: one address at a time, 24-hour retention, and reading in the dashboard. Pricing is on the [Inboxes page](/inboxes).

Keys are not issued with the workspace, and the Inboxes API does not issue them. Mint one in your NimbusNexus account console under **API keys**, choosing **Inboxes** as the product — Identity is the single API-key issuer across the estate. A key is a JWT, so it begins `eyJ`. Present it as `Authorization: Bearer <key>` or `X-API-Key: <key>`.

Choose the scope when you mint it: `admin` can create, change and delete addresses as well as read, `read` can only read. An Inboxes key cannot be confined to a single project.

> **An `inbx_…` key no longer authenticates.** Inboxes used to issue keys of its own with that prefix. If you hold one, mint a replacement in the account console.

## What it will not do {#not}

- **It does not send.** There is no send or relay API. An address that could originate mail would be a spam service.
- **It is not an archive.** A message is deleted when the plan's retention runs out, and everything in an address goes when the address is deleted or expires.
- **It does not forward yet.** Forwarding what arrives to a URL you own is planned and not built.
- **It does not capture HTTP.** An inbox only ever receives mail. For webhooks and other HTTP requests, use [Request Bins](/docs/product-bins), whose URLs record any request sent to them.

## What's next {#next-steps}

- [Quickstart](/docs/product-inboxes/quickstart) — create an address, send it a message, read it back.
- [Addresses and the phrase](/docs/product-inboxes/addresses) — the subject gate, expiry and retention.
- [Inboxes API reference](/docs/reference/inboxes) — every route, with the request in curl, TypeScript, Python or Go.
