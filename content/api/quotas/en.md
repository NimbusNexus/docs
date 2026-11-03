---
title: Quotas
description: Per-project limits on VMs, vCPU, RAM, storage, floating IPs, and other resources.
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Quotas

Quotas are per-project limits that bound how much of any one resource a project can hold. They prevent runaway spend from accidental loops, and they make sure one project's usage can't drain a region's capacity.

## What's quotaed {#what}

The quota endpoints cover four services. Each one answers with its own quota names, for example:

| Service    | What it limits             | Example quota names                                                   |
| ---------- | -------------------------- | --------------------------------------------------------------------- |
| `nova`     | VMs                        | `instances`, `cores`, `ram` (in MB)                                   |
| `cinder`   | Block storage              | `volumes`, `gigabytes`, `snapshots`, `backups`                        |
| `neutron`  | Networking                 | `network`, `subnet`, `port`, `router`, `floatingip`, `security_group` |
| `projects` | Projects in your workspace | `max_projects`                                                        |

Read the defaults with `GET /api/v1/quota/{service}?defaults=true`. `max_projects` is `-1`, meaning no limit, unless a limit has been set for your workspace.

## Quota vs usage {#quota-vs-usage}

The endpoints expose both:

- `GET /api/v1/quota/{service}` — the **limits**, as a map from quota name to number.
- `GET /api/v1/quota/{service}/usage` — the **current consumption**: `used`, `reserved` and `limit` for each quota name.

`{service}` is `nova`, `cinder`, `neutron` or `projects`.

Always check usage before bulk-creating; a request that would push you past quota fails (since the quota isn't time-bounded, retrying doesn't help — you need to delete something or raise the quota).

## Raising a quota {#raising}

Ask for a raise with `POST /api/v1/quota-request/`: give the `service_name`, the `quota_name` and the `new_value`, and say why in `reason`. The request is for your current project, or for your workspace when the service is `projects`. It needs the `manager` or `admin` role, and each quota can have only one open request at a time.

A NimbusNexus admin reviews each request by hand. Approving it applies the new limit; a request can also be rejected or sent back to you for changes. Either way, the answer arrives as a [notification](/docs/api/notifications). `GET /api/v1/quota-request/list` lists your requests, and `PATCH` or `DELETE /api/v1/quota-request/` changes or withdraws an open one.

## Quota across regions {#regions}

The `nova`, `cinder` and `neutron` figures are for the region your session is in; switch regions with `GET /api/v1/account/rescope?region=<region_name>`. The `projects` quota counts the projects in your whole workspace. Responses are plain maps of quota names to numbers, with no region or scope field.

## What's next {#next-steps}

- [Projects](/docs/api/projects) — the container quotas are scoped to.
- [Authentication](/docs/authentication) — how to call these endpoints.
- [Notifications](/docs/api/notifications) — where the answer to a quota request arrives.
