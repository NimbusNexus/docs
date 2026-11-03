---
title: Region requests
description: Ask NimbusNexus to open a region it doesn't serve yet.
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: region-requests
---

# Region requests

A signed-in session can use any region NimbusNexus serves: `GET /api/v1/account/datacenters` lists them, and `GET /api/v1/account/rescope?region=<region_name>` switches to one (see [Account overview](/docs/api/account-overview)). A region request is for a place NimbusNexus doesn't serve yet. It tells us where you'd like us to open next.

A region request doesn't change quotas. To raise a limit, send a quota request with `POST /api/v1/quota-request/` (see [Quotas](/docs/api/quotas)).

`POST /api/v1/account/region-requests` backs the "request a region" form on the NimbusNexus website, so it needs no sign-in. Send an `email` and a `regionCode`: one of `ams`, `par`, `mad`, `sto`, `mil`, `waw`, `dxb`, `tlv`, `bom`, `icn`, `hkg`, `cgk`, `gru`, `mex`, `yyz` or `jnb`, or `__other` with the place in `regionOtherText`. `company` and `note` are optional. The answer is just `success`: nothing is approved or granted. We count the requests to see where demand is.

## What's next {#next-steps}

- [Regions](/docs/api/regions) — the list of available regions.
- [Quotas](/docs/api/quotas) — how to ask for a higher limit.
- [Account overview](/docs/api/account-overview) — the account context for region access.
