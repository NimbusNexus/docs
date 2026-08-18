---
title: Inboxes (product)
description: Disposable email addresses for testing — allocate an address, receive real mail at it, and read it back over an API.
publishedAt: 2026-08-18
updatedAt: 2026-08-18
kind: concept
---

# Inboxes (product)

NimbusNexus Inboxes gives you throwaway email addresses that accept real mail. You allocate an address, point a signup form or a test suite at it, and read what arrives over a REST API — then let it expire and take everything in it with it.

> **Not the page you wanted?** If you are here to *send* mail from your application, that is not this product. Inboxes only ever receives. It has no send API and no relay, deliberately — see [What it will not do](#not).

## What it is for {#what-for}

Testing anything that mails a user is awkward. A signup flow sends a confirmation link, a password reset sends a code, a checkout sends a receipt — and asserting on any of that means a real mailbox, reachable by a machine, that does not fill up with the last thousand runs.

The usual workarounds are all bad in the same way. A shared team mailbox turns parallel CI runs into a race. A catch-all domain you run yourself is a spam magnet the moment it is discovered. A plus-addressed personal account leaks test traffic into somebody's inbox and cannot be read programmatically.

This product is a mailbox per test: allocated in one request, readable over an API, and gone when it expires.

## The objects {#objects}

| Object | What it is |
| --- | --- |
| **Inbox** | An allocated address plus its settings. Has a **phrase**, an expiry, and a status. Addresses live on a dedicated inbox domain, not on your own. |
| **Phrase** | A short token issued with the address that must appear in a message's **subject** for that message to be accepted. See [Addresses and the phrase](/docs/product-inboxes/addresses). |
| **Message** | One accepted email: headers, an HTML part and a text part, authentication verdicts, and any code we could extract from it. |
| **API key** | The credential for programmatic reads. Distinct from the browser session the dashboard uses. |

## How acceptance behaves {#acceptance}

Mail is refused at the door rather than accepted and hidden. A message is stored only if all of these hold:

- the recipient address is a live, enabled inbox;
- the **subject contains that inbox's phrase**;
- the inbox is inside its monthly message allowance;
- the message is inside the size cap.

Anything else is refused during the SMTP conversation, so the sender is told. A refused message is never stored and never counted against your usage — which also means an empty inbox and a refused delivery look different, because the refusal reached the sender.

Accepted messages are sanitised before storage: HTML is run through an allow-list sanitiser, and the dashboard renders it in a sandboxed frame with remote images blocked until you ask for them. The content is attacker-authored by definition — anyone can mail a disposable address — so it is treated that way.

## Reading messages {#reading}

Messages are readable in the dashboard on every plan, including free. Reading them **programmatically** is what the paid plans sell: the API returns the parsed message, both body parts, the authentication verdicts, and an `extracted` field carrying any one-time code we found — which is usually the only thing a test actually wants.

Retention is the other paid differentiator. A message is readable for the retention window of its plan and is then deleted, permanently. That is a real delete, not an archive flag: a swept message and a message that never arrived are indistinguishable afterwards, so a test that asserts on mail older than its retention window will fail in a way that looks like a delivery problem.

## What it will not do {#not}

Being explicit, because each of these is a reasonable thing to expect:

- **It does not send.** There is no send or relay API. An address that could originate mail is a spam service.
- **It is not a mailbox you keep.** Addresses expire. Custom or long-lived addresses are a contract conversation, not a plan.
- **It does not forward yet.** Forwarding an accepted message to a URL you own is planned and not built. Nothing you can buy today includes it.

## Getting access {#access}

The [playground](/inboxes) gives you an address with no account at all — one address, thirty minutes, no API. It is the fastest way to see the acceptance rules behave.

Beyond that, register for Inboxes and you get a workspace on the free plan: one address at a time, a 24-hour retention window, and dashboard reading. Programmatic access arrives with a paid plan; pricing is on the [Inboxes page](/inboxes).

## What's next {#next-steps}

- [Quickstart](/docs/product-inboxes/quickstart) — allocate an address, send it a message, read it back.
- [Addresses and the phrase](/docs/product-inboxes/addresses) — why the subject gate exists and how expiry works.
