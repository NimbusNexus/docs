---
title: Quotas
description: Per-project limits on VMs, vCPU, RAM, storage, floating IPs, and other resources.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Quotas

Quotas are per-project limits that bound how much of any one resource a project can hold. They prevent runaway spend from accidental loops, and they make sure one project's usage can't drain a region's capacity.

## What's quotaed {#what}

Every project has a quota on each of:

| Resource            | Default quota | Notes                                                           |
| ------------------- | ------------- | --------------------------------------------------------------- |
| VMs                 | 50            | Per region; "VM" counts every state except `terminated`         |
| vCPU                | 200           | Total across every running VM                                   |
| RAM (GB)            | 800           | Total across every running VM                                   |
| Block storage (GB)  | 5,000         | Sum of every volume (attached + detached)                       |
| Object storage (GB) | unlimited     | Soft-only: we'll contact you above ~50 TB to align expectations |
| Snapshots           | 200           | Per region; deleted snapshots don't count                       |
| Backups             | 500           | Per region                                                      |
| Floating IPs        | 20            | Per region                                                      |
| Networks            | 10            | Per region                                                      |
| Security groups     | 50            | Per region                                                      |
| Load balancers      | 10            | Per region                                                      |
| DNS zones           | 50            | Project-wide                                                    |
| Users               | 25            | Project-wide                                                    |

Defaults are conservative. Most production projects get bumped to 5–10× on the most-used axes (vCPU, RAM, storage) shortly after launch.

## Quota vs usage {#quota-vs-usage}

The endpoints expose both:

- `GET /v1/quotas` — the **limits** (50 VMs, 200 vCPU, etc.)
- `GET /v1/quotas/usage` — the **current consumption** (12 VMs used of 50, 48 vCPU of 200, etc.)

Always check usage before bulk-creating; a request that would push you past quota returns 429 with `Retry-After` blank (since the quota isn't time-bounded, retrying doesn't help — you need to delete something or raise the quota).

## Raising a quota {#raising}

Quota raises go through the support contact form, not the API. Three reasons:

1. **Capacity planning.** Large raises (10×+) need to reserve hardware in the target region.
2. **Compliance.** Some quota raises require a brief conversation about the workload shape.
3. **Abuse prevention.** A self-service quota-raise endpoint would be the first thing a compromised account would call.

Most raises clear in under a business day. Production migrations get same-day turnaround if you flag them in the request.

## Quota across regions {#regions}

Most quotas are **per-region** (VMs, snapshots, networks). A few are **project-wide** (DNS zones, users). The endpoint response makes this explicit — each quota entry carries a `scope` field (`region: us-east-1` or `project`).

## What's next {#next-steps}

- [Projects](/docs/api/projects) — the container quotas are scoped to.
- [Authentication](/docs/authentication) — how to call these endpoints.
- The **support contact form** at [/contact/support]({{BASE_URL}}/contact/support) — where quota raises live.
