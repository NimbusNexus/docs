---
title: Authentication
description: API keys, scopes, project boundaries, and how to rotate credentials safely.
publishedAt: 2026-05-19
updatedAt: 2026-05-19
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

A request that hits an endpoint requiring a scope the key doesn't carry returns `403 Forbidden` with `error.code: 'scope_required'` and the missing scope in `error.fields.scope`. That makes it cheap to start with narrow scopes and widen them only when something fails.

## Rotation {#rotation}

Every key can be rotated independently. Rotating a key:

1. Generates a new key value.
2. Marks the old key as **deprecated** but keeps it valid for **24 hours**.
3. Logs both keys' usage during that window so you can verify the new key is in use before the old key dies.

For automated rotation (which we recommend), call the IAM API to rotate on a schedule and let the 24-hour overlap absorb the rollout window. Tools that hold the key long-term (CI/CD, deployed agents) should re-read it at process start time so a rotation propagates within a deploy cycle.

If you suspect a key is compromised, **revoke** it instead of rotating — that skips the 24-hour grace period and invalidates the old key immediately. The dashboard has a one-click revoke; there's also an IAM endpoint for programmatic emergency revocation.

## Common errors {#errors}

| Status | error.code            | What it means                                                                                           |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------- |
| 401    | `no_credentials`      | No `Authorization` header.                                                                              |
| 401    | `invalid_credentials` | Header is present but the key is unrecognized, revoked, or has the wrong format.                        |
| 401    | `expired_credentials` | Key was rotated and the 24-hour grace window has elapsed.                                               |
| 403    | `scope_required`      | Key is valid but doesn't carry the scope this endpoint needs. `error.fields.scope` tells you which one. |
| 403    | `wrong_project`       | Key valid; resource exists; key's project doesn't match the resource's project.                         |

The errors above use the standard error shape described in [Conventions](/docs/conventions).

## What's next {#next-steps}

- Read [Conventions](/docs/conventions) for the patterns every endpoint follows (resource ids, pagination, errors, idempotency).
- Read the [Virtual machines reference](/docs/api/vms) for a concrete worked example of a resource API.
- For service-to-service setups inside your own infrastructure, you can also create **trust relationships** between projects — see the IAM reference (coming soon).
