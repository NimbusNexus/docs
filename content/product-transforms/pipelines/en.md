---
title: Pipelines
description: The steps of a pipeline, its paths, values and filters, the templates to start from, and the caps on a run.
publishedAt: 2026-11-06
updatedAt: 2026-11-06
kind: concept
---

# Pipelines

A pipeline is a JSON document, and this page is its language. Webhooks and Request Bins run the same language on the same engine, so what you learn here holds there too, within each product's own header rules. To try any of this with no account, use the [playground](/transforms/playground).

## The document {#document}

This pipeline keeps paid invoices of $1,000 or more, removes the customer's email and any phone number, adds two fields and a header, and says a bearer token goes on the request:

```json
{
  "version": 1,
  "steps": [
    { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
    { "drop": ["data.customer.email", "**.phone"] },
    { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } },
    { "headers": { "set": { "X-Event-Type": "{{ type }}" } } },
    { "auth": { "type": "bearer", "secret": "sec_…" } }
  ]
}
```

`version` is the document's format, always `1`; it is not the pipeline's version. The steps run in the order written. Each is an object with one step key and, optionally, a `note` of up to 200 characters, which the console shows on the step and a drop reports. A `filter` can also take an `action`.

A run sees one request: a `body`, any JSON value; `headers`; and read-only `meta`. In the run API all three are whatever you send. Each step sees the body as the one before left it. Steps are numbered from 0 in the API and in error text, and from 1 in the console's editor.

| Step | In the console | What it does |
|---|---|---|
| `filter` | **Filter** | Keeps the request only if it matches, or, with `"action": "drop"`, drops it if it does. |
| `drop` | **Remove fields** | Removes fields from the body. |
| `set` | **Set fields** | Adds or overwrites fields. |
| `map` | **Reshape the body** | Replaces the body with one you build. |
| `headers` | **Headers** | Sets, removes or renames headers. |
| `auth` | **Credential** | Says that a bearer token, basic auth or an API key goes on the request, and names the slot it comes from. |

### `filter` {#step-filter}

Keeps the request only if it matches; otherwise the run answers `dropped`. With `"action": "drop"` it works the other way round: what matches is dropped.

```json
{ "filter": { "data": { "status": "paid", "amount": { "$gte": 100000 } } }, "note": "Paid, $1,000 or more" }
```

- Every key is a condition, and all of them must hold. A nested object tests by shape, as `data` does here.
- A plain value matches by JSON equality: `1` equals `1.0`.
- An array matches when it equals the value or when one of its elements matches: `{"data": {"tags": "urgent"}}` holds for `["billing", "urgent"]`, and `{"data": {"items": {"sku": "A-1", "qty": 2}}}` needs one item with both.
- A field the request doesn't have matches only `{"$exists": false}` and the negations, such as `$neq`.
- The operators are `$eq`, `$neq`, `$gt`, `$gte`, `$lt`, `$lte` (numbers with numbers, text with text; ISO timestamps sort by time), `$in`, `$nin`, `$exists`, `$startsWith`, `$endsWith`, `$contains` (text, or an array holding the value), and `$and`, `$or` and `$not` to combine filters.
- `$headers`, `$meta` and `$body` test that part of the request: `{"$headers": {"x-github-event": "push"}}`.

### `drop` {#step-drop}

Removes fields from the body: a list of 1 to 50 paths. `*` matches any one level and `**` any depth, so `**.email` removes every `email` field, wherever it is. A path that matches nothing is not an error.

```json
{ "drop": ["data.customer.email", "data.cards[*].number", "**.phone"] }
```

### `set` {#step-set}

