---
title: Transformations
description: Filter, trim, reshape or add credentials to each delivery before it is signed and sent, with a pipeline of declarative steps on every plan or a JavaScript script on paid plans.
publishedAt: 2026-10-30
updatedAt: 2026-11-03
kind: concept
---

# Transformations

A transformation changes what an endpoint receives: it runs on each event before we deliver it, and sends a reshaped request in its place, or nothing at all. It is either a **pipeline** of declarative steps, on every plan, or a JavaScript **script**, on paid plans; what it makes is signed with the endpoint's secret and sent like any other delivery.

## What it is for {#what-for}

- **A receiver that wants credentials.** Your own API, or a partner's, expects a bearer token, basic auth or an API key. A pipeline adds it from a [secret](#credentials) we store encrypted and never show again.
- **A receiver that wants its own shape.** Slack, Discord and Microsoft Teams accept only their own message formats and turn our envelope away; a CRM wants three fields, named its way. A [template](#templates) or a `map` step builds that body.
- **Only some events.** A [subscription](/docs/product-webhooks#objects) matches on the event type alone. "Only `invoice.paid` of $1,000 or more" needs the payload, which a `filter` step reads.
- **Less data, or a little more.** Remove personal data before an analytics vendor sees it, or add the event type to the body or a header.

## Pipelines and scripts {#kinds}

| | Pipeline | Script |
|---|---|---|
| What you write | Up to 20 steps, in the console's form or as JSON | One JavaScript function |
| Plans | Every plan, Free included | Starter, Pro and Custom |
| Where it runs | Beside the delivery, under fixed caps; no code of yours runs | In a sandbox of its own, with a CPU, memory and time budget |
| Good for | Credentials, filters, removing and adding fields, reshaping, chat messages | Logic the steps can't express |

A transformation is one or the other, and its kind is fixed when it is created. An endpoint runs at most one transformation; one transformation can serve several endpoints of its project.

On Free, creating or testing a script is refused with `402 not_entitled`. A workspace that leaves its paid plan keeps its scripts and can still rename, pause, detach and delete them, but not save new code, test or resume one, and deliveries to an endpoint that runs one wait until the plan includes scripts again or you detach it. Pipelines keep running on any plan.

Scripts depend on a sandbox service of their own; pipelines don't. While scripts are switched off, the console says so, `GET /v1/plan` reports `transformations_available: false`, and deliveries to an endpoint that runs a script wait. If the sandbox can't take a script at a given moment, saving or testing one answers `503 unavailable` and saves nothing, and a delivery's attempt fails with a message that says so and is retried on the usual schedule.

`GET /v1/plan` also says what your plan includes: `pipelines` is `true` on every plan, and `transformations` is `true` when it includes scripts. Runs of both kinds are counted, not billed; `transformation_runs` is this month's count.

## A pipeline {#pipeline}

A pipeline is a JSON document. This one sends paid invoices of $1,000 or more, without the customer's email or any phone number, with the event type added to the body and a bearer token from a stored secret:

```json
{
  "version": 1,
  "steps": [
    { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
    { "drop": ["data.customer.email", "**.phone"] },
    { "set": { "event_type": "{{ type }}" } },
    { "auth": { "type": "bearer", "secret": "sec_…" } }
  ]
}
```

`version` is the document's format, always `1`; it is not the transformation's version. The steps run in the order written. Each is an object with one step key and, optionally, a `note` of up to 200 characters: the console shows it on the step, and a delivery that a filter drops records it. A `filter` can also take an `action`.

The first step sees the envelope we would otherwise send, with its `id`, `type`, `created_at`, `data` and `version`, and each step after it sees the body as the one before left it. When no step changes the body, the receiver gets the event's own bytes. Steps are numbered from 0 in the API and in error text, and from 1 in the console's editor.

| Step | In the console | What it does |
|---|---|---|
| `filter` | **Filter** | Sends the event only if it matches, or, with `"action": "drop"`, drops it if it does. |
| `drop` | **Remove fields** | Removes fields from the body. |
| `set` | **Set fields** | Adds or overwrites fields. |
| `map` | **Reshape the body** | Replaces the body with one you build. |
| `headers` | **Headers** | Sets, removes or renames headers. |
| `auth` | **Credential** | Adds a bearer token, basic auth or an API key from a stored secret. |

### `filter` {#step-filter}

Keeps the delivery only if the event matches; otherwise the delivery is [dropped](#dropped) and nothing is sent. With `"action": "drop"` it works the other way round: what matches is dropped.

```json
{ "filter": { "data": { "status": "paid", "amount": { "$gte": 100000 } } }, "note": "Paid, $1,000 or more" }
```

- Every key is a condition, and all of them must hold. A nested object tests by shape, as `data` does here.
- A plain value matches by JSON equality: `1` equals `1.0`.
- An array matches when it equals the value or when one of its elements matches: `{"data": {"tags": "urgent"}}` holds for `["billing", "urgent"]`, and `{"data": {"items": {"sku": "A-1", "qty": 2}}}` needs one item with both.
- A field the event doesn't have matches only `{"$exists": false}` and the negations, such as `$neq`.
- The operators are `$eq`, `$neq`, `$gt`, `$gte`, `$lt`, `$lte` (numbers with numbers, text with text; ISO timestamps sort by time), `$in`, `$nin`, `$exists`, `$startsWith`, `$endsWith`, `$contains` (text, or an array holding the value), and `$and`, `$or` and `$not` to combine filters.
- `$meta` tests where the delivery is going: `{"$meta": {"endpoint": {"id": "ep_3f9a…"}}}`.

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

On an `invoice.paid` event whose `data` is `{"id": "in_42", "amount": 150000, "currency": "usd"}`, it sends:

```json
{ "invoice_id": "in_42", "amount": 150000, "amount_display": "1,500.00 USD", "event": "invoice.paid" }
```

### `headers` {#step-headers}

Sets headers with `set`, removes them with `remove` and renames them with `rename`, in the order remove, rename, set. Names match whatever their case. A pipeline starts with no headers of its own: the endpoint's custom headers and ours are added after it runs, a header it sets replaces a custom header of the same name, and `remove` and `rename` reach only the headers earlier steps set.

```json
{ "headers": { "set": { "X-Event-Type": "{{ type }}", "Content-Type": "application/json" } } }
```

A pipeline can't set a header we send ourselves, which is any `X-Webhook-*` header, the signature among them, or `User-Agent`; nor one the connection owns, such as `Host`, `Content-Length` or `Expect`. `Content-Type` it can set, and that becomes the delivery's content type. Without one, the delivery goes as `application/json`.

### `auth` {#step-auth}

Adds a credential from a [stored secret](#credentials), named by its id:

| `type` | Adds |
|---|---|
| `bearer` | `Authorization: Bearer` and the secret. |
| `basic` | `Authorization: Basic`, from a `username` and the secret as the password. |
| `api_key`, `"in": "header"` | The secret in the header called `name`, after an optional `prefix` such as `"Token "`. |
| `api_key`, `"in": "query"` | The secret as the query parameter `name`, on the endpoint's URL for that request only. |

```json
{ "auth": { "type": "api_key", "in": "header", "name": "X-Api-Key", "secret": "sec_…" } }
```

Auth steps come after every other step, so no step can read, copy or test the credential.

## Paths and values {#values}

A path names a field of the body:

| Path | Names |
|---|---|
| `data.customer.email` | A field. |
| `data.items[0].sku` | An element of a list. |
| `data['first name']` | A key with a space, a dot or a bracket in it. |
| `data.items[*].sku` | Every element; in a value, the list of them. |
| `**.email` | `email` at any depth; in a `drop` only. |
| `$meta.endpoint.id` | The endpoint the delivery goes to, and `$meta.endpoint.description` its description; in a value only. |

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

The gallery holds ready-made pipelines to start from. In the console they sit under **Start from a template**, below the steps: **Use Slack message**, or the button of any other, puts that template's steps in the editor, after asking if they would replace yours. Through the API, `GET /v1/transformations/templates` returns each one with its `pipeline`.

| Template | What it sends |
|---|---|
| **Slack message** | For a Slack incoming webhook: the event's type as a header, its id and time, and its data as a code block. |
| **Discord message** | For a Discord channel webhook: an embed with the event's type, its data as a code block, and its id and time. It mentions no one. |
| **Microsoft Teams card** | For a Teams workflow webhook: an Adaptive Card with the event's type, its id and time, and its data in monospace. |
| **Keep only these fields** | The event's `id`, `type`, `created_at` and `version`, and only the fields of `data` that its `map` lists, starting with `data.id`. A listed field the event doesn't have is sent as `null`. |
| **Drop personal data** | The event without `email`, `phone`, `first_name`, `last_name`, `address`, `billing_address`, `shipping_address`, `date_of_birth` and `ip_address`, at any depth. A plain `name` stays, since it often names a plan or a product. |

Saving one makes a pipeline that is your own: change it like any other, and nothing refers back to the template. Each chat template is a `map` step and a `headers` step that sets `Content-Type: application/json`, and it works on any event. A missing type reads "Event" and a missing id or time "—", the data is cut to fit the app's limits, and nothing in the event can format the message, mention anyone or end the code block early.

Slack, Discord and Teams can't answer the [verification challenge](/docs/product-webhooks/endpoint-verification#cannot-echo), so an endpoint aimed at one of them needs verification off for its project, which paid plans can turn off.

**Presets are now templates.** An endpoint that already runs a preset, which is a script, keeps running it as it is, and only such an endpoint still offers **Preset** among its choices. The template of the same name does the same job without a script, on every plan.

## Credentials {#credentials}

An `auth` step names a secret by its id (`sec_…`), never by its value. A secret belongs to a project, as a transformation does, and only that project's pipelines can name it. Its value is stored encrypted and never comes back: the API lists secrets by name and id, a pipeline read back carries only the id, a test shows the credential as `••••`, and a delivery keeps only the names of the headers and query parameters it added.

In the console, a **Credential** step's **Secret** lists the project's secrets. To store a new one, choose **New secret…**, fill in **Secret name** and **Secret value**, and choose **Save secret**.

Through the API, with the value read from an environment variable:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/secrets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": \"prj_…\", \"name\": \"CRM token\", \"value\": \"$CRM_TOKEN\"}"
```

```json
{ "id": "sec_…", "project_id": "prj_…", "name": "CRM token", "transformation_count": 0, "created_at": "…", "updated_at": "…" }
```

`PATCH /v1/secrets/{id}` renames a secret or replaces its value; every pipeline that names it sends the new value from its next attempt on, retries of earlier deliveries included. `DELETE /v1/secrets/{id}` is refused with `409 secret_in_use` while a pipeline's current version names the secret. The console only creates secrets; rename, replace and delete them through the API.

## Scripts {#script}

A script is one function named `transform`, on Starter, Pro and Custom:

```js
function transform(event, context) {
  // event:   { id, type, created_at, data, version }, the envelope we would otherwise send
  // context: { endpoint: { id, description }, attempt }
  if (event.type !== "invoice.paid") return null; // send nothing
  return {
    body: { text: `Invoice ${event.data.id} paid` },
    headers: { "X-Team": "billing" },
  };
}
```

It returns the request to send, or `null` to send nothing. A `body` that is an object or a list goes as JSON; a string goes as it is, as `text/plain; charset=utf-8`. `contentType` sets another content type, in place of a `Content-Type` header, and `headers` adds headers under the rules for an endpoint's custom headers. The URL and the method stay the endpoint's. Whatever the script writes with `console.log` is kept with the delivery, up to 4 KiB.

The script is plain JavaScript in one file, with no network, no file system, no timers and no imports, so a library it needs has to be bundled into it. Saving one loads it in the sandbox first, without calling it: a syntax error, no `transform` function or top-level code that fails is refused with `422 invalid_transformation`, and nothing is saved.

## Testing {#test}

**Test**, below the editor, runs what is in the editor, saved or not, on **A recent event** from the endpoint's latest deliveries or on **An event you paste**. Choose **Run test**: nothing is sent and nothing is saved. A pipeline runs on its project's secrets, and the answer shows each credential as `••••`. The answer is one of these:

- **Would send**: the content type, the size, the headers and the body the receiver would get.
- **Would send nothing**: a filter dropped it, at the step shown, or the script returned `null`.
- **Failed**: why it failed, and for a pipeline at which step.

Through the API, send the pipeline, or a script's `code`, with an event:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations/test \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "prj_…",
       "pipeline": {"version": 1, "steps": [
         {"map": {"text": "{{ type }}: {{ data.id }}"}},
         {"auth": {"type": "bearer", "secret": "sec_…"}}]},
       "event": {"id": "evt_1", "type": "invoice.paid", "created_at": "2026-11-03T10:00:00Z", "data": {"id": "in_42"}, "version": "1"}}'
```

```json
{ "status": "ok", "body": "{\"text\":\"invoice.paid: in_42\"}", "content_type": null, "headers": { "Authorization": "Bearer ••••" }, "logs": "", "reason": null, "error": null, "fuel": 0, "duration_ms": 0.2, "query": {}, "step": null }
```

`status` is `ok`, `dropped` or `failed`. For a drop or a failure, `step` is the step, counted from 0; `reason` is the machine word, such as `no_match` (or `matched`, for a filter with `"action": "drop"`) or `set_conflict`; and `error` says it in words, with the filter's note for a drop. `content_type` is `null` unless a step set it. A test that drops or fails is still a `200`, but a pipeline that could never run is refused with `422 invalid_pipeline`, as saving it would be.

Testing a pipeline works on every plan. Testing a script needs a plan with scripts, shares a budget of 60 a minute per workspace with script saves, with bursts of 10, and also returns the script's `logs` and `fuel`.

An endpoint's **Send test ping** sends its fixed ping without the transformation, and so without a pipeline's credentials: a receiver that checks them turns it away. **Test**, or a real event, shows what your receiver will get.

## Versions and pausing {#versions}

Saving a changed pipeline or script makes its next version; saving one identical to the current version adds none. The last 50 versions are kept, and each delivery records the version that shaped it. In the console, **Versions** lists them, and **Load into editor** puts an earlier one in the editor; saving it makes it the newest version. Through the API, `GET /v1/transformations/{id}/versions` lists them, newest first, and `GET /v1/transformations/{id}/versions/{version}` returns one with its pipeline or code.

**Pause** stops a transformation without detaching it, as does `PATCH /v1/transformations/{id}` with `{"status": "disabled"}`. Its endpoints' deliveries wait rather than go out untransformed: they show as `failed`, with `last_error` "paused: the endpoint's transformation is not running", and go out when you **Resume** it (`{"status": "enabled"}`), through the version current then. Pausing and resuming a pipeline works on any plan.

## Attaching one to an endpoint {#set-up}

In the console, open the endpoint's menu on the **Endpoints** page and choose **Transformation**, or click its entry in the **Transformation** column. Then:

1. Choose **Pipeline** and build it: **Add a step**, start from a template, or paste a whole document under **JSON** and choose **Apply JSON**. Or choose **Script** and write the function.
2. [Test it](#test).
3. Choose **Save**. The endpoint's next deliveries run it.

**Off** and **Save** turn it off once you confirm, and deliveries go out as the event envelope again. If no other endpoint runs the transformation, it is deleted with its versions. Because a kind can't change, switching an endpoint from a script to a pipeline, or back, saves a new transformation in place of the old one, and deletes the old one if no other endpoint runs it. When one transformation runs on several endpoints, saving it changes it for all of them.

Through the API, create the transformation in the endpoint's project, then point the endpoint at it:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Paid invoices to the CRM", "project_id": "prj_…",
       "pipeline": {"version": 1, "steps": [
         {"filter": {"type": "invoice.paid"}, "note": "Paid invoices only"},
         {"drop": ["**.email"]},
         {"auth": {"type": "bearer", "secret": "sec_…"}}]}}'

curl -sX PATCH {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a… \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"transformation_id": "trf_…"}'
```

A script takes `code` in place of `pipeline`; sending both, or neither, is refused. Changing the document later is a `PATCH /v1/transformations/{id}` with a new `pipeline`. `POST /v1/endpoints` takes `transformation_id` too, `{"transformation_id": null}` detaches it, and a transformation from another project is refused as not found. Creating, changing and testing transformations and secrets takes an `admin` key; a `read` key lists and reads them.

## What a delivery shows {#deliveries}

A transformation runs once per delivery, at its first attempt. What it made is stored with the delivery, and every retry resends that same body, signed afresh, with the endpoint's headers as they are at that attempt. A pipeline's credentials are never stored: each attempt adds them again from the secret's value at that moment. [Redelivering](/docs/product-webhooks/deliveries#replay) runs the transformation's current version again.

In the console, open a delivery on the **Deliveries** page. **Transformed by** names the transformation and the version that ran, and the outcome is one of these:

- **Transformed**: the content type, the size, the headers it set, the names of the credentials it added, and the body that was sent.
- **Dropped**: a filter dropped the delivery, or the script returned `null`, so nothing was sent.
- **Failed**: why the run failed. The delivery is in the dead-letter queue.

Through the API, `GET /v1/deliveries/{id}/transform` returns the run, or `null` when none ran: `transformation_id`, `version`, `status` (`ok`, `dropped` or `failed`), `reason`, `error`, `body`, `content_type`, `header_names`, `credential_headers` and `credential_query` (names, never values) and `duration_ms`. A script's run also has `logs` and `fuel`.

### Dropped deliveries {#dropped}

When a filter drops a delivery, or a script returns `null`, nothing is sent and no attempt is made. The delivery settles as `sent` with `"dropped": true`, the console shows it as **dropped**, and endpoint and workspace stats count it apart from the delivered, so a success rate is worked out over what was meant to be sent. A drop is not a failure, for the endpoint or for the transformation. Nor does a dropped delivery count toward the [monthly delivery quota](/docs/product-webhooks#objects): the quota counts each delivery when its event is published, before a filter or script has run, and stops counting it when it is dropped. So once the quota is used up, a publish is still refused, even if a filter would drop every delivery it makes.

## When a run fails {#failures}

A pipeline that saved can still fail on a particular event: a `set` that would write inside a value that isn't an object (`set_conflict`), a body or a value over its [limit](#limits), a header value a header can't carry, or a credential whose secret is gone (`secret_missing`) or can't be sent (`invalid_secret`). The same pipeline fails the same way on the same event, so the delivery goes straight to the dead-letter queue, unsent, with a `last_error` such as `pipeline_failed: step 2: set_conflict: …`.

A script fails when it throws, runs out of time or memory, recurses too deeply, or returns something that isn't a request (an object with a `body`, or `null`). Its delivery goes to the dead-letter queue with a `last_error` that starts with `transform_failed:`.

We never send the untransformed event instead: the receiver may be a third party the transformation exists to keep data from.

Each failed run counts against the transformation, as failed deliveries count against an endpoint, and a run that sends or drops ends the streak. After 20 failures in a row the transformation is turned off (**turned off after failures** in the console, `auto_disabled` in the API), its endpoints' deliveries wait, and we email the workspace owner and send a `transformation.disabled` [operational webhook](/docs/product-webhooks/deliveries#operational). Fix it, test it and **Resume** it, or send `PATCH /v1/transformations/{id}` with `{"status": "enabled"}`: the deliveries that waited go out, and the dead-lettered ones can be [redelivered](/docs/product-webhooks/deliveries#replay).

## Limits {#limits}

A pipeline has no loops, no clock and no I/O, so the same pipeline on the same event always does the same thing, and fixed caps bound each run:

| Pipeline | Limit |
|---|---|
| Steps | 20 |
| Paths in a `drop`, fields in a `set`, names in each part of a `headers` step | 50 |
| A step's settings, as compact JSON | 16 KiB |
| A step's note | 200 characters |
| Nesting, in a step and in a body | 32 levels |
| The body a step reads, and the body sent | 256 KiB |
| One value a step renders | 64 KiB |
| Work in one run | 100,000 values read or copied, text counting one per KiB |
| Headers at the end of a run | 50 |
| One header value | 8 KiB |
| A secret's value | 8,192 characters |

| Script | Limit |
|---|---|
| CPU | About 50 ms of script time, counted in instructions rather than measured, so the same script gets the same budget however busy we are |
| Wall time | 1 second |
| Memory | 64 MiB |
| Script size | 1 MiB |
| Output | 256 KiB |
| Logs | 4 KiB |
| Scripts running at once, per workspace | 2 on Starter, 4 on Pro; on Custom, those of the plan the contract builds on |

## Errors {#errors}

A pipeline that could never run is refused when it is saved or tested, with `422 invalid_pipeline`. The refusal names the first problem: `details.reason`, `details.path` (a JSON Pointer to it) and `details.step` (counted from 0), each when it applies.

```json
{ "error": { "code": "invalid_pipeline", "message": "…", "details": { "reason": "managed_header", "path": "/steps/0/headers/set/User-Agent", "step": 0 }, "request_id": "…" } }
```

| `reason` | What is wrong |
|---|---|
| `invalid_document` | It isn't an object with a `version` and a list of `steps`. |
| `unsupported_version` | `version` isn't `1`. |
| `no_steps` | There are no steps. |
| `too_many_steps` | There are more than 20 steps. |
| `invalid_step` | A step isn't an object holding one step key, with nothing beside it but a `note` and, on a filter, an `action`. |
| `unknown_step` | A step key isn't `filter`, `drop`, `set`, `map`, `headers` or `auth`. |
| `invalid_value` | A setting isn't one its step takes, such as an empty `drop` or a note over 200 characters. |
| `invalid_path` | A path doesn't parse, or has a wildcard where its step takes none. |
| `invalid_template` | An expression doesn't parse, or names a filter that doesn't exist. |
| `invalid_filter` | A filter isn't valid, such as one with an unknown operator. |
| `invalid_header` | A header name isn't valid or is one the connection owns, or a value isn't printable ASCII on one line. |
| `invalid_secret` | An auth step's `secret` isn't a secret's id. A value pasted there is never quoted back. |
| `auth_not_last` | A step comes after an auth step. |
| `too_deep` | Something nests deeper than 32 levels. |
| `too_large` | A step's settings are over 16 KiB. |
| `not_json` | It holds a value that isn't JSON. |
| `managed_header` | A step sets a header we send ourselves: `X-Webhook-*` or `User-Agent`. |
| `forbidden_header` | A step sets a hop-by-hop or control header, such as `Expect`. |
| `unknown_secret` | An auth step names a secret its project doesn't hold. |

The other refusals:

| Status | Code | When |
|---|---|---|
| `422` | `validation_error` | A transformation sent with both `code` and `pipeline` or with neither, or a `PATCH` with the other kind's. |
| `402` | `not_entitled` (`feature: transformations`) | Creating a script, saving new code, resuming a script or testing one on a plan without scripts. |
| `422` | `invalid_transformation` | A script that doesn't load: `syntax_error`, `no_transform`, `code_too_large` or `load_failed`. |
| `409` | `conflict` (`transformation_in_use`) | Deleting a transformation an endpoint still runs. Detach it first. |
| `409` | `conflict` (`secret_in_use`) | Deleting a secret a pipeline's current version names. Change the pipeline first. |
| `404` | `not_found` (`transformation`, `transformation_version`, `secret`) | It doesn't exist, that version is no longer kept, or an endpoint names a transformation from another project. |
| `429` | `rate_limited` | Script saves and tests past 60 a minute per workspace. |
| `503` | `unavailable` (`transform`) | The sandbox couldn't run a script just then. Nothing was saved; try again. |

## What's next {#next-steps}

- [Slack, Teams and Discord](/docs/product-webhooks/chat-apps) — get a channel's webhook URL and send events to it.
- [Deliveries and retries](/docs/product-webhooks/deliveries) — states, retries and sending again.
- [Endpoint verification](/docs/product-webhooks/endpoint-verification) — the challenge, and receivers that can't answer it.
- [Webhooks API](/docs/reference/webhooks) — every route, `/v1/transformations` and `/v1/secrets` among them.
- [Webhooks overview](/docs/product-webhooks) — events, endpoints and subscriptions.
