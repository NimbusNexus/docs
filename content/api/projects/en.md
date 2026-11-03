---
title: Projects
description: The unit of isolation for resources and access control, inside a workspace.
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Projects

A project is the **unit of isolation** on NimbusNexus — for resources and access control. Every project belongs to one [workspace](/docs/api/workspaces). Every resource (VM, volume, bucket, network, …) belongs to exactly one project, and every API key is scoped to exactly one project. Billing is per workspace: one bill covers all of its projects.

## Why projects matter {#why}

Two guarantees the project boundary gives you:

1. **Blast radius.** A compromised API key for the `dev` project can't touch `prod` resources. They literally aren't visible from inside `dev`.
2. **Quota.** Quotas are per-project. One project running away with VM creates doesn't drain another project's headroom.

## Creating a project {#create}

`POST /api/v1/projects/` takes the workspace's ID as `domain_id`, a `project_name` and, optionally, a `project_description` and `enabled`. The name must be unique in the workspace, or the API answers `409`. A workspace can have a limit on how many projects it holds; past it, create answers `403`.

Projects sit side by side in their workspace. The API has no way to nest one project under another.

## What lives in a project {#contents}

- VMs, volumes, backups
- Buckets
- Networks, subnets, routers, security groups, floating IPs, load balancers
- DNS zones + records
- Role assignments and API keys (the users they belong to live in the workspace)

Projects can't be merged. To consolidate two projects, you'd export-and-reimport the resources and delete the original — there's no atomic merge operation, deliberately, because the resulting "what got merged where" attribution would be unauditable.

## Deletion {#deletion}

`DELETE /api/v1/projects/` takes the project's `id` in the request body, and it's **irreversible**. It removes the project's default network, then deletes the project and its role assignments. It deletes nothing else, so delete the project's VMs, volumes, buckets and other resources first.

## What's next {#next-steps}

- [Workspaces](/docs/api/workspaces) — the container projects live in.
- [Roles](/docs/api/roles) — what users hold to do anything.
- [Quotas](/docs/api/quotas) — per-project resource limits.
