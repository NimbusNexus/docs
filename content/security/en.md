---
title: Security model
description: How keys, scopes, projects, and audit logs combine to bound blast radius.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: concept
---

# Security model

NimbusNexus's security posture rests on four pillars: API keys are the only way to authenticate, projects are the unit of isolation, scopes narrow what each key can do, and audit logs record everything that mattered. This page is the conceptual overview; each piece has its own reference page for the details.

## The trust boundary {#trust-boundary}

A single project is the trust boundary. Inside a project, every authorized caller can affect every resource. Across projects, nothing can affect anything else — projects don't share networks, don't share IAM grants, don't share quotas.

That's the design. If two workloads need to be isolated from each other (production from staging, customer A from customer B), put them in different projects. Don't try to do isolation through scopes or labels inside one project — scopes restrict what a single key can do, but a compromised admin key in the project still has full reach.

## API keys {#api-keys}

The only credential the API accepts is an API key. There's no per-user OAuth flow, no JWT signing flow, no mTLS — just bearer keys. Why one mechanism: every additional credential type adds attack surface (issuance flow, revocation flow, propagation), and we'd rather make the one we have airtight.

Keys are:

- **Per-project.** A key scoped to project `acme-prod` cannot read anything in `acme-staging`, even from the same account.
- **Long-lived but rotatable.** A key created today is good until you rotate or revoke it. Rotation has a 24-hour overlap window so you can roll out the new key without an outage.
- **Created only via the dashboard.** No API for creating keys. A compromised key can't bootstrap another key — recovery has to go through an out-of-band channel.

See [Authentication](/docs/authentication) for the request shape, scope list, rotation flow, and error codes.

## Scopes {#scopes}

Every key carries a set of scopes that limit what it can do within its project. The full list mirrors resource types:

- `vms:read`, `vms:write`, `vms:create`, `vms:delete`
- `databases:*`, `block-storage:*`, `object-storage:*`, `iam:*`, ...

Scopes are an additive system: a key has the union of every scope it was granted. There's no negation, no precedence rules, no roles you have to reason through.

The right pattern: **start narrow, widen on failure**. Create the key with only the scopes you know you need; let the application fail with `403 scope_required` if you missed one, then add it. This catches "I gave my CI job admin by accident" mistakes during development, not in production.

## Projects {#projects}

Projects are the strongest isolation primitive — they're the resource boundary, the billing boundary, and the access-control boundary. A user with admin on project `acme-prod` can't see resources in project `acme-staging` unless they also have admin (or any scope) there.

Most teams want **at least one project per environment** (`prod`, `staging`, `dev`). The reason: a compromised dev key shouldn't be able to reach production data. Even better: one project per environment + service combination (`acme-prod-api`, `acme-prod-batch`) so a credential leak in the batch job can't read API customer data.

See [Projects](/docs/api/projects) for the resource shape and hierarchy mechanics.

## Network model {#network}

By default a VM is isolated. To reach the internet outbound, attach a [floating IP](/docs/api/floating-ips) or place it in a network with a router. To accept inbound traffic, attach the floating IP and (typically) put a [security group](/docs/api/security-groups) in front for stateful firewalling.

Cross-project networking doesn't exist. A VM in project `acme-prod` cannot send traffic to a VM in project `acme-staging`, period, even over private IPs — the underlying virtual switch enforces project-level isolation. If you need cross-project communication (rare), the right pattern is "expose a public API and call it via the internet" — same trust boundary as if the two workloads were at different companies.

VPC peering and similar cross-project network primitives may ship later; today they don't exist, and that's a deliberate constraint.

## Audit logs {#audit}

Every authenticated request that mutates state is logged with:

- `request_id` — the same id surfaced in error responses
- `key_id` — which key made the call (prefix + last 4 chars, never the full secret)
- `user_id` — the user who created the key
- `operation` — `vms.create`, `database.delete`, etc.
- `resource_id` — the resource that was affected
- `project_id` — which project
- `result` — `success`, `validation_error`, `unauthorized`, etc.
- `client_ip` — the source IP
- `timestamp` — ISO 8601 UTC

Audit logs are exposed in the dashboard with filter + export, and via the IAM audit API. Retention is **365 days** for free and starter tiers, **2 years** for production, and configurable for enterprise.

`GET`s are logged for resources flagged sensitive (IAM, billing, payment methods); they're not logged for routine reads (listing VMs) to keep log volume manageable. The list of "sensitive reads" is documented on the IAM reference page.

## Data at rest {#at-rest}

- **Block volumes:** AES-256-XTS with per-volume keys, managed by us. Customer-managed encryption keys (CMK) are on the roadmap; not yet available.
- **Object storage:** server-side AES-256 by default; SSE-C (customer-provided keys) and SSE-KMS (CMK via KMS) available.
- **Backups + snapshots:** same encryption as the source volume/object.
- **Database backups:** same encryption + the database engine's own at-rest encryption if enabled.

## Data in transit {#in-transit}

All API traffic is TLS 1.3 (TLS 1.2 accepted; older versions rejected at the gateway). Object-storage and database connections use TLS 1.3 with our certificates rotated automatically. Webhook deliveries from us to you use TLS; we don't accept plain `http://` URLs for webhook endpoints.

## Reporting a vulnerability {#disclosure}

Found a security issue? Don't open a GitHub issue (it's public) and don't send a routine support ticket (slower triage). The [security disclosure form]({{BASE_URL}}/contact/security) routes directly to the security team, accepts PGP-encrypted bodies, and is acknowledged within 24 hours.

Safe-harbor terms are at [{{BASE_URL}}/legal/security-policy]({{BASE_URL}}/legal/security-policy). Good-faith research is welcomed.

## What's next {#next-steps}

- [Authentication](/docs/authentication) — how keys, scopes, and rotation work in practice.
- [Projects](/docs/api/projects) — the unit of isolation.
- [Webhooks](/docs/webhooks) — securing the inbound deliveries we send to your endpoints.
