---
title: Roles
description: Built-in and custom roles, plus the role-assignment endpoints that grant a user a role on a project.
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Roles

A role is a bundle of permissions. **Role assignment** is the act of granting a role to a user or a [group](/docs/api/user-groups) on a project, or on the workspace itself. The same user can hold different roles on different projects; a user with no role on a project can't see it at all.

## Built-in roles {#built-in}

`GET /api/v1/roles/` lists the roles you can grant: the platform's global roles, marked `is_global: true`, and any custom roles your workspace has created. The global roles include `reader`, `member`, `manager` and `admin`. `GET /api/v1/roles/{role_id}` reads one.

## Custom roles {#custom}

`POST /api/v1/roles/` creates a role in your workspace, with a `name` and an optional `description`. `PATCH /api/v1/roles/{role_id}` changes either one, and `DELETE /api/v1/roles/{role_id}` removes the role. Only your workspace's own roles can be changed or deleted; for a global role, both answer `404`.

## Granting and revoking {#grant}

`POST /api/v1/roles/grant` takes a list of assignments, so one call can grant several. Each assignment names a `role`, a `user` or a `group`, and a `project`, or a `domain` for the workspace itself, all by ID. `POST /api/v1/roles/revoke` takes the same list and removes those assignments.

`GET /api/v1/roles/assignments` lists the workspace's assignments, on its projects and on the workspace itself, including the ones that come through a group. Filter it by `role`, `user`, `group`, `project` or `domain`.

Grant and revoke also accept an admin's API key. The other role calls need an admin's session scoped to the workspace itself: an API key is always scoped to one project, so a key's call to them answers `400`.

## How role assignments compose {#compose}

A user can hold multiple role assignments on one project. The effective permission set is the **union** — the role list is additive, not multiplicative. A role granted to the user directly and another granted to one of their groups both apply.

Revoking one role doesn't revoke the others. To strip a user completely, revoke each assignment one at a time, or delete the user (which atomically revokes all assignments).

## What's next {#next-steps}

- [Users](/docs/api/users) — who you grant roles to.
- [Projects](/docs/api/projects) — what you grant roles on.
- [Authentication](/docs/authentication) — how API keys map to user roles.
