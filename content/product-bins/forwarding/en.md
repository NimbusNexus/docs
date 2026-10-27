---
title: Forwarding
description: A bin can send each request it records on to your own server and keep what your server answered — what is sent, the retries, the limits, and the address forwards come from.
publishedAt: 2026-10-26
updatedAt: 2026-10-26
kind: concept
---

# Forwarding

Give a bin a forward URL and every request it records is also sent on to your own server, as it arrived. The sender still gets the bin's `200` at once. The bin sends the request on by itself, tries again when your server fails, and keeps your server's answer beside the request, so one place shows what a sender sent and what your endpoint made of it.

## Who can forward, and where to {#target}

Forwarding comes with Starter, Pro and Custom. On Free, setting a forward URL answers `402` `not_entitled`, with `details.feature` `forwarding`.

A bin forwards to one URL, and that URL must be:

- **https**, on any port. The certificate is checked against the URL's host name.
- **Without a user name or password.**
- **On the public internet.** Every address its host resolves to must be public: a private, loopback, link-local or otherwise reserved address is refused, and so is a host that doesn't resolve.
- **Not ours.** `nnbin.net`, `nimbusnexus.net` and every name under them are refused, as is any name that resolves to one of our own addresses: a bin can't forward into a bin, or into NimbusNexus's own services.
- **At most 2,048 characters long.**

The URL is checked when you set it and again before every send, and each send goes only to the addresses that check found, so a DNS change in between can't point it anywhere else. Redirects aren't followed: a `3xx` answer is kept as your server's answer and counts as sent, since a redirect could lead anywhere the check never saw.

Each request's path and query are added to the forward URL. With the forward URL `https://api.example.com/hooks`, a request to `https://nnbin.net/b/k7xq2mbn9tfa/stripe/events?x=1` goes to `https://api.example.com/hooks/stripe/events?x=1`. A request to the bare bin URL goes to the forward URL as you set it, and a query string the forward URL carries comes first.

Set the URL with **Set up forwarding** on the bin's **Forwarding** card in the console, or with `forward_url` on `PATCH /v1/bins/{id}`:

```bash
curl -X PATCH https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17 \
  -H "Authorization: Bearer $BINS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"forward_url": "https://api.example.com/hooks"}'
```

