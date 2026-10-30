---
title: Webhooks
description: The managed webhook platform — publish an event once, and we sign, retry, and replay every delivery to your subscribers.
publishedAt: 2026-08-05
updatedAt: 2026-10-30
kind: concept
---

# Webhooks

NimbusNexus Webhooks is a standalone product for sending webhooks to *your* subscribers. You publish an event once; we fan it out to every endpoint subscribed to that type, sign each delivery, retry the failures, and hold whatever never lands in a dead-letter queue you can replay.

> **Not the page you wanted?** If you are here to receive notifications about *your own NimbusNexus infrastructure* — `vm.created`, `snapshot.completed`, `invoice.generated` — that is a different feature, documented at [Platform webhooks](/docs/webhooks). The two are unrelated systems and **their signing headers differ**, so verification code written for one will reject every delivery from the other.

The distinction in one line: platform webhooks are events *we* send you about your account; this product delivers events *you* send your own customers.

## What it is for {#what-for}

Running webhook delivery yourself looks easy until it isn't. The delivery itself is a POST — the work is everything around it: signing so subscribers can trust the payload, retrying without hammering an endpoint that is already down, keeping a byte-identical body across retries so signatures stay valid, disabling endpoints that have been failing for a week, and giving support a way to answer "did you send it?" with evidence.

This product is that surrounding machinery. It also receives in the other direction — [sources](/docs/product-webhooks/sources) take webhooks from Stripe, GitHub, or anything else that signs its payloads — so a single system handles both sides of your webhook traffic.

## The objects {#objects}

| Object | What it is |
|---|---|
| **Workspace** | Your account. Everything you own is scoped to it and isolated from other workspaces. |
| **Project** | A grouping inside the workspace. Keeping staging away from production is two projects; so is running two products side by side. Addressed by id (`prj_…`). |
| **Event** | Something that happened — a type such as `order.created`, plus a JSON payload. You publish it, or a source receives it. |
| **Source** | A URL a provider sends webhooks to. Each signed request becomes an event. See [Sources](/docs/product-webhooks/sources). |
| **Endpoint** | An HTTPS URL registered to receive webhooks, carrying one or more subscriptions. |
| **Subscription** | A match rule on an endpoint: `exact`, `prefix`, `suffix`, or `all`, plus a pattern such as `order.`. |
| **Transformation** | A short JavaScript function on an endpoint that reshapes, filters or drops each delivery before it is signed and sent. Paid plans. See [Transformations](/docs/product-webhooks/transformations). |
| **Delivery** | One attempt-tracked send of one event to one matching endpoint. Signed, retried, observable. See [Deliveries and retries](/docs/product-webhooks/deliveries). |
| **Event type** | An entry in the catalog of type names, with an optional JSON Schema. See [Event types](/docs/product-webhooks/event-types). |
| **Signing secret** | Per-endpoint secret used to HMAC-sign every delivery. Shown **once**, at creation. |

Publishing an event matches it against every enabled endpoint whose subscriptions cover that type, and creates one delivery per match. Where the workspace requires [endpoint verification](/docs/product-webhooks/endpoint-verification), only verified endpoints count.

Two meters run over that, and the difference matters when you size a plan. One publish is always one **event**, and that fan-out-neutral count is what `GET /v1/usage` reports as `messages_used`. But the **enforced** monthly quota counts *deliveries* — one per matching endpoint — so fanning a single event out to ten endpoints consumes ten. The per-event meter is recorded and will become the billing unit; the delivery quota is the ceiling that actually rejects a publish today.

## How a delivery behaves {#delivery}

