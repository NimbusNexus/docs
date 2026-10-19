---
title: Event types
description: The catalog of event names in a workspace, the policy for names it has not seen, and optional JSON Schemas that payloads must match.
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: concept
---

# Event types

Every event has a type — `order.created`, `stripe.invoice.paid` — and endpoints [subscribe](/docs/product-webhooks#objects) to types by pattern. The event types catalog is the list of names your workspace uses, with an optional description and JSON Schema for each. It is also where you decide what happens when a name nobody registered shows up.

## Do I have to register types? {#register}

No — not under the default policy. With **Lenient**, any type you publish (or a [source](/docs/product-webhooks/sources) receives) is accepted and added to the catalog the first time it appears. Most workspaces never register a type by hand.

Register one when you want to:

- **describe it** for whoever builds against your webhooks;
- **check its payloads** against a JSON Schema (below);
- or switch to **Strict**, where only registered types can be published.

Endpoint subscriptions match on the name either way; a subscription to `order.` does not need `order.created` to be in the catalog.

## The policy for unregistered types {#policy}

| Policy | An unregistered type… |
|---|---|
| **Lenient** (default) | is accepted and added to the catalog. |
| **Strict** | is refused with `422 unknown_event_type`. |

Strict suits a workspace where the set of types is a contract — a typo in a publisher then fails loudly at publish instead of quietly creating a type no endpoint subscribes to. A source's request refused this way shows up as `unknown_event_type` in [captured requests](/docs/product-webhooks/captured-requests#outcomes).

The policy is set for the workspace and can be set per project (`PUT /v1/event-types/policy`, with `?project_id=` for one project). In the console it is the **When an unregistered type arrives** control on the Event types page, and it follows the project picker.

## Payload schemas {#schemas}

A type can carry a [JSON Schema](https://json-schema.org/) (draft 7). Once it does, every publish of that type is checked against it, and a payload that does not match is refused with `422 invalid_payload`, listing what failed.

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/event-types \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "name": "order.created",
        "description": "A customer placed an order",
        "payload_schema": {
          "type": "object",
          "required": ["order_id", "total"],
          "properties": {"order_id": {"type": "string"}, "total": {"type": "integer"}}
        }
      }'
```

Schemas are checked when you save them: one that is not valid JSON Schema, or whose regular expressions could make matching extremely slow, is refused with an explanation.

## Workspace-wide and per-project types {#scope}

A type registered without a project applies to every project. One registered with `project_id` applies to that project only, and takes precedence there over a workspace-wide entry of the same name — so a project can carry its own description or stricter schema. The console's **Applies to** column shows which is which.

## Where a type came from {#origin}

| Origin | In the console | How it got there |
|---|---|---|
| `manual` | added here | Registered in the console or with `POST /v1/event-types`. |
| `ingest` | from a source | First arrived through a source, under Lenient. |
| `lenient` | auto-added | First published through the API, under Lenient. |

## `webhook.received` {#webhook-received}

If the catalog lists `webhook.received` and you never published it: a source received requests it could not read a type from, and had no default type to fall back on. Give that source a default type, or point it at the header or JSON path that carries the type — see [Event types from a source](/docs/product-webhooks/sources#event-types).

## What's next {#next-steps}

- [Sources](/docs/product-webhooks/sources) — how a source reads the type from a provider's request.
- [Webhooks (product)](/docs/product-webhooks) — subscriptions and the other objects.
- [Errors](/docs/errors) — `unknown_event_type`, `invalid_payload` and the rest.
