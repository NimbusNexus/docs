---
title: Roles
description: Built-in and custom roles, plus the role-assignment endpoints that grant a user a role on a project.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Roles

A role is a bundle of permissions. **Role assignment** is the act of granting a role to a user on a project. The same user can hold different roles on different projects; a user with no role on a project can't see it at all.

## Built-in roles {#built-in}

Every project ships with four built-in roles you can assign without defining anything custom:

| Role                | What they can do                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **`viewer`**        | Read every resource. No writes, no deletes. Right for monitoring tools, auditors.                        |
| **`editor`**        | Create + update most resources. Cannot manage IAM (users, roles, keys). Right for day-to-day developers. |
| **`admin`**         | Everything `editor` can do, plus IAM. Can create users, grant/revoke roles, manage API keys.             |
| **`billing-admin`** | Read invoices, change payment method, view + raise quota. No resource access. Right for finance.         |

The `admin` role does **not** include `billing-admin` and vice versa. By design — the engineer who runs the API shouldn't also be the one approving the bill.

## Granular roles {#granular}

Beyond the four built-ins, we ship per-resource granular roles for the cases where `editor` is too much:

- `vms:operator` — create / start / stop / destroy VMs only, no networking
- `storage:operator` — manage volumes, buckets, snapshots, backups
- `dns:admin` — full DNS zone + record management; nothing else
- `networking:admin` — networks, subnets, security groups, floating IPs, LBs
- `databases:admin` — managed databases + their backups

You assign these the same way as built-ins, via `POST /v1/role-assignments`.

## Custom roles {#custom}

Define your own at `POST /v1/roles` (not in the minimal sample below) by listing the permissions to bundle. Permission names follow the pattern `<resource>:<action>` — e.g. `vms:read`, `volumes:create`, `databases:snapshot`. The full permission catalog is at `GET /v1/permissions`.

Use cases for custom roles: "read everything except billing" for a security auditor; "manage DNS records but not zones" for a marketing team that owns subdomain content but not the zone delegation.

## How role assignments compose {#compose}

A user can hold multiple role assignments on one project. The effective permission set is the **union** — the role list is additive, not multiplicative. Granting `viewer` + `vms:operator` to the same user gives them read on everything + write on VMs specifically.

Revoking one role doesn't revoke the others. To strip a user completely, delete each assignment one at a time, or delete the user (which atomically revokes all assignments).

## What's next {#next-steps}

- [Users](/docs/api/users) — who you grant roles to.
- [Projects](/docs/api/projects) — what you grant roles on.
- [Authentication](/docs/authentication) — how API keys map to user roles.
