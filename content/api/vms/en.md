---
title: Virtual machines
description: Provision, inspect, resize, and destroy VMs. Live endpoint reference auto-generated from the OpenAPI spec.
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Virtual machines

A NimbusNexus virtual machine is a metered compute instance — one process tree, one network interface, one root disk — billed by the second. You create one by picking a size and a region; everything else (block volumes, public IPs, snapshots) attaches to it as separate resources.

## When to use a VM {#when-to-use}

VMs are the right primitive when you need:

- Persistent state on disk between requests (a database, a build cache, a long-running queue worker).
- Full OS control — installing packages, tuning kernel parameters, running anything that needs system access.
- A specific instance shape — high-memory for an analytics workload, GPU for inference, compute-optimized for a CPU-bound service.

If your workload is **stateless and request-shaped**, container platforms (Kubernetes managed services, serverless runtimes) are usually a better fit. The line is roughly: if you'd be sad if a process restart erased local files, you want a VM.

## Sizes, families, naming {#sizes}

Sizes use the shape `<family>-<vCPU>-<RAM_GB>`. Three families today:

- `gp-*` — general purpose. Balanced CPU + RAM. Most workloads start here.
- `co-*` — compute optimized. 2× the CPU-per-dollar of `gp`, half the RAM-per-dollar.
- `mo-*` — memory optimized. Inverse trade. Right for in-memory caches, JVM heaps, analytics scratch.

So `gp-4-16` is 4 vCPU, 16 GB RAM, general-purpose. `co-16-32` is 16 vCPU, 32 GB RAM, compute-optimized. The full list lives at `GET /v1/vms/sizes` (not yet auto-rendered in this reference — coming soon).

## Lifecycle {#lifecycle}

A VM moves through these states:

- `provisioning` — the disk is being prepared and the hypervisor is allocating the instance. ~5–30 seconds on a cached image, up to 90 seconds on a first-time image pull.
- `running` — boot complete, instance accepting traffic. This is the steady state you spend most of the time in.
- `stopping` → `stopped` — graceful shutdown. The VM persists; you stop being billed for compute but keep being billed for storage.
- `terminated` — the VM has been destroyed. Attached block volumes either also got destroyed (the default), or were detached and remain available (if `preserve_volumes: true` was set on delete).

State transitions are returned in the `state` field on every `GET`. Long-running transitions report progress under an embedded `operation` object — see the [Conventions](/docs/conventions) page for the operation-polling pattern that's used here and across the rest of the API.

## Naming and stable ids {#ids}

Two identifiers live on every VM:

- `id` — opaque, prefix `vm_`, 26-character base32 suffix. Stable for the life of the VM. Use this in URLs, foreign keys, audit logs.
- `name` — human-readable, 1–63 characters, alphanumeric + dashes, unique within a project. Mutable via `PUT /v1/vms/{id}`. Don't put this in any code path you don't want to rewrite the day someone renames the VM.

The endpoint reference below uses `{id}` in path templates; the value you pass is the opaque id.