Adds or overwrites fields: 1 to 50 pairs of a path and a [value](#values). It creates the objects on the way, and every value reads the body as the step found it. A path that runs into a value that isn't an object fails the run with `set_conflict`.

```json
{ "set": { "event_type": "{{ type }}", "data.total_cents": { "$ref": "data.amount" } } }
```

### `map` {#step-map}

Replaces the body with a [value](#values) you write, usually an object.

```json
{ "map": {
    "invoice_id": "{{ data.id }}",
    "amount": { "$ref": "data.amount" },
    "amount_display": "{{ data.amount | money(data.currency) }}",
    "event": "{{ type }}"
} }
```

On an `invoice.paid` request whose `data` is `{"id": "in_42", "amount": 150000, "currency": "usd"}`, the body becomes:

```json
{ "invoice_id": "in_42", "amount": 150000, "amount_display": "1,500.00 USD", "event": "invoice.paid" }
```

### `headers` {#step-headers}

Sets headers with `set`, removes them with `remove` and renames them with `rename`, in the order remove, rename, set. Names match whatever their case, and a name that is set replaces every spelling of it.

```json
{ "headers": { "set": { "X-Event-Type": "{{ type }}", "Content-Type": "application/json" } } }
```

A headers step can't set a header the connection owns, such as `Host` or `Content-Length`, or `Set-Cookie`. It can't set `Authorization`, `Cookie` or `X-Api-Key` either, because the value would sit in the document, which every read returns: a credential goes in an `auth` step. A product that runs the pipeline by reference also holds it to that product's own header rules.

### `auth` {#step-auth}

Says that a credential goes on the request, and names the slot it comes from:

| `type` | Adds |
|---|---|
| `bearer` | `Authorization: Bearer` and the credential. |
| `basic` | `Authorization: Basic`, from a `username` and the credential as the password. |
| `api_key`, `"in": "header"` | The credential in the header called `name`, after an optional `prefix` such as `"Token "`. |
| `api_key`, `"in": "query"` | The credential as the query parameter `name`, on the destination's URL. |

```json
{ "auth": { "type": "api_key", "in": "header", "name": "X-Api-Key", "secret": "sec_…" } }
```

`secret` is the id of a [slot](/docs/product-transforms/reference#slots) the workspace holds. It is never a value: a value pasted there is refused with `invalid_secret`, and the refusal doesn't quote it back. The product that runs the pipeline by reference maps the slot to its own secret ([Credentials](/docs/product-transforms#credentials)). Test and the run API show the header or parameter with the value masked.

Auth steps come after every other step, so no step can read, copy or test a credential.

## Paths and values {#values}

A path names a field of the body:

| Path | Names |
|---|---|
| `data.customer.email` | A field. |
| `data.items[0].sku` | An element of a list. |
| `data['first name']` | A key with a space, a dot or a bracket in it. |
| `data.items[*].sku` | Every element; in a value, the list of them. |
| `**.email` | `email` at any depth; in a `drop` only. |
| `$meta.source`, `$headers.x-name`, `$body.data` | The request's meta, one of its headers, or its body; in a value only. |

`set` takes plain paths, `drop` takes `*` and `**`, and a value reads with `*` but not `**`.

A value in `set`, `map` or a header is JSON, copied as written, except for two things:

- **`{{ path }}`** in a string inserts a value as text. A missing value or `null` inserts nothing, and an object or a list goes in as JSON. `{{ 'text' }}` and `{{ 42 }}` are literals, so a literal `{{` is written `{{ '{{' }}`.
- **`{"$ref": "path"}`** inserts the value itself and keeps its type: a number stays a number, a list a list. Add `"default"` for when the path is missing.

An expression can pass its value through filters, left to right: `{{ data.amount | money(data.currency) }}` gives `1,500.00 USD` for an amount of 150000 in `usd`.

| Filter | Gives |
|---|---|
| `upper`, `lower` | The text in upper or lower case. |
| `default(x)` | `x` when the value is missing, `null` or empty. |
| `truncate(n)` | At most `n` characters, then `…`. |
| `join(sep)` | A list as text, joined with `", "` unless you give `sep`. |
| `length` | The number of elements, keys or characters. |
| `json`, `json(indent)` | The value as compact JSON, or indented by 1 to 8 spaces. |
| `number(digits)` | A number with that many decimals. |
| `money(currency)` | An amount in minor units, formatted; zero- and three-decimal currencies included. |
| `date(format)` | An ISO 8601 time or epoch seconds, in UTC, with `%Y`, `%m`, `%d`, `%H`, `%M`, `%S` and the like. |
| `escape(target)` | Text that can't format a chat message: `slack` (the default), `discord` or `markdown`. |
| `code(target, max, language)` | Text as a code block in `slack`, `discord` or `markdown` markup, which the text can't end early, fitted to `max` characters. |

There are no loops, conditions or sums: a condition is a `filter` step, and a list becomes text through `[*]` and `join`.

## Templates {#templates}

The gallery holds ready-made pipelines to start from. In the console they sit under **Start from a template**. Through the API, `GET /v1/pipelines/templates` returns each one with its `pipeline`. Saving one makes a pipeline that is your own: change it like any other, and nothing refers back to the template.

| `id` | Template | What it sends |
|---|---|---|
| `slack` | **Slack message** | For a Slack incoming webhook: the event's type as a header, its id and time, and its data as a code block. |
| `discord` | **Discord message** | For a Discord channel webhook: an embed with the event's type, its data as a code block, and its id and time. It mentions no one. |
| `teams` | **Microsoft Teams card** | For a Teams workflow webhook: an Adaptive Card with the event's type, its id and time, and its data in monospace. |
| `keep_fields` | **Keep only these fields** | The event's `id`, `type`, `created_at` and `version`, and only the fields of `data` that its `map` lists, starting with `data.id`. A listed field the event doesn't have is sent as `null`. |
| `drop_personal` | **Drop personal data** | The event without `email`, `phone`, `first_name`, `last_name`, `address`, `billing_address`, `shipping_address`, `date_of_birth` and `ip_address`, at any depth. A plain `name` stays, since it often names a plan or a product. |

Each chat template is a `map` step and a `headers` step that sets `Content-Type: application/json`, and it works on any event. A missing type reads "Event" and a missing id or time "—", the data is cut to fit the app's limits, and nothing in the event can format the message, mention anyone or end the code block early.

## Limits {#limits}

A pipeline has no loops, no clock and no network, and fixed caps bound each run. Past one, the run answers `failed` with the reason, and a document past one is refused when it is saved.

| What | Limit | Refused as |
|---|---|---|
| A document, as compact JSON | 64 KiB | `too_large` |
| Steps | 20 | `too_many_steps` |
| Paths in a `drop`, fields in a `set`, names in each part of a `headers` step | 50 | `invalid_value` |
| A step's settings, as compact JSON | 16 KiB | `too_large` |
| A step's note | 200 characters | `invalid_value` |
| Nesting, in a step and in a body | 32 levels | `too_deep`, `input_too_deep` |
| The body a step reads | 256 KiB | `input_too_large` |
| The body a run answers with | 256 KiB | `output_too_large` |
| One value a step renders | 64 KiB | `value_too_large` |
| Work in one run | 100,000 values read or copied, text counting one per 128 characters | `too_many_nodes` |
| Headers at the end of a run | 50 | `too_many_headers` |
| One header value | 8 KiB | `header_too_large` |

The playground has smaller caps: a 16 KiB document, a 32 KiB body and 10,000 values read or copied in a run.

## What's next {#next-steps}

- [Quickstart](/docs/product-transforms/quickstart) — test a pipeline, save it and run it.
- [Transforms reference](/docs/product-transforms/reference) — every route and field, and what each refusal means.
- [Transformations in Webhooks](/docs/product-webhooks/transformations) — the same language on a Webhooks endpoint.
