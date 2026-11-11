---
title: Transforms quickstart
description: Test a pipeline on a request, save it, run it, see a request dropped, and save a new version, over the API.
publishedAt: 2026-11-06
updatedAt: 2026-11-11
kind: quickstart
---

# Transforms quickstart

From nothing to a versioned pipeline in a few minutes. You will test a pipeline on a request, save it, run it, see a request dropped, and save a new version. To see what a pipeline does before you sign in, try the [playground](/transforms/playground).

## Before you start {#before}

Create an API key in your [account console]({{ACCOUNT_BASE_URL}}/api-keys?product=transforms), with **Transforms** as the product and **Read & write** as its permission. Free is enough for everything here. Then put the key in an environment variable:

```bash
export TRANSFORMS_API_KEY="<your-api-key>"
```

Every path below is relative to `https://transforms.nimbusnexus.net`, and every request carries `Authorization: Bearer <your key>`.

## 1. Test a pipeline {#test}

This pipeline keeps paid invoices of $1,000 or more, removes the customer's email and any phone number, and adds two fields and a header. `POST /v1/pipelines/test` runs a document once, on a request you send, and saves and counts nothing:

```bash
curl -X POST https://transforms.nimbusnexus.net/v1/pipelines/test \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } },
        { "headers": { "set": { "X-Event-Type": "{{ type }}" } } }
      ]
    },
    "body": {
      "type": "invoice.paid",
      "data": {
        "id": "in_42",
        "amount": 150000,
        "currency": "usd",
        "customer": { "name": "Ana Silva", "email": "ana@example.com", "phone": "+1 202 555 0142" }
      }
    }
  }'
```

```json
{
  "status": "ok",
  "version": null,
  "body": {
    "type": "invoice.paid",
    "data": {
      "id": "in_42",
      "amount": 150000,
      "currency": "usd",
      "customer": { "name": "Ana Silva" }
    },
    "event_type": "invoice.paid",
    "amount_display": "1,500.00 USD"
  },
  "body_changed": true,
  "headers": { "X-Event-Type": "invoice.paid" },
  "query": {},
  "step": null,
  "note": null,
  "reason": null,
  "error": null,
  "duration_ms": 0.4
}
```

`status` is `ok`, so `body` and `headers` are what to send. `version` is `null` because nothing has been saved yet.

## 2. Save it {#save}

Save the same document as a pipeline, with a name:

```bash
curl -X POST https://transforms.nimbusnexus.net/v1/pipelines \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Paid invoices",
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } },
        { "headers": { "set": { "X-Event-Type": "{{ type }}" } } }
      ]
    }
  }'
```

The answer is `201` with [the pipeline](/docs/product-transforms/reference#pipeline), trimmed here:

```json
{
  "id": "pipe_8e27d40b19c3f6a5e0d71b42",
  "name": "Paid invoices",
  "status": "enabled",
  "current_version": 1,
  "destinations": [],
  "consumers": []
}
```

Keep the `id`: every later call takes it.

```bash
export PIPELINE_ID="pipe_8e27d40b19c3f6a5e0d71b42"
```

## 3. Run it {#run}

Send a request to the saved pipeline. The run takes a `body`, and optionally `headers` and `meta`, and answers what the pipeline did:

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body": {"type": "invoice.paid", "data": {"id": "in_42", "amount": 150000, "currency": "usd"}}}'
```

The answer has the same shape as the test's, with `"version": 1`. Nothing about the request is kept, and the run adds one to the month's count in `GET /v1/usage`. Sending the result on is up to you: Transforms sends nothing itself.

## 4. See a request dropped {#dropped}

Send an invoice below the filter's amount:

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body": {"type": "invoice.paid", "data": {"id": "in_43", "amount": 99999, "currency": "usd"}}}'
```

```json
{
  "status": "dropped",
  "version": 1,
  "body": null,
  "body_changed": false,
  "headers": {},
  "query": {},
  "step": 0,
  "note": "Paid invoices of $1,000 or more",
  "reason": "no_match",
  "error": "dropped by step 0 (Paid invoices of $1,000 or more)",
  "duration_ms": 0.1
}
```

It is still a `200`, because the pipeline ran. `step` counts from 0, and `reason` is `no_match` for a filter the request didn't match. Send nothing in this case.

## 5. Save a new version {#version}

`PATCH` the pipeline with a new document, here without the header step:

```bash
curl -X PATCH "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } }
      ]
    }
  }'
```

`current_version` is now `2`, and runs use it. Version 1 hasn't changed: `GET /v1/pipelines/{id}/versions` lists the kept versions, and a run can still name one:

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"version": 1, "body": {"type": "invoice.paid", "data": {"id": "in_42", "amount": 150000, "currency": "usd"}}}'
```

To go back to version 1, save its content again, which makes it version 3.

## In the console {#console}

The console at `https://transforms.nimbusnexus.net` does all of this with a form for each step: **Filter**, **Remove fields**, **Set fields**, **Reshape the body**, **Headers** and **Credential**. **Start from a template** offers Slack, Discord and Teams messages, Keep only these fields and Drop personal data, and **JSON** shows the whole document. Test what is in the editor before you save it.

## Cleaning up {#cleanup}

Each plan caps how many pipelines you may hold, so delete this one when you are done:

```bash
curl -X DELETE "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY"
```

Deleting is **permanent**, for the pipeline and every version. To stop it running for a while instead, `PATCH` it with `{"status": "disabled"}`, and back to `{"status": "enabled"}` later. A disabled pipeline answers a run with `409` `conflict`, `pipeline_disabled`.

## What's next {#next-steps}

- [Pipelines](/docs/product-transforms/pipelines) — every step, path, filter and template.
- [Transforms reference](/docs/product-transforms/reference) — every route and field, roles, limits and errors.
- [Transforms API](/docs/reference/transforms) — every operation, with the request in curl, TypeScript, Python or Go.
- [Product overview](/docs/product-transforms) — credentials, plans, and what Transforms does not do.
