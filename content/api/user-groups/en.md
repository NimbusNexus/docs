---
title: User groups
description: Groups of users for shared role assignment. Useful when teams grow beyond per-user grants.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: user-groups
---

# User groups

A user group is a named collection of users that can be granted roles together. Instead of granting `vms:read` to fifteen engineers individually, you grant it to the `backend-team` group and add new engineers to the group.

Groups are scoped to a workspace. A user can belong to multiple groups; a group can hold roles in multiple projects within its workspace. Role assignments are additive — a user gets the union of every role granted directly to them plus every role granted to a group they belong to.

For small teams (under ~10 people) per-user grants are usually fine. Groups become the right answer somewhere between 10 and 50 users, when "audit who has access to project X" needs to be answerable in seconds and not by hand-checking 30 IAM entries.

## What's next {#next-steps}

- [Users](/docs/api/users) — the things groups contain.
- [Roles](/docs/api/roles) — what gets granted to a group.
- [Workspaces](/docs/api/workspaces) — groups are scoped here.
