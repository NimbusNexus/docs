---
title: VM sizes
description: Catalog of compute shapes across the gp, co, mo, and gx families.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# VM sizes

A VM size is a named compute shape — vCPU count, RAM, root-disk size, and family. Every VM is created with a size code (e.g. `gp-4-16`); resizing a VM swaps the code at runtime.

## The four families {#families}

| Family                | Code prefix | What it's optimized for                                                                                     |
| --------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| **General purpose**   | `gp-*`      | Balanced CPU + RAM. The default for most workloads.                                                         |
| **Compute optimized** | `co-*`      | 2× CPU-per-dollar of `gp`, half the RAM-per-dollar. Right for CPU-bound services, batch jobs, video encode. |
| **Memory optimized**  | `mo-*`      | Inverse trade. Right for in-memory caches, JVM heaps, analytics scratch.                                    |
| **GPU**               | `gx-*`      | NVIDIA L4 / H100 accelerators. ML inference, training, transcode.                                           |

## Naming convention {#naming}

Size codes follow `<family>-<vCPU>-<RAM_GB>`. So:

- `gp-1-2` — 1 vCPU, 2 GB RAM, general-purpose (the smallest useful size, ~\$0.0145/vCPU-hour)
- `gp-4-16` — 4 vCPU, 16 GB RAM, general-purpose
- `co-16-32` — 16 vCPU, 32 GB RAM, compute-optimized
- `mo-8-64` — 8 vCPU, 64 GB RAM, memory-optimized
- `gx-4-32-l4` — 4 vCPU, 32 GB RAM, 1× L4 GPU (GPU sizes append the accelerator code)

The catalog endpoint returns the full list with current pricing per size. Prices vary slightly across regions; the response includes a per-region price table.

## Resizing {#resizing}

A VM can move between sizes without re-provisioning. Resize within the same family is online (no downtime). Cross-family resize requires a stop / start cycle. Resize between architectures (e.g. `gp` to `gx`) is a destroy / re-create — the API rejects the direct resize call to make the implicit data loss explicit.

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — endpoints that actually provision a VM at one of these sizes.
- [VM images](/docs/api/vm-images) — the OS templates you boot the VM with.
- [SSH keys](/docs/api/ssh-keys) — public keys injected into VMs at boot.
