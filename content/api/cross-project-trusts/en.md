---
title: Cross-project trusts
description: Time-bounded permission grants between projects. The right primitive for cross-project automation.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: cross-project-trusts
---

# Cross-project trusts

A trust grants a user in one project temporary permission to act in another project — without that user needing membership or a shared API key. The trust carries a specific role, an expiration, and an optional impersonation scope.

The canonical use case: a CI/CD pipeline that's identified to project `shared-infra` but needs to deploy resources into `acme-prod`. Without trusts, you'd either give the CI key admin on both projects (bad blast radius) or copy keys between projects (worse). With a trust, `shared-infra` issues a time-bounded `vms:write` grant in `acme-prod`; the CI calls present the trust along with their normal credentials.

Trusts respect the security model — the granting user can only grant roles they themselves hold, and the trust expires no later than the grant they're delegating from. There's no privilege escalation path.

## What's next {#next-steps}

- [Roles](/docs/api/roles) — what a trust delegates.
- [Users](/docs/api/users) and [Projects](/docs/api/projects) — the endpoints of a trust.
- [Security model](/docs/security) — the wider context for IAM design.
