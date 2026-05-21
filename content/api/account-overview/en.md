---
title: Account overview
description: Top-level account metadata — owner, billing contact, region access, plan tier.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: account-overview
---

# Account overview

An "account" sits above every workspace, project, and resource you own at NimbusNexus. It carries the billing contact, the legal entity name on invoices, the plan tier (free / starter / production / enterprise), the regions you're allowlisted into, and account-wide preferences. There's exactly one account per signup.

Most of these endpoints are read-only for non-owners and read-write for owners. Day-to-day work happens at the project level; account-level calls are typically once-per-quarter operations (changing billing contact, requesting a new region, upgrading the plan tier).

## What's next {#next-steps}

- [Workspaces](/docs/api/workspaces) — the next layer down inside the account.
- [Subscriptions](/docs/api/subscriptions) — the plan-tier and billing-cycle endpoints.
- [Region requests](/docs/api/region-requests) — request access to a region you don't have yet.
