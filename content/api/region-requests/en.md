---
title: Region requests
description: Request access to a region you don't currently have, or a quota uplift in a region you do.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: region-requests
---

# Region requests

By default new accounts get access to one region (whichever they picked at signup). Adding access to additional regions requires a region request — a short form explaining the workload that needs the new region. Most production accounts are approved within a business day; the gating exists for capacity planning and to flag unusual patterns (a brand-new account asking for capacity in five regions on day one is worth a brief conversation).

This endpoint also handles quota uplifts — a request to raise the VM count, vCPU, or storage limit in a region you already have access to. Same gating reason: large requests need capacity planning. See [Quotas](/docs/api/quotas) for the quota model itself.

The API surface here exists so programmatic deployment can fire-and-forget the request; the approval still happens manually on our side (this is one of the few corners of the API that isn't fully self-service by design).

## What's next {#next-steps}

- [Regions](/docs/api/regions) — the list of available regions.
- [Quotas](/docs/api/quotas) — the per-project limits a region-request can also adjust.
- [Account overview](/docs/api/account-overview) — the account context for region access.
