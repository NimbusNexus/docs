---
title: Transforms
description: Declarative pipelines that filter, trim and reshape a request. Build, version and test them in one place, then run them over the API or by reference from the product that sends.
publishedAt: 2026-11-06
updatedAt: 2026-11-06
kind: concept
---

# Transforms

NimbusNexus Transforms makes **pipelines** objects of their own. A pipeline is a short list of declarative steps that drop a request unless it matches, remove or add fields, rebuild the body from a template and set headers. Build one in the console or over the REST API, test it, keep its versions, run it through the API, or refer to it by id from the product that sends.

> **Not the page you wanted?** Transforms sends nothing itself. To change what an endpoint receives on each delivery, see [Transformations](/docs/product-webhooks/transformations) in Webhooks, and to change what a bin forwards, see [A pipeline before each forward](/docs/product-bins/forwarding#pipeline) in Request Bins. Try a pipeline with no account in the [playground](/transforms/playground).

## At a glance {#at-a-glance}

| | |
| --- | --- |
| What you create | A **pipeline**: a JSON document of up to 20 steps, such as `{"version": 1, "steps": [{"drop": ["**.email"]}]}` |
| What it does | Filters a request, removes or adds fields, rebuilds the body from a template and sets headers |
| What it doesn't do | Send anything, or keep anything of what it runs on. It isn't a relay |
| Console | `https://transforms.nimbusnexus.net` |
| API base URL | `https://transforms.nimbusnexus.net/v1` |
| Authentication | `Authorization: Bearer <key>`, a key created in the account console with **Transforms** as the product |
| Identifier | The pipeline `id`, for example `pipe_8e27d40b19c3f6a5e0d71b42` |
| Try a document | `POST /v1/pipelines/test`, which saves and counts nothing |
| Run a saved pipeline | `POST /v1/pipelines/{id}/run`, which answers what it did |
| Every step, path and filter | [Pipelines](/docs/product-transforms/pipelines) |
| Every route, role and limit | The [Transforms reference](/docs/product-transforms/reference) |

## How it works {#how}

1. **Build** a pipeline: add steps in the console's form, paste them as JSON, or start from a [template](/docs/product-transforms/pipelines#templates). A document that could never run is refused when it is saved, with `422` `invalid_pipeline` naming its step, its path and the reason.
2. **Test** it. Run what is in the editor on a request you paste, and see the body and headers it would send, the step that dropped it, or why it failed.
3. **Save** it. Saving new content adds a version, and a version never changes. The same content again adds none, and restoring an old version is saving its content again.
4. **Run** it, in one of two ways:
   - **Through the API.** Send a request to `POST /v1/pipelines/{id}/run`. It runs the pipeline on what you send, answers with the result and keeps nothing. Sending the result anywhere is up to you.
   - **By reference.** [Refer to the pipeline by id from Webhooks](/docs/product-webhooks/transformations#reference), which runs it before each delivery in its own process. Each new version reaches it without a change to any endpoint.

The [quickstart](/docs/product-transforms/quickstart) does steps 1 to 4 over the API.

## What a run answers {#answers}

A pipeline has no loops, no clock and no network, so the same pipeline on the same request always does the same thing. A run answers `200` with one of three statuses, because in each case the pipeline ran:

| `status` | What it means | What to do |
| --- | --- | --- |
| `ok` | `body`, `headers` and `query` are the request to send. | Send it. |
| `dropped` | A filter dropped the request. `step`, `note` and `reason` say which, and why. | Send nothing. |
| `failed` | The pipeline can't run on this request. `step`, `reason` and `error` say why, such as a cap it went past. | Change the pipeline or the request. The same request fails the same way, so don't retry. |

## Credentials {#credentials}

Transforms holds no credentials. A pipeline's `auth` step says that a bearer token, basic auth or an API key goes on the request, and names a **slot** for it. A slot is an id and a label, with no value: add one in the console under **Credential slots**, or with `POST /v1/slots`. The document holds the slot's id and nothing else, so reading a pipeline back never shows a credential, and no route takes or returns a credential's value.

To send one, run the pipeline [by reference](/docs/product-webhooks/transformations#reference) from the product that sends. That product maps the slot to a secret in its own store, under its own key, and sends it to its own URLs. Outside that product the slot means nothing.

Test and the run API show what the step would add, with the value masked: `Authorization: Bearer ••••`. They can't send a credential, because Transforms has none to send.

Where a pipeline runs shows first. A read of a pipeline lists the products that run it by reference and the version each runs. Saving a new version with an `auth` step, or deleting the pipeline, has to name each of them in `confirm_destinations`, or it is refused with `409` `conflict`, `destinations_unconfirmed` ([Who runs a pipeline](/docs/product-transforms/reference#destinations)).

## Plans and limits {#limits}

| | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- |
| Pipelines | 5 | 25 | 100 | 1,000 |
| Credential slots | 5 | 25 | 100 | 1,000 |
| Versions kept per pipeline | 10 | 25 | 50 | 100 |
| Runs a minute | 60 | 600 | 3,000 | 12,000 |

All six steps, the templates, Test, the run API and running by reference are on every plan, Free included.

Runs are counted, not billed. `GET /v1/usage` shows the month's. Past the plan's rate, which Test shares, a run answers `429` `rate_limited` with how long to wait. A run at a product that refers to the pipeline counts in that product's usage. A version a product pins, or was seen running in the last 30 days, is kept beyond the plan's number.

## Getting access {#access}

Open the console at `https://transforms.nimbusnexus.net` and sign in with your NimbusNexus account, or add Transforms from **Add a product** in any NimbusNexus console. The first visit by a workspace owner or admin adds Transforms to the workspace, and other members can open it from then on.

Keys are not issued by the Transforms API. Create one in your [account console]({{ACCOUNT_BASE_URL}}/api-keys?product=transforms) under **API keys**, with **Transforms** as the product. A key is a JWT, so it begins `eyJ`. Present it as `Authorization: Bearer <key>` or `X-API-Key: <key>`.

Choose its permission when you create it: **Read** reads and runs pipelines, and **Read & write** can also create, change, test and delete them. [Who can do what](/docs/product-transforms/reference#authority) has the full table, workspace roles included.

## What it will not do {#not}

- **It does not send.** It has no destination, no retries and no delivery log. Webhooks delivers events and Request Bins forwards requests.
- **It does not keep what it runs on.** A run's request and answer are gone when the call ends. Only the count remains.
- **It does not hold credentials.** A credential comes from the product that runs the pipeline by reference.
- **It does not run code.** For logic the steps can't express, a Webhooks endpoint can run a [script](/docs/product-webhooks/transformations#script) instead, on a paid plan.

## What's next {#next-steps}

- [Quickstart](/docs/product-transforms/quickstart) — test a pipeline, save it, run it and save a new version.
- [Pipelines](/docs/product-transforms/pipelines) — every step, path, filter and template, and the caps on a run.
- [Transforms reference](/docs/product-transforms/reference) — every route and field, roles, limits and errors.
- [Run it from Webhooks](/docs/product-webhooks/transformations#reference) — map its slots to secrets and attach it to an endpoint.
- [Playground](/transforms/playground) — run a sample pipeline with no account.
