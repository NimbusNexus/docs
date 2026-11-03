---
title: Cross-project trusts
description: Short-lived delegations that let NimbusNexus act for you on one project, for queued jobs and object-storage credentials.
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: cross-project-trusts
---

# Cross-project trusts

A trust is a short-lived delegation from you to NimbusNexus's own service user, on one of your projects. NimbusNexus creates one when it has to finish work for you after your call returns, such as a queued VM create or delete or a volume create, and when you mint an object-storage credential. A trust record shows the `trustor_user_id` (you), the `trustee_user_id` (NimbusNexus), the `project_id`, the `roles` (`member` on every trust NimbusNexus creates), an `expires_at` and an `impersonation` flag.

The trust you create on purpose is an object-storage credential. `POST /api/v1/object_storage/credentials` mints one for your current project and returns its `trust_id`. A standalone editor presents that id in the `X-Trust-Id` header on object-storage calls, so it reaches the project's storage without holding your full token. `ttl_seconds` is a hint; the server caps it.

`GET /api/v1/trusts/` lists your trusts, and `GET /api/v1/trusts/{trust_id}` reads one. `DELETE /api/v1/trusts/{trust_id}` revokes one, for example a storage credential you no longer need.

## What's next {#next-steps}

- [Roles](/docs/api/roles) — what a trust delegates.
- [Users](/docs/api/users) and [Projects](/docs/api/projects) — the endpoints of a trust.
- [Object storage](/docs/api/object-storage) — where a storage credential is used.
- [Security model](/docs/security) — the wider context for IAM design.
