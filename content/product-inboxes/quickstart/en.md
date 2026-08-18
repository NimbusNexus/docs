---
title: Inboxes quickstart
description: Allocate a disposable address, send it a message, and read the message back — three requests.
publishedAt: 2026-08-18
updatedAt: 2026-08-18
kind: quickstart
---

# Inboxes quickstart

From nothing to a message you can assert on. You will allocate an address, send real mail to it, and read it back with its extracted one-time code.

You need an API key for a workspace on a paid plan. **Programmatic reads are a paid feature** — on the free plan the dashboard shows your mail but the message routes refuse with `not_entitled`, so this quickstart needs Starter or above. The [product overview](/docs/product-inboxes#access) covers plans.

Every path below is relative to `{{INBOXES_BASE_URL}}`, and every request carries `Authorization: Bearer <your key>`.

## 1. Allocate an address {#allocate}

```bash
curl -X POST {{INBOXES_BASE_URL}}/v1/inboxes \
  -H "Authorization: Bearer $INBOXES_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

```json
{
  "id": "inb_7f820a77f64ea18174499945",
  "address": "ff25m3tue9vm@nninbox.com",
  "phrase": "nn-re89dr",
  "status": "enabled",
  "expires_at": "2026-08-19T04:37:50Z"
}
```

Three fields matter. `address` is what you give the system under test. `phrase` **must appear in the subject** of anything sent to that address or it is refused — that is the whole reason a public disposable address cannot be used to sign up for things. `expires_at` is when the address is tombstoned and its mail deleted.

Keep `id`; every later call uses it.

## 2. Send it a message {#send}

Nothing NimbusNexus-specific here — send from whatever you are testing. The only rule is the subject:

```text
To:      ff25m3tue9vm@nninbox.com
Subject: nn-re89dr Your verification code
```

A subject without the phrase is refused during the SMTP conversation. Your sender is told, and nothing is stored — so a missing message here is a real refusal, not a silent drop.

## 3. Read it back {#read}

```bash
curl {{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945/messages \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

```json
{
  "items": [
    {
      "id": "msg_bd160c0bcf8db20fba4e535d",
      "from_addr": "noreply@example.test",
      "subject": "nn-re89dr Your verification code",
      "received_at": "2026-08-18T09:12:04Z",
      "extracted": { "otp": "100017" }
    }
  ]
}
```

`extracted.otp` is the point. A test asserting on a signup flow usually wants exactly one thing — the code — and it is on the list response, so the common case needs no second request.

For the full message, including both body parts and the SPF/DKIM/DMARC verdicts:

```bash
curl {{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945/messages/msg_bd160c0bcf8db20fba4e535d \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

## Polling, not pushing {#polling}

There is no stream and no callback. Mail arrives within seconds of the sender releasing it, so poll the list route — a short interval for a few seconds is enough, and it is what the dashboard itself does.

Do not poll a fixed number of times and assert on the last one. Assert that the message *appears*, with a timeout, or a slow sender will look like a broken one.

## Cleaning up {#cleanup}

Addresses expire on their own; you rarely need to do anything. When a test finishes early and you want the slot back — the free and Starter plans cap how many addresses you may hold at once — release it:

```bash
curl -X DELETE {{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945 \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

Releasing is **permanent and irreversible**: the address is tombstoned and can never be issued again, to you or anyone. That is deliberate — a recycled disposable address would deliver a stranger's mail into your inbox. To pause an address instead, `PATCH` it to `disabled` and enable it again later.

## What's next {#next-steps}

- [Addresses and the phrase](/docs/product-inboxes/addresses) — the acceptance rules in full, and how expiry interacts with retention.
- [Product overview](/docs/product-inboxes) — what the product does and does not do.
