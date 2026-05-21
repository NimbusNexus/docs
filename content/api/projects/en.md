---
title: Projects
description: The unit of isolation for resources, billing, and access control.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Projects

A project is the **unit of isolation** on NimbusNexus — for resources, billing, and access control. Every resource (VM, volume, bucket, database, network, …) belongs to exactly one project; every API key is scoped to exactly one project; every invoice line is for exactly one project.

## Why projects matter {#why}

Three guarantees the project boundary gives you:

1. **Blast radius.** A compromised API key for the `dev` project can't touch `prod` resources. They literally aren't visible from inside `dev`.
2. **Cost attribution.** Each project gets its own bill. If finance wants to charge marketing for the website's hosting bill, marketing gets a project. If engineering wants to allocate spend per team, each team gets a project.
3. **Quota.** Quotas are per-project. One project running away with VM creates doesn't drain another project's headroom.

## Project hierarchy {#hierarchy}

Projects can have a parent project (organization tier and up). The hierarchy looks like:

```text
acme-org (root)
├── acme-prod
├── acme-staging
└── acme-dev
```

A user with the `admin` role on `acme-org` automatically inherits admin on every child. A user with admin only on `acme-prod` can't see `acme-staging` or `acme-dev`. This is the standard mechanism for "centralized governance, decentralized day-to-day."

Hierarchy is optional. Default-tier accounts get one root project per account; organization-tier accounts can build trees up to 5 levels deep.

## What lives in a project {#contents}

- VMs, volumes, snapshots, backups
- Buckets, archives
- Databases
- Networks, subnets, routers, security groups, floating IPs, load balancers
- DNS zones + records
- Users, roles + assignments, API keys
- The billing account that pays for all of the above

Projects can't be merged. To consolidate two projects, you'd export-and-reimport the resources and delete the original — there's no atomic merge operation, deliberately, because the resulting "what got merged where" attribution would be unauditable.

## Deletion {#deletion}

`DELETE /v1/projects/{id}` is **destructive and irreversible**. Every resource inside the project is destroyed: VMs, volumes, snapshots, backups, buckets, databases, DNS zones — all of it. The user records and role assignments are revoked atomically.

For safety the API requires a confirmation header (`X-Confirm-Project-Delete: <project-id>`) on this call; without it the request returns 400.

## What's next {#next-steps}

- [Users](/docs/api/users) — the identities inside a project.
- [Roles](/docs/api/roles) — what users hold to do anything.
- [Quotas](/docs/api/quotas) — per-project resource limits.
