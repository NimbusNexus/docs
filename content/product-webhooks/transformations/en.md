---
title: Transformations
description: Reshape, filter or drop each delivery with a short JavaScript function that runs in a sandbox before the delivery is signed and sent.
publishedAt: 2026-10-30
updatedAt: 2026-10-30
kind: concept
---

# Transformations

A transformation is a short JavaScript function on an endpoint. It receives each event before we deliver it and returns the request to send instead, or `null` to send nothing. It runs in a sandbox with no network and a fixed CPU and memory budget, once per delivery; what it returns is signed with the endpoint's secret and sent like any other delivery.

## What it is for {#what-for}

- **Receivers that need their own shape.** Slack, Microsoft Teams and Discord accept only their own message formats and reject our envelope. A transformation turns each event into a message they take; the [presets](#presets) do it for you.
- **A different shape for each receiver.** Your own service gets the whole payload, a CRM gets three fields, an analytics vendor gets nothing with personal data in it.
- **Filtering on the payload.** A [subscription](/docs/product-webhooks#objects) matches on the event type only. "Only `invoice.paid` over $1,000" needs the payload, which a script can read.

## The script {#script}

A transformation is one function named `transform`:

```js
function transform(event, context) {
  // event:   { id, type, created_at, data, version }, the envelope we would otherwise send
  // context: { endpoint: { id, description }, attempt }
  if (event.type === "invoice.paid" && event.data.amount < 100000) {
    return null; // send nothing for small invoices
  }
  return {
    body: { text: `Invoice ${event.data.id} paid: ${event.data.amount / 100} ${event.data.currency}` },
    headers: { "X-Team": "billing" },
  };
}
```

What it returns decides what is sent:

| Return | Sent |
|---|---|
| `{ body: { … } }` or `{ body: [ … ] }` | The body as JSON, with `Content-Type: application/json`. |
| `{ body: "…" }` | The string as it is, with `Content-Type: text/plain; charset=utf-8`. |
| `{ body: …, contentType: "…" }` | The body with that content type. |
| `{ body: …, headers: { … } }` | The body, with these headers added, held to the same rules as an endpoint's custom headers. Set `contentType` rather than a `Content-Type` header. |
| `null` | Nothing. The delivery is [dropped](#dropped). |

The URL and the method stay the endpoint's: the URL is the one that was registered, checked and, where required, [verified](/docs/product-webhooks/endpoint-verification). Whatever the script writes with `console.log` is kept with the delivery, up to 4 KiB.

The script is plain modern JavaScript in one file. It has no network, no file system and no timers, and it cannot import modules, so a library it needs has to be bundled into it.

## Presets {#presets}

Presets are scripts we write and maintain, for the receivers people ask about most:

| Preset | Sends |
|---|---|
| **Slack message** | The event's type, id and data as a Slack message, for a Slack incoming webhook. |
| **Microsoft Teams card** | The event as an Adaptive Card, for a Teams workflow webhook. |
| **Discord message** | The event's type, id and data as a Discord message, for a Discord channel webhook. |
| **Keep only these fields** | The envelope with only the fields of `data` you list. A dotted name such as `customer.id` reaches inside. |

Choosing a preset saves its script as your own transformation, so you can open it and change it like any other. [Slack, Teams and Discord](/docs/product-webhooks/chat-apps) walks through each receiver from the start.

## Setting one up {#set-up}

In the console, open the endpoint's menu on the **Endpoints** page and choose **Transformation**. Pick **Preset** or **Script**, [test it](#test), and **Save**: the endpoint's next deliveries run it. **Off** takes it away again.

Through the API, create the transformation in the endpoint's project, then point the endpoint at it:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "CRM fields", "project_id": "prj_…", "code": "function transform(event) { return { body: { id: event.id, total: event.data.total } }; }"}'

curl -sX PATCH {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a… \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"transformation_id": "tr_…"}'
```

We load the script in the sandbox before saving it, without calling it: a syntax error, a missing `transform` function or top-level code that fails is refused with `422 invalid_transformation`, and nothing is saved. An endpoint runs at most one transformation; one transformation can serve several endpoints of its project. `{"transformation_id": null}` detaches it.

## Testing a script {#test}

**Test** runs the script in the editor, saved or not, through the same sandbox deliveries use, against a recent event from the endpoint's own deliveries or one you paste. It shows what would be sent, the headers, the logs and how long it took. Nothing is sent and nothing is saved.

Through the API:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations/test \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"code": "function transform(event) { return { body: { text: event.type } }; }",
       "event": {"id": "evt_1", "type": "invoice.paid", "created_at": "2026-10-30T12:00:00+00:00", "data": {}, "version": "1"}}'
```

```json
{ "status": "ok", "body": "{\"text\":\"invoice.paid\"}", "content_type": "application/json", "headers": {}, "logs": "", "reason": null, "error": null, "fuel": 2764502, "duration_ms": 3.6 }
```

`status` is `ok`, `dropped` (the script returned `null`) or `failed`, with `reason` and `error` saying why. A script that fails is still a `200`. Tests and save checks share one allowance of 60 a minute per workspace, with bursts of 10.

An endpoint's **Send test ping** still sends its fixed ping body untransformed; use **Test** to see what your receiver will get.

## What a delivery records {#deliveries}

The script runs once per delivery, at its first attempt. What it returns is stored with the delivery and signed with the endpoint's secret like any other body, and every retry resends those same bytes without running the script again, so a retry cannot change what the receiver gets. [Redelivering](/docs/product-webhooks/deliveries#replay) runs the transformation's current version again.

In the console, open a delivery on the **Deliveries** page to see the transformation and version that shaped it, how long the run took, the body that was sent, and the logs, or the error. Through the API, `GET /v1/deliveries/{id}/transform` returns that run, or `null` when none ran.

### Dropped deliveries {#dropped}

When the script returns `null`, nothing is sent and no attempt is made. The delivery settles as `sent` with `"dropped": true`, the console shows it as **dropped**, and endpoint and workspace stats count it apart from the delivered: a success rate is worked out over what was meant to be sent.

## When a script fails {#failures}

A run fails when the script throws, runs out of time or memory, recurses too deeply, or returns something that is not a request (an object with a `body`, or `null`). The delivery then goes straight to the dead-letter queue, with `last_error` starting `transform_failed:`. We never send the untransformed event instead: the receiver may be a third party the script exists to keep data from.

Each failed run counts against the transformation, like failed deliveries against an endpoint. After 20 failures in a row the transformation is turned off automatically, its endpoints' deliveries wait, and we email the workspace owner and send a `transformation.disabled` [operational webhook](/docs/product-webhooks/deliveries#operational). Fix the script, test it, and enable it again (**Resume** in the console, or `PATCH /v1/transformations/{id}` with `{"status": "enabled"}`): the deliveries that waited go out, and the dead-lettered ones can be [redelivered](/docs/product-webhooks/deliveries#replay).

## Pausing and versions {#versions}

**Pause** (`{"status": "disabled"}`) stops a transformation without detaching it. Its endpoints' deliveries wait instead of going out unshaped: they show as `failed`, with `last_error` "paused: the endpoint's transformation is not running", and go out when you resume it.

Every save of new code is a new version. The last 50 versions are kept (`GET /v1/transformations/{id}/versions`), and every delivery records the version that shaped it. To go back to an earlier version, load it into the editor and save it: it becomes the newest version.

## Limits {#limits}

Each run gets:

| Limit | Value |
|---|---|
| CPU | About 50 ms of script time, counted in instructions rather than measured, so the same script gets the same budget however busy we are |
| Wall time | 1 second |
| Memory | 64 MiB |
| Script size | 1 MiB |
| Output | 256 KiB |
| Logs | 4 KiB |

Scripts run in a service of their own, away from delivery, and each workspace can run only a few at once, so a slow or broken script costs its own deliveries and nobody else's. A typical script takes a few milliseconds.

## Plans {#plans}

Transformations, presets and scripts alike, are part of every paid plan: Starter, Pro and Custom. Free does not include them. Plans differ in how many of a workspace's scripts run at once: 2 on Starter, 4 on Pro, and what the contract says on Custom. The plan card on the console's Overview counts this month's runs. Runs are counted, not billed.

A workspace that leaves its paid plan keeps its transformations and can still rename, pause, detach and delete them, but not save new code, test or resume one. Deliveries to an endpoint that still has one wait until the plan includes transformations again or you detach it.

## Errors {#errors}

| Status | Code | When |
|---|---|---|
| `402` | `not_entitled` (`feature: transformations`) | Creating one, saving new code, enabling one or testing on a plan without transformations. |
| `422` | `invalid_transformation` | The script did not load: `syntax_error`, `no_transform`, `code_too_large` or `load_failed`, with the cause. |
| `409` | `conflict` (`transformation_in_use`) | Deleting a transformation an endpoint still runs. Detach it first. |
| `404` | `not_found` (`transformation`, `transformation_version`) | It is gone, or that version is no longer kept. |
| `429` | `rate_limited` | Past the 60 tests and save checks a minute. |
| `503` | `unavailable` (`transform`) | The sandbox could not run the script just then. Nothing was saved; try again. |

## What's next {#next-steps}

- [Slack, Teams and Discord](/docs/product-webhooks/chat-apps) — send events to a channel with a preset.
- [Deliveries and retries](/docs/product-webhooks/deliveries) — what happens to a delivery after its script runs.
- [Endpoint verification](/docs/product-webhooks/endpoint-verification) — why chat receivers need verification off.
- [Webhooks overview](/docs/product-webhooks) — events, endpoints and subscriptions.
