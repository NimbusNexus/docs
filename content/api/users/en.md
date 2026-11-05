---
title: Users
description: Identity records in a workspace — assign roles, generate API keys.
publishedAt: 2026-05-20
updatedAt: 2026-11-05
kind: reference
---

# Users

A user is an identity in a [workspace](/docs/api/workspaces). Users hold roles on the workspace's [projects](/docs/api/projects) (which grant permissions) and can generate API keys (each one belongs to the user and is scoped to one project).

## User ≠ login {#identity-model}

A "user" in this API is **the identity record**, not the human. Each user belongs to exactly one workspace, and its name is unique there. Inside the workspace, the same user can hold different roles on different projects:

- One role on `prod` (the production project)
- Another role on `staging`
- No role at all on `dev`

What a user can do in a project comes from the roles it holds there, granted directly or through a [group](/docs/api/user-groups). That's the boundary to lean on for blast-radius containment: grant roles on `prod` only to the users who need them.

## What you can do to a user {#actions}

- **Create** — add a user to the caller's workspace, with a `name` and, optionally, a `password`, a `description` and the `enabled` flag.
- **Get** — read one user record by ID.
- **Update** — change the name, description, enabled flag or password.
- **Delete** — permanently remove. All role assignments and API keys owned by the user are revoked atomically.

All four need the `admin` role and a session scoped to the workspace itself, not to one of its projects. An API key is always scoped to one project, so a key's call to any of them answers `400`.

A password goes in and never comes out: a user record holds only `id`, `name`, `description` and `enabled`.

There's no "disable" separate from "delete." If you want a soft-disable (keep audit history, prevent login), set `enabled: false` via update — that's the soft-disable path. Delete is hard-delete + revoke everything.

## What you can't do {#cant-do}

- **Move a user to another workspace.** Create a new user in the target workspace, grant the roles you want there, delete the old one. Inside one workspace there's nothing to move: grant the user a role on the other project.
- **Reach a user in another workspace.** Get, update and delete only find users in the caller's workspace. For anyone else they answer `404`.

## What's next {#next-steps}

- [Workspaces](/docs/api/workspaces) — the container users live in.
- [Roles](/docs/api/roles) — what to grant a user once they exist.
- [Authentication](/docs/authentication) — how API keys (issued per user) work.
