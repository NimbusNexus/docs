---
title: Transforms reference
description: Every route of the Transforms API, the pipeline and run objects, who may do what, each plan's limits, and the errors.
publishedAt: 2026-11-06
updatedAt: 2026-11-06
kind: reference
---

# Transforms reference

The API at `https://transforms.nimbusnexus.net/v1` creates, versions, tests and runs pipelines, for your workspace only. Requests and answers are JSON. Send a key as `Authorization: Bearer <key>` or `X-API-Key: <key>` ([Getting access](/docs/product-transforms#access)). Timestamps are ISO 8601 in UTC. The [overview](/docs/product-transforms) explains the product, and [Pipelines](/docs/product-transforms/pipelines) the document.

## Routes {#routes}

| Route | What it does | Needs |
| --- | --- | --- |
| `POST /v1/pipelines` | Create a pipeline and its version 1; `201` with [the pipeline](#pipeline) | write; a credential step, admin |
| `GET /v1/pipelines` | The workspace's pipelines, newest first, each without its document | read |
| `GET /v1/pipelines/{id}` | One pipeline, with its current document and where it runs | read |
| `PATCH /v1/pipelines/{id}` | Rename it, switch it on or off, or [save a new version](#versions) | write; a new credential step, admin |
| `DELETE /v1/pipelines/{id}` | Delete a pipeline and its versions, for good; `204` | admin |
| `GET /v1/pipelines/{id}/versions` | The kept versions, newest first, each without its document | read |
| `GET /v1/pipelines/{id}/versions/{version}` | One version, with its document | read |
| `POST /v1/pipelines/{id}/run` | [Run](#run) a saved pipeline on a request | read |
| `POST /v1/pipelines/test` | [Test](#test) a document on a request, and save and count nothing | write |
| `GET /v1/pipelines/templates` | The [templates](/docs/product-transforms/pipelines#templates) to start from | read |
| `POST /v1/slots` | Add a [credential slot](#slots); `201` with the slot | admin |
| `GET /v1/slots`, `GET /v1/slots/{id}` | The workspace's slots, newest first, or one | read |
| `PATCH /v1/slots/{id}` | Rename a slot | admin |
| `DELETE /v1/slots/{id}` | Delete a slot; `204` | admin |
| `GET /v1/plan` | The workspace's plan and its limits | read |
| `GET /v1/usage` | This month's runs and what the workspace holds | read |

**read**, **write** and **admin** are explained under [Who can do what](#authority).

Lists are paged with `limit` (1 to 200, default 50) and `offset` (0 to 10,000). The answer is `{"items": [...], "next_offset": <offset>}`: pass `next_offset` back as `offset` for the next page. It is `null` on the last page.

## The pipeline object {#pipeline}

| Field | What |
| --- | --- |
| `id` | `pipe_` and 24 hex characters. Every route takes it, and a product refers to the pipeline by it. |
| `name` | Your name for it, up to 200 characters. |
| `status` | `enabled` or `disabled`: your switch. A disabled pipeline doesn't run, here or at any product that refers to it. |
| `current_version` | The version that runs. |
| `pipeline` | The current version's document; `null` on the list. |
| `destinations` | The services that run it by reference, each once; `null` on the list ([Who runs a pipeline](#destinations)). |
| `consumers` | What each of them runs: `service`, `version`, `last_seen_at`, its last fetch of that version, and `pinned`, `true` when a reference holds that version; `null` on the list. |
| `created_at`, `updated_at` | When it was created, and last changed. |

`POST /v1/pipelines` takes `name` and `pipeline`. A document that could never run is refused with [`422` `invalid_pipeline`](#invalid-pipeline), and over the plan's pipelines the answer is `402` `quota_exceeded`, with `details.metric` `pipelines`, `details.limit` and `details.current`.

## Versions {#versions}

`PATCH /v1/pipelines/{id}` takes any of `name`, `status` and `pipeline`. A new `pipeline` is checked as a create checks it, and saved as the next version.

- A version never changes, so a product can keep its copy by id and version.
- Saving the same content adds no version.
- Restoring an old version is saving its content again, which makes it the newest.
- The plan's versions are kept, the newest first, and a save removes the oldest beyond them. A version a product pins, or was seen running in the last 30 days, is kept as well.

Each version in `GET /v1/pipelines/{id}/versions` has `version`, `created_by` and `created_at`; `GET /v1/pipelines/{id}/versions/{version}` adds its `pipeline`. A version no longer kept answers `404` `not_found`, `pipeline_version`.

## Run a pipeline {#run}

`POST /v1/pipelines/{id}/run` runs the current version, or the kept one `version` names, on what you send:

| Field | What |
| --- | --- |
| `body` | Any JSON value, up to 256 KiB as compact JSON and nested at most 32 levels. |
| `headers` | One value per name. |
| `meta` | Read-only context for `$meta`: any JSON value, nested at most 32 levels. |
| `version` | The kept version to run. Without it, the current one. |

Nothing about the request is kept, and the run is counted. The answer is a `200` whatever the pipeline did:

| Field | What |
| --- | --- |
| `status` | `ok`, send `body` and `headers`; `dropped`, a filter dropped it, so send nothing; `failed`, the pipeline can't run on this request. |
| `version` | The version that ran; `null` on a [test](#test). |
| `body`, `body_changed` | The body to send, and `true` when a step rewrote it. `null` unless `ok`. |
| `headers` | The headers to send, a credential's value masked as `Bearer ••••`. |
| `query` | What an `auth` step adds to the URL, masked the same way. |
| `step` | The step that dropped or failed it, counted from 0; otherwise `null`. |
| `note` | A dropping step's note. |
| `reason` | `no_match` for a filter the request didn't match, `matched` for a drop filter it did, or why it failed, such as `set_conflict` or `too_many_nodes`. Treat it as an open string. |
| `error` | The same in words, such as `step 2: set_conflict: …`. |
| `duration_ms` | How long the run took. |

The same pipeline on the same request fails the same way, so don't retry a `failed`. A disabled pipeline answers `409` `conflict`, `pipeline_disabled`, and past the plan's rate a run answers `429` `rate_limited`, with `details.retry_after`.

## Test a document {#test}

`POST /v1/pipelines/test` takes `pipeline`, a document that need not be saved, with `body`, `headers` and `meta`. It is checked as a save checks it, runs once, and saves and counts nothing, though it shares the plan's rate. A drop or a failure is a `200` saying so.

## Credential slots {#slots}

A slot is what an `auth` step names: an id and a label, with no value. Transforms stores no credential, and no route takes one. A product that runs the pipeline by reference maps the slot to a secret of its own ([Credentials](/docs/product-transforms#credentials)). `POST /v1/slots` takes `label`, up to 200 characters, and answers `201`:

| Field | What |
| --- | --- |
| `id` | `sec_` and letters and digits: what an `auth` step names, and it never changes. |
| `label` | What the credential is for. Products see it when they map the slot to a secret. |
| `pipeline_count` | How many pipelines' current versions name it. |
| `created_at`, `updated_at` | When it was added, and last renamed. |

`PATCH /v1/slots/{id}` takes `label`. `DELETE /v1/slots/{id}` answers `204`, or `409` `conflict` with `details.reason` `slot_in_use`, `details.id` and `details.pipelines` while a pipeline's current version names it. Over the plan's slots, adding one answers `402` `quota_exceeded`, with `details.metric` `slots`.

## Who runs a pipeline {#destinations}

A product refers to a pipeline by id and runs it in its own process, on its own secrets. Webhooks is the first: [Transformations](/docs/product-webhooks/transformations). Each fetch notes the service and the version, so a read of a pipeline shows `destinations` and `consumers`.

Saving a new version with an `auth` step reaches every product that runs the pipeline, and so does deleting it. Each of those calls has to name every service that holds a reference or was seen in the last 30 days in `confirm_destinations`, in the body of a `PATCH` and in the query of a `DELETE`. Otherwise it is a `409` `conflict` with `details.reason` `destinations_unconfirmed` and `details.destinations`, and nothing changes. A service's own URLs are never here: that product holds the same question to them.

## Who can do what {#authority}

| | Read pipelines, versions, templates, slots, plan and usage; run | Create, change and test pipelines | Delete a pipeline, save a credential step, or add, rename or delete a slot |
| --- | --- | --- | --- |
| Workspace owner or admin | yes | yes | yes |
| Member | yes | yes | no |
| Viewer, or any other role | yes | no | no |
| Key with **Read & write** (`admin` scope) | yes | yes | yes |
| Key with **Read** (`read` scope) | yes | no | no |

A refused action answers `403` `forbidden` with `details.reason` `role`, and `details.required` names the role it needs. A member may still rename a pipeline with a credential step, run it, test it, and take the step out. The account console creates **Read** and **Read & write** keys, and a key with any other scope, such as `write`, is treated as **Read**.

Transforms serves whole workspaces. A guest seat, or a key limited to one project, is refused with `403` `project_confined`. A workspace has Transforms once an owner or admin has opened the console, or added it from **Add a product**. Until then, other members are refused with `403` `product_not_enabled`.

## Plans and limits {#limits}

`GET /v1/plan` says which limits apply: `plan`, the plan on record; `enforced_as`, the plan whose limits apply, `free` when there is none; `ceilings`, the limits by name; `past_due`, `suspended` and `system`.

| `ceilings` key | What | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- | --- |
| `max_pipelines` | Pipelines a workspace may hold | 5 | 25 | 100 | 1,000 |
| `max_secret_slots` | Credential slots a workspace may hold | 5 | 25 | 100 | 1,000 |
| `max_versions` | Versions kept per pipeline | 10 | 25 | 50 | 100 |
| `run_rate_per_min` | Runs and tests a minute, per workspace | 60 | 600 | 3,000 | 12,000 |

Up to ten seconds' worth of runs, and at least 10, may land at once. `GET /v1/usage` says how much is used: `period`, the month as its first day; `runs`, `failures` and `dropped` this month, through the run API; `pipelines` against `max_pipelines`; and `slots`, the slots held, against `max_secret_slots`. Runs are counted, not billed, and a run at a product that refers to the pipeline counts in that product's usage.

While a charge is unsettled, changes are refused with `402` `workspace_frozen`, and runs and tests go on. Once the grace period has ended, runs and tests are refused too, with `402` `workspace_suspended`. Reads and deletes stay open.

## Errors {#errors}

The API's errors use the shape described in [Errors](/docs/errors).

| Status | `code` | When |
| --- | --- | --- |
| `400` | `bad_request` | A JSON body that isn't valid UTF-8. |
| `401` | `unauthorized` | No credential, a revoked one, or a console sign-in that has ended; `details.reason` says which. |
| `401` | `invalid_credential` | A key that doesn't verify, has expired, or was created for another product. |
| `402` | `quota_exceeded` | Creating a pipeline or adding a slot while the plan's are all in use; `details.metric` is `pipelines` or `slots`. |
| `402` | `workspace_frozen`, `workspace_suspended` | A change while a charge is unsettled, or anything but a read or a delete after service has stopped. |
| `403` | `forbidden` | `details.reason` is `role`, `project_confined`, `product_not_enabled`, `csrf` or `no_workspace`. |
| `404` | `not_found` | No such pipeline, version or slot in your workspace; `details.reason` is `pipeline`, `pipeline_version` or `slot`. |
| `405` | `method_not_allowed` | The path exists, but not for this method. |
| `409` | `conflict` | `details.reason` is `pipeline_disabled` ([Run a pipeline](#run)), `destinations_unconfirmed` ([Who runs a pipeline](#destinations)) or `slot_in_use` ([Credential slots](#slots)). |
| `413` | `payload_too_large` | A request body over 1 MiB. |
| `422` | `invalid_pipeline` | A pipeline that could never run, when it is saved or tested. |
| `422` | `validation_error` | A parameter or field failed validation. A NUL character in the path, the query or a JSON body is the entry type `transforms.nul_character`. |
| `429` | `rate_limited` | Past the plan's runs a minute; `details.retry_after` says when to try again. |
| `500` | `internal_error` | Something broke on our side. |

### Invalid pipelines {#invalid-pipeline}

The refusal names the first problem: `details.reason`, `details.path` (a JSON Pointer to it) and `details.step` (counted from 0), each when it applies.

```json
{ "error": { "code": "invalid_pipeline", "message": "…", "details": { "reason": "credential_header", "path": "/steps/0/headers/set/Authorization", "step": 0 }, "request_id": "…" } }
```

| `reason` | What is wrong |
| --- | --- |
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
| `invalid_secret` | An auth step's `secret` isn't a slot's id. A value pasted there is never quoted back. |
| `auth_not_last` | A step comes after an auth step. |
| `too_deep` | Something nests deeper than 32 levels. |
| `too_large` | A step's settings are over 16 KiB, or the document is over 64 KiB. |
| `not_json` | It holds a value that isn't JSON. |
| `forbidden_header` | A step sets `Set-Cookie`, a header no request carries. |
| `credential_header` | A headers step sets `Authorization`, `Cookie` or `X-Api-Key`, which would store the credential in the pipeline. Add it with an auth step instead. |
| `unknown_slot` | An auth step names a slot the workspace doesn't hold. |

Treat `reason` as an open string, and keep a default for a value you don't know.

## What's next {#next-steps}

- [Quickstart](/docs/product-transforms/quickstart) — test a pipeline, save it and run it.
- [Pipelines](/docs/product-transforms/pipelines) — every step, path, filter and template.
- [Errors](/docs/errors) — the error shape, every `details` key, and a pattern for handling them.
