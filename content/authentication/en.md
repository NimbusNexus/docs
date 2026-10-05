---
title: Authentication
description: API keys, scopes, project boundaries, and how to rotate credentials safely.
publishedAt: 2026-05-19
updatedAt: 2026-10-05
kind: concept
---

# Authentication

The NimbusNexus API uses **API keys** as bearer tokens. There's one mechanism for every endpoint — no per-resource credential format, no separate signing scheme for "advanced" calls. If you can make one authenticated request, you can make all of them.

## How a request looks {#request-shape}

Send the key in the `Authorization` header. The format is the literal word `Bearer` followed by your key:

```bash
curl {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer nn_live_xxxxxxxxxxxxxxxx"
```

Keys are prefixed by environment: `nn_live_*` for production, `nn_test_*` for the sandbox. They're 32–48 characters of base32-safe alphabet after the prefix.

## Generating a key {#generating}

In the dashboard: **Settings → API keys → New key**. You'll see the key value exactly once at creation time; copy it then. After that the dashboard shows only the prefix + last 4 chars so you can identify which key is which without exposing the secret.

There's no API for creating API keys on purpose. A compromise-of-one-key recovery path needs an out-of-band channel that the compromised key can't reach — having to use the dashboard is the bottleneck that makes that recovery clean.

## Project scope {#project-scope}

Every API key is scoped to a **single project**. The key can read and write resources in its project; it cannot see resources in other projects, even within the same account.

Projects are the unit of access control, billing, and isolation. The default project that ships with a new account is fine for individual development; production teams usually want a project per environment (`prod`, `staging`, `dev`) so a compromised dev key can't reach production data.

Switching projects = generating a new key in the target project. There's no "use this key but pretend you're in another project" mechanism; that would erode the isolation guarantee.

## Scopes (capabilities) {#scopes}

Keys carry **scopes** that limit what they can do within their project. The default new-key scope set is read+write on everything in the project; you can narrow it at creation time to e.g. only `vms:read` for a monitoring agent that never needs to create resources.

The full scope list mirrors resource types:

- `vms:read`, `vms:write`, `vms:create`, `vms:delete`
- `databases:read`, `databases:write`, …
- `block-storage:read`, `block-storage:write`, …
- `object-storage:read`, `object-storage:write`, …
- `iam:read`, `iam:write` (manage users, projects, keys themselves)

A request that hits an endpoint requiring a scope the key doesn't carry returns `403 Forbidden` with `error.code: 'forbidden'`, and `error.message` says what was missing. That makes it cheap to start with narrow scopes and widen them only when something fails. (Earlier versions of this page promised `scope_required` with the scope in `error.fields.scope`; the API has never sent either.)

## Rotation {#rotation}

Every key can be rotated independently. Rotating a key:

1. Generates a new key value.
2. Marks the old key as **deprecated** but keeps it valid for **24 hours**.
3. Logs both keys' usage during that window so you can verify the new key is in use before the old key dies.

For automated rotation (which we recommend), call the IAM API to rotate on a schedule and let the 24-hour overlap absorb the rollout window. Tools that hold the key long-term (CI/CD, deployed agents) should re-read it at process start time so a rotation propagates within a deploy cycle.

If you suspect a key is compromised, **revoke** it instead of rotating — that skips the 24-hour grace period and invalidates the old key immediately. The dashboard has a one-click revoke; there's also an IAM endpoint for programmatic emergency revocation.

## Common errors {#errors}

The Webhooks and Inboxes APIs answer a credential problem with these codes. They differ on one point: a key the API doesn't recognise is a `403` on Webhooks and a `401` on Inboxes.

| Status | error.code           | API      | What it means                                                                                                                                  |
| ------ | -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 401    | `unauthorized`       | Both     | No credential was sent (neither `Authorization` nor `X-API-Key`), or the key has been revoked. On Inboxes, also a key it doesn't recognise. |
| 403    | `invalid_credential` | Webhooks | The key or token isn't valid. Replace it; sending it again won't work.                                                                         |
| 403    | `forbidden`          | Both     | The key is valid but can't do this: a missing scope or role, a project-limited key used outside its projects, or a product not enabled for your workspace. |

`message` says which case you hit; branch on `code`. `invalid_credential` stays a `403` on Webhooks: handle it alongside `401`, as "this credential is no good".

Earlier versions of this page listed `no_credentials`, `invalid_credentials`, `expired_credentials`, `scope_required` and `wrong_project`. The APIs have never sent those codes. They send `unauthorized` where the page said `no_credentials` or `expired_credentials`; `invalid_credential` (Webhooks) or `unauthorized` (Inboxes) where it said `invalid_credentials`; and `forbidden` where it said `scope_required` or `wrong_project`.

The errors above use the standard error shape described in [Errors](/docs/errors).

## What's next {#next-steps}

- Read [Conventions](/docs/conventions) for the patterns every endpoint follows (resource ids, pagination, errors, idempotency).
- Read the [Virtual machines reference](/docs/api/vms) for a concrete worked example of a resource API.
- For service-to-service setups inside your own infrastructure, you can also create **trust relationships** between projects — see the IAM reference (coming soon).
