---
title: Inboxes quickstart
description: Create a disposable email address, send it a message, and read the message back — in the dashboard or with curl.
publishedAt: 2026-08-18
updatedAt: 2026-10-27
kind: quickstart
---

# Inboxes quickstart

From nothing to something you can assert on. You will create an inbox, send real mail to its address and read back its one-time code.

## Before you start {#before}

- **In the dashboard, on any plan.** Open Inboxes, choose **Create an inbox**, then **Create inbox**: the label is optional, and the lifetime starts at your plan's default. The new inbox's page shows exactly what to send to, each with a copy button: the address, and its phrase if it has one. What arrives appears in the list below within seconds. That is the whole flow on the free plan.
- **Over the API, on a paid plan.** Reading programmatically needs Starter or above — on free the message routes answer `not_entitled`. You also need an API key minted in the account console with **Inboxes** as the product; see [Getting access](/docs/product-inboxes#access).

Every path below is relative to `{{INBOXES_BASE_URL}}`, and every request carries `Authorization: Bearer <your key>`.

## 1. Create an inbox {#allocate}

```bash
curl -X POST {{INBOXES_BASE_URL}}/v1/inboxes \
  -H "Authorization: Bearer $INBOXES_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phrase": true}'
```

```json
{
  "id": "inb_7f820a77f64ea18174499945",
  "address": "ff25m3tue9vm@nninbox.com",
  "transport": "email",
  "phrase": "nn-re89dr",
  "status": "enabled",
  "expires_at": null
}
```

Three fields matter:

- **`address`** is what you give the system under test.
- **`phrase`** must appear in the subject of anything sent to that address, or the mail is refused — that is what stops a leaked address being used to sign up for things. On a paid plan the phrase is opt-in: without `"phrase": true` you get `"phrase": ""` and the address accepts any subject.
- **`id`** is what every later call takes. Keep it.

`expires_at` is `null` because a paid address lives until you delete it; send `expires_in_minutes` to get one that expires on its own.

`transport` is always `"email"`, because an inbox only receives mail. `POST /v1/inboxes` takes `"transport": "email"` or no `transport` at all; any other value, such as `"http"`, is refused with a `422` `validation_error`. To record HTTP requests, use [Request Bins](/docs/product-bins).

## 2. Send it a message {#send}

Nothing NimbusNexus-specific here — send from whatever you are testing. The only rule is the subject:

```text
To:      ff25m3tue9vm@nninbox.com
Subject: nn-re89dr Your verification code
```

A subject without the phrase is refused during the SMTP conversation. Your sender is told, and nothing is stored — so a missing message here is a real refusal, not a silent drop.

## 3. Read it back {#read}

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945/messages?extract=otp" \
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
  ],
  "next_offset": null,
  "next_until": null
}
```

`extracted.otp` is the point. A test asserting on a signup flow usually wants exactly one thing — the code — and `?extract=otp` puts it on the list response, so the common case needs no second request. Without `extract`, `extracted` is `null`; `extract=links` returns the message's links instead, and `extract=all` returns both.

To find one message among many, search the list: `q=verification` keeps the messages that contain the text, and `in=subject` (or `from`, `headers` or `body`) narrows where it looks. A search pages by `next_until` rather than `next_offset`; [Searching messages](/docs/product-inboxes#search) has every parameter.

For the full message, including both body parts, the SPF/DKIM/DMARC verdicts and the headers:

```bash
curl {{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945/messages/msg_bd160c0bcf8db20fba4e535d \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

**Only have the address?** Look the inbox up to get its `id`:

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes?address=ff25m3tue9vm@nninbox.com" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

## Polling, not pushing {#polling}

There is no stream and no callback. Mail arrives within seconds, so poll the list route — a short interval for a few seconds is enough, and it is what the dashboard itself does.

Do not poll a fixed number of times and assert on the last one. Assert that the message *appears*, with a timeout, or a slow sender will look like a broken one.

## Cleaning up {#cleanup}

A paid address never expires unless you created it with `expires_in_minutes`, and every plan caps how many you may hold at once — so delete it when you are done:

```bash
curl -X DELETE {{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945 \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

Deleting is **permanent**: the inbox and what it holds are deleted, and the address is retired so it can never be issued again, to you or anyone. That is deliberate — a recycled disposable address would deliver a stranger's mail into your inbox. To pause one instead, `PATCH` it to `{"status": "disabled"}` and enable it again later. In the dashboard, both are in the ⋯ menu on the inbox's page: **Delete inbox…** and **Disable**.

## What's next {#next-steps}

- [Addresses and the phrase](/docs/product-inboxes/addresses) — the acceptance rules in full, and how expiry interacts with retention.
- [Product overview](/docs/product-inboxes) — every limit by plan, and what the product does not do.
- [Inboxes API reference](/docs/reference/inboxes) — every route, with the request in curl, TypeScript, Python or Go.
