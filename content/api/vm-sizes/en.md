---
title: VM sizes
description: Compute flavors — vCPUs, RAM and swap — and how a VM gets one.
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# VM sizes

A VM size is a flavor: a vCPU count (`vcpus`), RAM in MB (`ram`) and swap in MB (`swap`). You don't pick a flavor when you create a VM: you set `spec.cpu` and `spec.ram`, and the API uses a flavor with exactly those numbers, creating one if none exists. The boot disk isn't part of the flavor; it's a separate volume.

## Architecture and VM class {#families}

Besides `cpu` and `ram`, a VM's `spec` names an `architecture` and a `vm_class`. Together they pick the product the VM is billed as. The ones on offer in your session's region are in `vm_options` from `GET /api/v1/instance/artifacts`.

## Naming convention {#naming}

Read a flavor's shape from `vcpus`, `ram` and `swap`, not from its name. A flavor the API creates for a VM is named after its `id`, a UUID, and so is one made with `POST /api/v1/flavor/` without a `name`. `GET /api/v1/flavor/` filters on the shape with `min_vcpus`, `max_vcpus`, `min_ram`, `max_ram`, `min_swap` and `max_swap`.

Prices depend on the `architecture`, `vm_class`, `cpu` and `ram`; see [Pricing data](/docs/api/pricing-data).

## Resizing {#resizing}

A VM can move between sizes without re-provisioning. Send `POST /api/v1/instance/{instance_id}/resize` with a new `spec` (`architecture`, `vm_class`, `cpu`, `ram`). The VM restarts on the new flavor and waits in `VERIFY_RESIZE`: `POST /api/v1/instance/{instance_id}/confirm_resize` keeps the new size, and `POST /api/v1/instance/{instance_id}/revert_resize` goes back to the old one. Both answer `400` if the VM isn't in `VERIFY_RESIZE`.

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — endpoints that actually provision a VM at one of these sizes.
- [VM images](/docs/api/vm-images) — the OS templates you boot the VM with.
- [SSH keys](/docs/api/ssh-keys) — public keys injected into VMs at boot.
