---
title: Users
description: Identity records inside a project — assign roles, generate API keys, assume trusts.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Users

A user is an identity inside a [project](/docs/api/projects). Users hold roles (which grant permissions), can generate API keys (scoped to the user), and can assume trusts to act on behalf of other projects.

## User ≠ login {#identity-model}

A "user" in this API is **the identity record**, not the human. The same person can be:

- One user in `prod` (the production project)
- Another user in `staging` (separate identity record, same email)
- A third user in `dev`

Each user is fully isolated from the others — they have their own role assignments, their own API keys, their own audit trail. That's the project-isolation boundary we lean on for blast-radius containment: a compromised `dev` user can't touch production resources because they literally don't exist as an identity there.

For organizations that want one human → one identity across projects, federate via SAML/OIDC; the SSO-provided identity becomes the same user across all projects mapped by the IdP rules. That's an enterprise feature; default-tier accounts use the per-project model above.

## What you can do to a user {#actions}

- **Create** — provision a new user inside the caller's project. Must have `iam:write` on the project.
- **Get** — read a user record. `iam:read` suffices.
- **Update** — change name, description, enabled flag. Some fields (e.g. email) are immutable post-create; the API returns 400 if you try.
- **Delete** — permanently remove. All role assignments and API keys owned by the user are revoked atomically.

There's no "disable" separate from "delete." If you want a soft-disable (keep audit history, prevent login), set `enabled: false` via update — that's the soft-disable path. Delete is hard-delete + revoke everything.

## What you can't do {#cant-do}

- **Move a user between projects.** Create a new user in the target project, copy the role grants you want, delete the old one.
- **Set a password via API.** Passwords go through the password-reset flow only; the API never accepts a plaintext password as input. Users with SSO bypass passwords entirely.
- **List users in a project you don't have role assignments on.** The project isolation is hard — no cross-project enumeration.

## What's next {#next-steps}

- [Projects](/docs/api/projects) — the container users live in.
- [Roles](/docs/api/roles) — what to grant a user once they exist.
- [Authentication](/docs/authentication) — how API keys (issued per user) work.