The answer is the bin, with `forward_url` set. **Stop forwarding** on the card, or `"forward_url": null`, turns it off. Setting the URL takes the member role, or a key with **Read & write**. A URL that breaks one of the rules above is refused with `422`, and the [reference](/docs/product-bins/reference#forwarding) lists each reason.

## Checking the URL first {#test}

**Send a test** on the Forwarding card, or `POST /v1/bins/{id}/forward-test`, sends your server a small JSON event now and shows what it answered, so you know the URL works before real traffic depends on it:

```bash
curl -X POST https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17/forward-test \
  -H "Authorization: Bearer $BINS_API_KEY"
```

```json
{
  "ok": true,
  "answer": {
    "status": 200,
    "headers": [
      {"name": "content-type", "value": "text/plain"}
    ],
    "body_base64": "b2s=",
    "truncated": false
  },
  "duration_ms": 142,
  "error": ""
}
```

Your server receives a `POST` whose body is `{"type":"request_bins.forward_test","bin":"<slug>","sent_at":"<when>"}`, with `Content-Type: application/json`, `User-Agent: NimbusNexus-Request-Bins (forward test)`, `X-Request-Bins-Request: test`, and the `Via` and `X-Forwarded-Host` every forward carries. `ok` is `true` for a `2xx` or `3xx` answer. When no answer comes, `answer` is `null` and `error` says why, such as a timeout. A bin can send 10 tests a minute.

## What is sent {#sent}

A forward is the request as the bin recorded it:

- **the method**, whichever it was;
- **the body, byte for byte**;
- **the headers, in the order they arrived**, less the ones below, then ours.

**Dropped**, because they belong to one connection or one hop rather than to the request: `Connection` and every header it names, `Keep-Alive`, `Proxy-Connection`, `Proxy-Authenticate`, `TE`, `Trailer`, `Transfer-Encoding` and `Upgrade`; `Host`, which becomes your server's, and `Content-Length`, which is counted again; and `X-Real-IP`, `X-Forwarded-Proto`, `X-Forwarded-Host`, `CDN-Loop` and every `CF-*` header, which describe an earlier hop; the forward sets its own `X-Forwarded-Proto` and `X-Forwarded-Host`. A sender's own `X-Request-Bins-Request` is dropped too, so the one your server reads is ours.

**Not forwarded: credentials.** `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` and `X-Api-Key` never leave the bin. A bin URL is public, so a bin replaces these values with `[redacted]` before anything is stored, and nothing a sender put in them is kept, not even for the moment a forward would need it. Signature headers, such as `Stripe-Signature` or `X-Hub-Signature-256`, aren't credentials and are forwarded. The body is unchanged, so they still verify, though a retry can arrive after a timestamped signature's tolerance has run out. The cost: a server that authenticates its caller with one of the five headers refuses forwarded requests.

**Added**, after the sender's headers:

| Header | Value |
| --- | --- |
| `X-Forwarded-For` | The sender's own `X-Forwarded-For` entries, if it sent any, then the sender's address, the request's `source_ip`. |
| `Forwarded` | The sender's own `Forwarded` elements, then ours: `for=<sender>;proto=https;host=nnbin.net`. |
| `Via` | `1.1 nnbin.net`, after any `Via` the sender's own proxies added. |
| `X-Forwarded-Proto` | `https` |
| `X-Forwarded-Host` | `nnbin.net` |
| `X-Request-Bins-Request` | The request's `id`, such as `req_8d2e6b1f4a9c3e7d5b0f2a61`, so your server's logs lead back to it. |

## Delivery and retries {#delivery}

The sender gets `200` and `{"status":"accepted"}` at once, as from any bin, whatever your server does, and never sees your server's answer. The bin sends the forward by itself, usually within seconds of recording the request.

An attempt times out when your server takes more than 10 seconds to accept the connection, or more than 10 seconds to answer. What happens next depends on how the attempt ended:

| The attempt ended with | What happens |
| --- | --- |
| A `2xx` or `3xx` answer | Sent. A redirect isn't followed. |
| A connection error, a timeout, `408`, `429` or a `5xx` | Tried again, until the plan's attempts are used up. |
| Any other `4xx` | Failed at once: sending the same request again won't change a `400` or a `404`. |
| A forward URL that no longer passes [the checks](#target) | Failed at once. |

A failed attempt is tried again 30 seconds later, then 2 minutes, 10 minutes and 30 minutes after each attempt that follows, until the plan's attempts are used up: 3 on Starter, so the last comes about two and a half minutes after the first, and 5 on Pro and Custom, about 43 minutes after. When a `408`, `429` or `5xx` answer carries `Retry-After` asking for a longer wait, the bin waits that long instead, up to an hour.

Before every attempt, the bin checks again that it may send. A forward is dropped, as not forwarded, once the bin has been deleted or suspended, forwarding has been stopped or [paused](#paused), the workspace has been suspended, or the plan no longer includes forwarding. A forward goes to the URL that was set when its request arrived, so changing the URL doesn't move forwards that are already waiting.

Only requests that arrive while a bin forwards are sent: turning forwarding on sends nothing the bin recorded before. Every request is forwarded on its own, so a request sent twice is recorded twice and forwarded twice. Requests aren't kept in order: one that is retried can reach your server after one that arrived later.

## Seeing what happened {#forwards}

In the console, open a request. Its **Forwarding** section shows where it went and how it stands (**Queued**, **Sending**, **Sent**, **Retrying**, **Failed**, or **Not forwarded** with the reason), the attempts so far, the last error, and your server's answer: its status, its headers and the first 8 KiB of its body. The bin's Forwarding card shows the last send that failed.

Over the API, `GET /v1/requests/{id}` lists the request's forwards in `forwards`, the newest first. One of them:

```json
{
  "id": "fwd_5a1e8c3b7d2f9a4e6c0b1d83",
  "state": "sent",
  "reason": "",
  "url": "https://api.example.com/hooks/orders?source=quickstart",
  "attempts": 1,
  "max_attempts": 3,
  "next_attempt_at": null,
  "last_error": "",
  "answer": {
    "status": 200,
    "headers": [
      {"name": "content-type", "value": "application/json"}
    ],
    "body_base64": "eyJyZWNlaXZlZCI6dHJ1ZX0=",
    "truncated": false
  },
  "duration_ms": 142,
  "created_at": "2026-10-26T09:12:04Z",
  "sent_at": "2026-10-26T09:12:05Z"
}
```

The [reference](/docs/product-bins/reference#forwards) has every field, state and reason. Your server's answer is kept as long as the request, and deleted with it. On the bin, `forward_last_error` and `forward_last_error_at` say what went wrong with the last send that failed, such as `HTTP 503` or a timeout, and never what the request held.

## Limits {#limits}

| | Starter | Pro | Custom |
| --- | --- | --- | --- |
| Largest body forwarded | 256 KiB | 1 MiB | 1 MiB |
| Forwards a minute, per bin | 60 | 300 | 600 |
| Attempts per request | 3 | 5 | 5 |

- **A larger body is recorded and not forwarded**, with the reason `body_too_large`. So is a body over 1 MiB on any plan, since a bin stores only its first 1 MiB ([What a bin records](/docs/product-bins/reference#edge-records)).
- **Past a bin's forwards a minute**, forwards wait their turn. None is dropped for it.
- **A bin holds at most 1,000 forwards that haven't finished**: queued, being sent, or waiting to be tried again. A request that arrives while it holds that many is recorded and not forwarded, with the reason `queue_full`.
- **The forward URL with a request's path and query added** must fit in 8,192 characters, or the request isn't forwarded (`url_too_long`).
- **Forwarding costs no requests of its own.** A forwarded request counts once toward the month's requests, when it is recorded, and its attempts don't count. A request the bin didn't record, because the month's requests were used up or the bin was suspended, isn't forwarded either.

## When forwarding pauses {#paused}

When your server keeps failing, the bin stops sending to it: forwarding pauses after 20 failed attempts in a row, or after an hour in which every attempt failed. One attempt that succeeds starts both counts again.

While forwarding is paused, the bin keeps recording but sends nothing: each request that arrives, and each forward that was waiting, is marked not forwarded, with the reason `paused`, and none of them is sent later. The bin shows when and why it paused: **Paused** on its Forwarding card, and `forward_paused_at` and `forward_paused_reason` (`failed_in_a_row` or `failing_for_an_hour`) in the API.

**The workspace is told**, once for each pause, the way it is told about its month's requests: by email, which goes to the workspace owner unless you choose another address, and by a webhook if you set one up. Both are under **Notifications** in your account console. Resuming sends nothing.

The email, "Request Bins: forwarding was paused on one of your bins", names the bin by its label and URL, and the host it forwarded to, never the path or query. It says why the bin paused, with the last error, and that requests are still recorded but none is forwarded, so the ones recorded meanwhile won't be forwarded later. It ends with how to resume.

The webhook's event type is `bind.forwarding.paused`, and its body is:

```json
{
  "type": "bind.forwarding.paused",
  "workspace_id": "{{WORKSPACE_ID}}",
  "data": {
    "bin_id": "bin_3f9a1c7e5b2d8f4a6c0e9b17",
    "label": "Quickstart",
    "url": "https://nnbin.net/b/w4tz8hcv2qnd",
    "forward_host": "api.example.com",
    "reason": "failed_in_a_row",
    "paused_at": "2026-10-26T14:05:12.345678Z",
    "failures": 20,
    "last_error": "HTTP 503"
  }
}
```

`reason` is `failed_in_a_row` or `failing_for_an_hour`, `failures` is how many sends in a row had failed, and `last_error` is what went wrong with the last of them. `forward_host` is the forward URL's host alone: a notice never carries the URL's path or query, which can hold a secret.

To resume once your server is fixed, choose **Resume** on the Forwarding card, or set `forward_url` again with `PATCH /v1/bins/{id}`, to the same URL or a new one. Forwarding starts again with the next request the bin records, and **Send a test** shows whether your server answers.

## Where forwards come from {#source-address}

Forwards and test sends reach your server from `23.247.240.155`, over IPv4, so a server whose host has only IPv6 addresses can't receive them. That is the address today, and it may change: this page will say so before it does. If your server only accepts requests from addresses it knows, allow this one.

## What forwarding isn't {#not}

- **A proxy.** The sender gets the bin's `200`, never your server's answer, and a bin can't answer with a status, headers or body of your choosing.
- **Replay.** A recorded request can't be sent again on demand: each is forwarded once, as it arrives, with its retries.
- **Fan-out.** A bin forwards to one URL. To check a provider's signatures and deliver its webhooks to several endpoints of yours, with a dead-letter queue and redelivery, use a [Webhooks source](/docs/product-webhooks/sources).

## What's next {#next-steps}

- [Request Bins reference](/docs/product-bins/reference#forwarding) — `forward_url`, the test send, and every field of a forward.
- [Product overview](/docs/product-bins) — what a bin records, and each plan's limits.
- [Webhooks sources](/docs/product-webhooks/sources) — a provider's webhooks, verified and delivered to your endpoints.
