---
title: Network sharing
description: Share a network, QoS policy, security group, subnet pool, address scope or address group with another project you hold a role on.
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: network-sharing
---

# Network sharing

Networks are normally project-isolated — a network in project `acme-prod` is invisible to `acme-staging`. Network sharing punches a controlled hole in that isolation: you share an object your project owns with another project you hold a role on, and the receiving project can use it as if it were their own — attach VMs to a shared network, say.

`POST /api/v1/rbac_policy/` does the sharing. It takes the `object_type` (`network`, `qos_policy`, `security_group`, `subnetpool`, `address_scope` or `address_group`), the object's `object_id`, an `action` such as `access_as_shared`, and the receiving project in `target_tenant`.

Use cases: a shared services network (databases, caches, internal APIs) that several application projects need to reach. The alternative is exposing the services on public IPs and re-securing them at L7 — possible, but more complex than sharing the L2 segment within the trust boundary of a workspace.

## What's next {#next-steps}

- [Networks](/docs/api/networks) — the resource that gets shared.
- [Projects](/docs/api/projects) — the owners and receivers of shared objects.
- [Security groups](/docs/api/security-groups) — what filters traffic on a shared network.
