---
title: Workspaces
description: The isolation tier above projects. A workspace contains projects; projects contain resources.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: workspaces
---

# Workspaces

A **workspace** is the top-level isolation tier in the NimbusNexus account model. Every project belongs to exactly one workspace; every user has access scoped to workspaces (and to specific projects within them). The hierarchy is **workspace → project → resource**.

For most accounts, a single workspace is enough. Larger organizations use multiple workspaces to separate billing, access, and resource limits at the org-unit level — e.g. one workspace per business unit, or one per legal entity. Cross-workspace traffic, IAM, and billing are all isolated by design.

Don't confuse a workspace with a DNS zone — same word in some contexts (OpenStack calls workspaces "domains"), but the product surface uses "workspace" everywhere user-facing.

## What's next {#next-steps}

- [Projects](/docs/api/projects) — the next layer down; what workspaces contain.
- [Users](/docs/api/users) and [Roles](/docs/api/roles) — IAM grants are scoped within a workspace.
- [Cross-project trusts](/docs/api/cross-project-trusts) — time-bounded permission across project boundaries inside a workspace.