- **The body is built once.** The envelope is serialized at publish time and stored byte-for-byte, so every retry ships identical bytes. Each *attempt* is re-signed with a fresh timestamp, which lets your subscribers enforce a tight replay window without a delivery that succeeds an hour later failing verification.
- **At-least-once.** Retries are real; the same event can arrive twice. Deduplicate on the event id, which travels in both the body and the `X-Webhook-Event-Id` header.
- **Retries back off.** Failed deliveries retry with exponential backoff up to the endpoint's `max_attempts`. An endpoint can carry a custom `retry_schedule` — an explicit list of delays in seconds — when the default curve doesn't suit the far end.
- **Exhausted deliveries are kept, not dropped.** They land in the dead-letter queue, where you can filter and replay them in bulk once the receiver is healthy.
- **Persistently failing endpoints are disabled** automatically, with the reason recorded. We send an `endpoint.disabled` [operational webhook](/docs/product-webhooks/deliveries#operational) to the workspace's operational endpoints, so subscribe one to hear about it. Re-enabling is explicit.

## Finding your way around the console {#console}

| Section | Pages | For |
|---|---|---|
| **Build** | Sources, Endpoints, Event types, Pipeline | Setting up where events come from and where they go; Pipeline maps each source to the endpoints it reaches, with the transformation on the way. |
| **Observe** | Events, Deliveries, Captured requests | Seeing what arrived, what went out and what failed. |
| **Manage** | Operational webhooks, Audit log, Settings | Where you're told when something breaks; who changed what; your Webhooks plan and usage, verification, and developer tools. |

The Overview has buttons to add a source or an endpoint and to send a test event, and walks a new workspace through its first delivery.

## Publishing safely {#publishing}

Send an `Idempotency-Key` on every publish. A retried publish then returns the original event rather than fanning out a second time, which matters most in exactly the situation that produces retries — a timeout where you never learned whether the first call succeeded.

The same key with a *different* body is rejected rather than quietly accepted, so a key collision surfaces as an error instead of a silently dropped event.

For producers that cannot tolerate losing an event when the API is unreachable, the SDKs ship a write-first outbox: `enqueue()` persists locally and returns without a network call, and a drainer ships the backlog later under the same idempotency guarantee. See [SDKs](/docs/product-webhooks/sdks).

## Getting access {#access}

Register for Webhooks and you get a workspace on the free plan, created the first time you sign in to the console. Pricing is on the [Webhooks page](/webhooks).

Keys are not issued with the workspace, and the Webhooks API does not issue them. You mint one yourself in your NimbusNexus account console, under **API keys**, choosing **Webhooks** as the product — Identity is the single API-key issuer across the estate. An Identity-issued key is a JWT, so it begins `eyJ` rather than carrying a product prefix. It is presented exactly as before: `Authorization: Bearer <key>`, or `X-API-Key: <key>`.

Choose the scope when you mint it. `admin` is full control; `publish` can produce events and read nothing; `read` can read everything and produce nothing. `publish` and `read` are disjoint rather than a ladder — a `publish` key cannot list deliveries, and a `read` key cannot publish, so a job that does both needs `admin`. A key can also be confined to a single project at mint time.

> **An existing `whsk_…` key no longer authenticates.** The `whsk_` family is gone, and a request carrying one is refused like any other unrecognised credential. If you are holding one, mint a replacement in the account console.

## What's next {#next-steps}

- [Quickstart](/docs/product-webhooks/quickstart) — register an endpoint, publish an event, verify the delivery.
- [Sources](/docs/product-webhooks/sources) — receive webhooks from Stripe, GitHub or any HMAC sender.
- [Deliveries and retries](/docs/product-webhooks/deliveries) — states, the retry schedule, and sending again.
- [Endpoint verification](/docs/product-webhooks/endpoint-verification) — the challenge an endpoint answers before it receives events.
- [Transformations](/docs/product-webhooks/transformations) — reshape, filter or drop each delivery with a short script.
- [Slack, Teams and Discord](/docs/product-webhooks/chat-apps) — send events to a channel with a preset.
- [Event types](/docs/product-webhooks/event-types) — the catalog, the policy for unknown types, and payload schemas.
- [Captured requests](/docs/product-webhooks/captured-requests) — the raw requests that reached a source.
- [Signature verification](/docs/product-webhooks/signatures) — the signing contract, and the three rules for checking it.
- [SDKs](/docs/product-webhooks/sdks) — typed clients for Python, TypeScript, and Go.
- [CLI](/docs/product-webhooks/cli) — `nn-webhooks`, a single static binary.
- [Platform webhooks](/docs/webhooks) — the other thing called webhooks: notifications about your own infrastructure.
