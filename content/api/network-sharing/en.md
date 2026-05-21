---
title: Network sharing
description: Share a network, subnet, or port between projects in the same workspace.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: network-sharing
---

# Network sharing

Networks are normally project-isolated — a network in project `acme-prod` is invisible to `acme-staging`. Network sharing punches a controlled hole in that isolation: the owner project shares a specific network with a specific other project (in the same workspace), and the receiving project can attach VMs to the shared network as if it were their own.

Use cases: a shared services network (databases, caches, internal APIs) that several application projects need to reach. The alternative is exposing the services on public IPs and re-securing them at L7 — possible, but more complex than sharing the L2 segment within the trust boundary of a workspace.

Cross-workspace sharing isn't possible — that's a deliberate isolation boundary.

## What's next {#next-steps}

- [Networks](/docs/api/networks) — the resource that gets shared.
- [Workspaces](/docs/api/workspaces) — the boundary of sharing.
- [Security groups](/docs/api/security-groups) — what filters traffic on a shared network.
