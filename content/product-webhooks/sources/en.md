---
title: Sources
description: Receive webhooks from Stripe, GitHub, Clerk, Resend or any sender that signs with HMAC, and deliver them to your endpoints as events.
publishedAt: 2026-10-19
updatedAt: 2026-10-28
kind: concept
---

# Sources

A source is a URL you give a provider — Stripe, GitHub, a Standard Webhooks sender such as Clerk or Resend, or anything else that signs its webhooks — so it can send to us. We check each request's signature, turn it into an event, and deliver it to your endpoints exactly like an event you [published yourself](/docs/product-webhooks/quickstart#publish): same subscriptions, same retries, same dead-letter queue.

Use a source when you want one place for webhook traffic in both directions, or when you want several of your services to receive one provider's events without each one verifying Stripe's signature on its own.

## How a request becomes deliveries {#flow}

1. The provider POSTs to the source's ingest URL, `{{WEBHOOKS_BASE_URL}}/v1/ingest/{source_id}`.
2. We verify the signature over the exact bytes received, against the source's signing secret.
3. The body must be a JSON object. We read the event type from it (see [Event types from a source](#event-types)).
4. The event is published into the source's project and matched against your endpoints' subscriptions, which creates one delivery per matching endpoint.
5. The provider gets `202`. Your endpoints receive the event signed with *their* secret, not the provider's.

The ingest URL is the only part of Webhooks that takes requests without an API key: the provider's signature is the credential.

## Providers and their signatures {#providers}

| Provider | Header we check | Signed bytes | Replay window |
|---|---|---|---|
| `stripe` | `Stripe-Signature: t=…,v1=…` | `{t}.{body}` | 5 minutes |
| `github` | `X-Hub-Signature-256: sha256=…` | `{body}` | none (GitHub sends no timestamp) |
| `generic` | `X-Webhook-Signature: sha256=…` with `X-Webhook-Timestamp` | `{timestamp}.{body}` | 5 minutes |
| `standardwebhooks` | `webhook-signature: v1,…` with `webhook-id` and `webhook-timestamp`, or the same three as `svix-*` | `{id}.{timestamp}.{body}` | 5 minutes |

All four are HMAC-SHA256. `generic` is the same scheme we sign our own deliveries with, so one Webhooks workspace's endpoint can feed another's source, and any sender you control can sign this way in a few lines. `standardwebhooks` is the [Standard Webhooks](https://www.standardwebhooks.com/) scheme, which every sender built on Svix uses, Clerk and Resend among them.

## Create a source {#create}

In the console: **Sources → New source** (also on the Overview). Or through the API:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/sources \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "provider": "stripe",
        "name": "Stripe live",
        "secret": "whsec_…",
        "event_type_prefix": "stripe."
      }'
```

- **Stripe, GitHub and Standard Webhooks**: paste the signing secret the provider shows you (for a Standard Webhooks sender, the `whsec_…` value from its webhook settings). A source created without one starts disabled; add the secret later with `rotate-secret` and enable it.
- **Generic**: leave `secret` out and we generate one, returned once in this response.

The response carries `ingest_url`. Paste it into the provider's webhook settings, and add an endpoint that subscribes to the types you expect (`prefix` `stripe.` above).

## Event types from a source {#event-types}

Each request needs an event type for endpoints to subscribe to. A source finds it, in this order:

1. Where you told it to look: a request **header**, or a dotted **JSON path** in the body (`data.object.type`).
2. Otherwise the provider's own place: the body's `type` for Stripe, generic and Standard Webhooks, the `X-GitHub-Event` header for GitHub.
3. If neither gives a value: the source's **default type**, and failing that, `webhook.received`.

The source's **prefix** goes in front (`stripe.` + `invoice.paid` → `stripe.invoice.paid`), which keeps two providers' types apart in one project. If your event types list shows `webhook.received`, a source received requests with no type it could read: set a default type or a JSON path on that source.

The provider's own event id (Stripe's `evt_…`, GitHub's delivery id, the `webhook-id` header of a Standard Webhooks request) is the idempotency key, so when a provider retries an event we already accepted, it gets `202` again and nothing is delivered twice.

## What the provider sees {#responses}

| Status | When |
|---|---|
| `202` | Accepted and published. |
| `400` | The body is not JSON, or not a JSON object. |
| `401` | The signature did not verify — missing, malformed, wrong secret or outside the replay window. One answer for all of them, on purpose. |
| `402` | The workspace has used its monthly delivery allowance. |
| `404` | No such source, or the source is disabled. |
| `409` | The provider's event id was already accepted with a different body. |
| `413` | The request is over 512 KiB, or the payload over 256 KiB. |
| `422` | The type is not registered and the [event type policy](/docs/product-webhooks/event-types#policy) is Strict, or the payload fails the type's JSON Schema. |
| `429` | Too many requests: 600 a minute per source before the signature check, then your plan's publish rate. |

Providers retry on anything but 2xx, so a refusal is not lost on their side — but to see *why* we refused, turn on recording for the source and read [Captured requests](/docs/product-webhooks/captured-requests).

## Rotating a secret {#rotate}

When the provider rolls its secret, send the new one:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/sources/src_…/rotate-secret \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"secret": "whsec_new…"}'
```

The previous secret keeps verifying for 24 hours, so requests signed either way are accepted while the provider switches over. For a generic source, send an empty body and we generate the new secret.

## What's next {#next-steps}

- [Captured requests](/docs/product-webhooks/captured-requests) — see the raw requests a source received, refusals included.
- [Sources in the API reference](/docs/reference/webhooks#ref-sources) — every source operation, with the SDK and CLI calls.
- [Event types](/docs/product-webhooks/event-types) — the catalog of types, and what happens to an unknown one.
- [Deliveries and retries](/docs/product-webhooks/deliveries) — what happens after an event is published.
- [Webhooks overview](/docs/product-webhooks) — the objects and how they fit together.
