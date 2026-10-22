---
title: Captured requests
description: Record the raw requests that reach a source — headers, body and what we answered — to debug a provider integration.
publishedAt: 2026-10-19
updatedAt: 2026-10-22
kind: concept
---

# Captured requests

When a provider says it sent a webhook and nothing reached your endpoints, captured requests show what actually arrived at your [source](/docs/product-webhooks/sources): every header, the raw body, where it came from, and what we answered — including the requests we refused, which leave no trace anywhere else.

## Turn recording on {#enable}

Recording is per source and **off by default**, because a captured request holds the raw body of a real webhook — for a payments provider, real customer data. Switch it on for the one source you are debugging, watch what arrives, and switch it off again.

- In the console: **Captured requests** shows a switch for each source at the top of the page.
- Through the API: `PATCH /v1/sources/{id}` with `{"capture_enabled": true}`.

From then on each request to that source's ingest URL is recorded, accepted or not.

## What a capture holds {#contents}

| Field | What it is |
|---|---|
| Method, path, query | The request line as received. |
| Headers | Raw, in arrival order, duplicates kept — a provider that sends two `Stripe-Signature` headers shows both. Credential headers such as `Authorization` and `Cookie` are redacted; signature headers are kept, since they are what you are checking. |
| Body | The first 64 KiB, exactly as received. A longer body is marked *truncated*, and a truncated body cannot re-verify a signature. |
| From | The sender's IP address. |
| Outcome | `accepted`, or why we refused it (below). |
| The sender got | The status we answered, so it matches what the provider's dashboard shows. |
| Event | For an accepted request, the event it became. |

Repeats are folded together: the same method, path and body arriving again counts up the capture's **times seen** (Stripe alone retries up to eight times) instead of adding a row.

## Outcomes {#outcomes}

| Outcome | The sender got | Meaning |
|---|---|---|
| `accepted` | 202 | Verified and published as an event. |
| `bad_signature` | 401 | The signature did not verify against the source's secret. |
| `not_json` | 400 | The body is not a JSON object. |
| `rate_limited` | 429 | Over the workspace's publish rate. |
| `over_quota` | 402 | The workspace has used its monthly delivery allowance. |
| `too_large` | 413 | The payload is over 256 KiB. |
| `unknown_event_type` | 422 | The type is not registered and the [event type policy](/docs/product-webhooks/event-types#policy) is Strict. |
| `invalid_payload` | 422 | The payload fails its event type's JSON Schema. |
| `duplicate` | 409 | The provider's event id was already accepted with a different body. |

`bad_signature` is the usual first finding: the wrong secret pasted into the source, or a proxy in front of your provider that rewrote the body. Compare the captured headers with the provider's own delivery log.

Some refusals are not recorded: a request to an unknown or disabled source (there is no source to keep it for), one over the 512 KiB request limit, and one refused by the per-source flood limit before its signature is checked. The [status table on Sources](/docs/product-webhooks/sources#responses) lists what the sender sees for each.

## How long captures last {#retention}

A source keeps its latest 500 captures, and each is deleted 7 days after it was last seen. Delete one sooner from the console or with `DELETE /v1/captures/{id}`.

## Reading them through the API {#api}

```bash
# The latest captures for one source, refusals only
curl -s "{{WEBHOOKS_BASE_URL}}/v1/captures?source_id=src_…&outcome=bad_signature" \
  -H "Authorization: Bearer $READ_KEY"

# One capture with its headers and body (base64, since a body may not be UTF-8)
curl -s {{WEBHOOKS_BASE_URL}}/v1/captures/cap_… \
  -H "Authorization: Bearer $READ_KEY"
```

The list leaves bodies out; fetch a capture by id to get `headers_raw` and `body_base64`. Every capture operation is in the [API reference](/docs/reference/webhooks#ref-captured-requests).

## What this isn't {#not}

Captured requests are not a request bin you create and send arbitrary traffic to — they record only what reaches your own sources. For a URL that records any HTTP request sent to it, use [Request Bins](/docs/product-bins).

## What's next {#next-steps}

- [Sources](/docs/product-webhooks/sources) — create the source, and what each refusal means.
- [Event types](/docs/product-webhooks/event-types) — why a request can be refused as `unknown_event_type`.
- [Deliveries and retries](/docs/product-webhooks/deliveries) — what happens to an accepted request next.
