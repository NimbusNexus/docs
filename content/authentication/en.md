---
title: Authentication
description: API keys, scopes, project boundaries, and how to rotate credentials safely.
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: concept
---

# Authentication

The NimbusNexus API at `{{API_HOST}}` takes an **API key** in the `X-API-Key` header. Each key belongs to one person and works in one project, with the roles and access rules it was created with.

## How a request looks {#request-shape}

Send the key in the `X-API-Key` header:

```bash
curl {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY"
```

The key is the `api_key` value returned when you create it: the key's ID and its secret, joined by a colon and base64-encoded. A key the API can't decode or doesn't recognise answers `401`.

## Generating a key {#generating}

Create a key in the dashboard, or with `POST /api/v1/api_keys/` from a signed-in session scoped to the project the key is for. Give it a `name` that's unique among your keys and, optionally, a `description` and an `expires_at`. The response holds the key exactly once, in `api_key`; copy it then. After that, the API returns the key's name, roles, access rules and expiry, but never its secret.

## Project scope {#project-scope}

Every API key is scoped to a **single project**. The key can read and write resources in its project; it cannot see resources in other projects, even within the same account.

Projects are the unit of access control and isolation; billing is per workspace. The default project that ships with a new account is fine for individual development; production teams usually want a project per environment (`prod`, `staging`, `dev`) so a compromised dev key can't reach production data.

Switching projects = generating a new key in the target project. There's no "use this key but pretend you're in another project" mechanism; that would erode the isolation guarantee.

## What a key may do {#scopes}

A key acts with **roles** on its project, and **access rules** limit which calls it may make:

- `roles` — the roles the key acts with, chosen from the ones you hold on the project. Leave it out and the key gets all of them.
- `access_rules` — the calls the key may make. Each rule is a `service` (`api` for this API), a `method` and a `path`, such as `GET` and `/api/v1/instance/`. `GET /api/v1/api_keys/access_rules_artifacts` lists every method and path you can name; a path that doesn't exist answers `422` when you create the key.
- `unrestricted: true` — no access rules: the key can make any call its roles allow.

A key with neither access rules nor `unrestricted` can only read its own session (`GET /api/v1/account/get_session_auth_data`). A call outside a key's access rules answers `403`, with the message "API key is restricted for this path!". That makes it cheap to start with narrow rules and add calls only when one is refused.

## Rotation {#rotation}

There's no rotate call. To replace a key, create the new one, move your tools to it, then delete the old one with `DELETE /api/v1/api_keys/{api_key_id}`. The API checks the key on every request, so a deleted key stops working on its next call. Tools that hold the key long-term (CI/CD, deployed agents) should re-read it at process start time so a rotation propagates within a deploy cycle. Give keys an `expires_at`, so that a forgotten one stops working by itself.

If you suspect a key is compromised, delete it at once, in the dashboard or with `DELETE /api/v1/api_keys/{api_key_id}` from a signed-in session.

## Common errors {#errors}

The Webhooks and Inboxes APIs answer a credential problem with these codes. They differ on one point: `invalid_credential`, a key the API doesn't recognise, is a `403` on Webhooks and a `401` on Inboxes.

| Status    | error.code           | API  | What it means                                                                                                                                              |
| --------- | -------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401       | `unauthorized`       | Both | No credential was sent (neither `Authorization` nor `X-API-Key`), or the key has been revoked.                                                             |
| 401 / 403 | `invalid_credential` | Both | The key or token isn't valid: a `401` on Inboxes, a `403` on Webhooks. Replace it; sending it again won't work.                                            |
| 403       | `forbidden`          | Both | The key is valid but can't do this: a missing scope or role, a project-limited key used outside its projects, or a product not enabled for your workspace. |

`message` says which case you hit; branch on `code`, not the status: `invalid_credential` is a `403` on Webhooks and a `401` on Inboxes. Handle it alongside `unauthorized`, as "this credential is no good".

Earlier versions of this page listed `no_credentials`, `invalid_credentials`, `expired_credentials`, `scope_required` and `wrong_project`. The APIs have never sent those codes. They send `unauthorized` where the page said `no_credentials`; `invalid_credential` where it said `invalid_credentials` or `expired_credentials`, since an expired key is one the API can't verify; and `forbidden` where it said `scope_required` or `wrong_project`.

The errors above use the standard error shape described in [Errors](/docs/errors).

## What's next {#next-steps}

- Read [Conventions](/docs/conventions) for the patterns every endpoint follows (resource ids, pagination, errors, idempotency).
- Read the [Virtual machines reference](/docs/api/vms) for a concrete worked example of a resource API.
