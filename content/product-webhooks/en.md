---
title: Webhooks (product)
description: The managed webhook platform — publish an event once, and we sign, retry, and replay every delivery to your subscribers.
publishedAt: 2026-08-05
updatedAt: 2026-08-05
kind: concept
---

# Webhooks (product)

NimbusNexus Webhooks is a standalone product for sending webhooks to *your* subscribers. You publish an event once; we fan it out to every endpoint subscribed to that type, sign each delivery, retry the failures, and hold whatever never lands in a dead-letter queue you can replay.

> **Not the page you wanted?** If you are here to receive notifications about *your own NimbusNexus infrastructure* — `vm.created`, `snapshot.completed`, `invoice.generated` — that is a different feature, documented at [Platform webhooks](/docs/webhooks). The two are unrelated systems and **their signing headers differ**, so verification code written for one will reject every delivery from the other.

The distinction in one line: platform webhooks are events *we* send you about your account; this product delivers events *you* send your own customers.

## What it is for {#what-for}

Running webhook delivery yourself looks easy until it isn't. The delivery itself is a POST — the work is everything around it: signing so subscribers can trust the payload, retrying without hammering an endpoint that is already down, keeping a byte-identical body across retries so signatures stay valid, disabling endpoints that have been failing for a week, and giving support a way to answer "did you send it?" with evidence.

This product is that surrounding machinery. It also ingests in the other direction — events from Stripe, GitHub, or anything else that signs its payloads — so a single system handles both sides of your webhook traffic.

## The objects {#objects}

| Object | What it is |
|---|---|
| **Workspace** | Your account. Everything you own is scoped to it and isolated from other workspaces. |
| **Project** | A grouping inside the workspace. Keeping staging away from production is two projects; so is running two products side by side. Addressed by id (`prj_…`). |
| **Event** | Something that happened, which you publish — a `type` such as `order.created`, plus a JSON payload. |
| **Endpoint** | An HTTPS URL registered to receive webhooks, carrying one or more subscriptions. |
| **Subscription** | A match rule on an endpoint: `exact`, `prefix`, `suffix`, or `all`, plus a pattern such as `order.`. |
| **Delivery** | One attempt-tracked send of one event to one matching endpoint. Signed, retried, observable. |
| **Signing secret** | Per-endpoint secret used to HMAC-sign every delivery. Shown **once**, at creation. |

Publishing an event matches it against every enabled endpoint whose subscriptions cover that type, and creates one delivery per match. Fanning one event out to ten endpoints is still one event — which is also how it is metered.

## How a delivery behaves {#delivery}

- **The body is built once.** The envelope is serialized at publish time and stored byte-for-byte, so every retry ships identical bytes. Each *attempt* is re-signed with a fresh timestamp, which lets your subscribers enforce a tight replay window without a delivery that succeeds an hour later failing verification.
- **At-least-once.** Retries are real; the same event can arrive twice. Deduplicate on the event id, which travels in both the body and the `X-Webhook-Event-Id` header.
- **Retries back off.** Failed deliveries retry with exponential backoff up to the endpoint's `max_attempts`. An endpoint can carry a custom `retry_schedule` — an explicit list of delays in seconds — when the default curve doesn't suit the far end.
- **Exhausted deliveries are kept, not dropped.** They land in the dead-letter queue, where you can filter and replay them in bulk once the receiver is healthy.
- **Persistently failing endpoints are disabled** automatically and the owner is emailed with the reason. Re-enabling is explicit.

## Publishing safely {#publishing}

Send an `Idempotency-Key` on every publish. A retried publish then returns the original event rather than fanning out a second time, which matters most in exactly the situation that produces retries — a timeout where you never learned whether the first call succeeded.

The same key with a *different* body is rejected rather than quietly accepted, so a key collision surfaces as an error instead of a silently dropped event.

For producers that cannot tolerate losing an event when the API is unreachable, the SDKs ship a write-first outbox: `enqueue()` persists locally and returns without a network call, and a drainer ships the backlog later under the same idempotency guarantee. See [SDKs](/docs/product-webhooks/sdks).

## Getting access {#access}

The product is sold with an onboarding conversation rather than self-serve signup today — [talk to us](/contact/sales) and we will provision your workspace and an initial admin key.

## What's next {#next-steps}

- [Quickstart](/docs/product-webhooks/quickstart) — register an endpoint, publish an event, verify the delivery.
- [Signature verification](/docs/product-webhooks/signatures) — the signing contract, and the three rules for checking it.
- [SDKs](/docs/product-webhooks/sdks) — typed clients for Python, TypeScript, and Go.
- [CLI](/docs/product-webhooks/cli) — `nn-webhooks`, a single static binary.
- [Platform webhooks](/docs/webhooks) — the other thing called webhooks: notifications about your own infrastructure.
