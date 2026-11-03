---
title: Users
description: Identity records in a workspace — assign roles, generate API keys, assume trusts.
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Users

A user is an identity in a [workspace](/docs/api/workspaces). Users hold roles on the workspace's [projects](/docs/api/projects) (which grant permissions), can generate API keys (each one belongs to the user and is scoped to one project), and can assume trusts to act on behalf of other projects.

## User ≠ login {#identity-model}

A "user" in this API is **the identity record**, not the human. Each user belongs to exactly one workspace, and its name is unique there. Inside the workspace, the same user can hold different roles on different projects:

- One role on `prod` (the production project)
- Another role on `staging`
- No role at all on `dev`

What a user can do in a project comes from the roles it holds there, granted directly or through a [group](/docs/api/user-groups). That's the boundary to lean on for blast-radius containment: grant roles on `prod` only to the users who need them.

## What you can do to a user {#actions}

- **Get** — read one user record by ID.
- **Update** — change the name, description, enabled flag or password.
- **Delete** — permanently remove. All role assignments and API keys owned by the user are revoked atomically.

All three need the `admin` role. Update and delete also accept an admin's API key. Get needs a session scoped to the workspace itself, not to one of its projects. An API key is always scoped to one project, so a key's call to get answers `400`.

People join and leave a workspace under **Members** in your [account console]({{ACCOUNT_BASE_URL}}/members): invite them there, and remove them there. This API reads and updates their user records.

Update still takes a `password`, but the dashboard and the apps never ask for it: they sign people in with their NimbusNexus account. A password never comes out: a user record holds only `id`, `name`, `description` and `enabled`.

There's no "disable" separate from "delete." If you want a soft-disable (keep audit history, prevent login), set `enabled: false` via update — that's the soft-disable path. Delete is hard-delete + revoke everything.

## What you can't do {#cant-do}

- **Create a user.** `POST /api/v1/users` answers `403 Forbidden`. A user created through the API would have no NimbusNexus account to sign in with, so invite people in the account console instead.
- **Move a user to another workspace.** Invite the person to the other workspace under **Members** in the account console, and grant them the roles they need there. Inside one workspace there's nothing to move: grant the user a role on the other project.
- **Look up a user in another workspace.** Get only finds users in the caller's workspace. For anyone else it answers `404`.

## What's next {#next-steps}

- [Workspaces](/docs/api/workspaces) — the container users live in.
- [Roles](/docs/api/roles) — what to grant a user once they exist.
- [Authentication](/docs/authentication) — how API keys (issued per user) work.
