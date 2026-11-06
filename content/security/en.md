---
title: Security model
description: How API keys, roles, access rules and projects combine to bound blast radius.
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: concept
---

# Security model

On the infrastructure API, three things bound what a credential can do: projects are the unit of isolation, roles say what a key may do on its project, and access rules narrow which calls it may make. This page is the conceptual overview; each piece has its own reference page for the details.

## The trust boundary {#trust-boundary}

A single project is the trust boundary. Inside a project, every authorized caller can affect every resource. Across projects, nothing can affect anything else unless you open it: a resource belongs to one project, quotas are per project, and a key works in one project.

That's the design. If two workloads need to be isolated from each other (production from staging, customer A from customer B), put them in different projects. Don't try to do isolation through access rules inside one project: they restrict what a single key can do, but another key in the project with wider rules still has full reach.

## Credentials {#api-keys}

The API takes two kinds of credential: an **API key** in the `X-API-Key` header, for tools and scripts, and a **signed-in session**, for a person at the dashboard.

Keys are:

- **Per-project.** A key scoped to project `acme-prod` cannot read anything in `acme-staging`, even from the same account.
- **Personal.** Each key belongs to the person who created it, and acts with roles they hold.
- **Created from a signed-in session**, in the dashboard or with `POST /api/v1/api_keys/`.
- **Good until you delete them**, or until the `expires_at` you gave them. There's no rotate call: to replace a key, create the new one, move your tools to it, then delete the old one.

See [Authentication](/docs/authentication) for the request shape and the details.

## Roles and access rules {#scopes}

A key acts with `roles` on its project, and its `access_rules` limit which calls it may make: each rule names a service, a method and a path. `unrestricted: true` means no access rules, so the key can make any call its roles allow. A key with neither can only read its own session.

The right pattern: **start narrow, widen on failure**. Create the key with only the calls you know you need. A call outside them answers `403`, and you make a new key that includes it. This catches "I gave my CI job admin by accident" mistakes during development, not in production.

## Projects {#projects}

Projects are the strongest isolation primitive: they're the resource boundary and the access-control boundary. Billing is per workspace. A person with a role on project `acme-prod` can't see resources in project `acme-staging` unless they also hold a role there.

Most teams want **at least one project per environment** (`prod`, `staging`, `dev`). The reason: a compromised dev key shouldn't be able to reach production data. Even better: one project per environment + service combination (`acme-prod-api`, `acme-prod-batch`) so a credential leak in the batch job can't read API customer data.

See [Projects](/docs/api/projects) for the details.

## Network model {#network}

A VM on a private network can't be reached from the internet. To reach the internet outbound, connect the network to a [router](/docs/api/routers) with an external gateway. To accept inbound traffic, attach a [floating IP](/docs/api/floating-ips). Every VM has at least one [security group](/docs/api/security-groups), which denies all ingress until you allow it.

Networks belong to one project. A VM in project `acme-prod` can't send traffic to a VM in project `acme-staging` over private IPs unless you share a network between them with [network sharing](/docs/api/network-sharing). There's no peering between project networks. Otherwise, the pattern is "expose a public API and call it via the internet", the same trust boundary as if the two workloads were at different companies.

## Data in transit {#in-transit}

The API is served over HTTPS. On the [Webhooks](/docs/product-webhooks) product, deliveries use TLS too: an endpoint's URL must be `https`.

## Reporting a vulnerability {#disclosure}

Found a security issue? Don't open a GitHub issue (it's public) and don't send a routine support ticket (slower triage). The [security disclosure form]({{BASE_URL}}/contact/security) routes directly to the security team, accepts PGP-encrypted bodies, and is acknowledged within 24 hours.

Safe-harbor terms are at [{{BASE_URL}}/legal/security-policy]({{BASE_URL}}/legal/security-policy). Good-faith research is welcomed.

## What's next {#next-steps}

- [Authentication](/docs/authentication) — how keys, roles and access rules work in practice.
- [Projects](/docs/api/projects) — the unit of isolation.
- [Network sharing](/docs/api/network-sharing) — the controlled way to connect two projects' networks.
