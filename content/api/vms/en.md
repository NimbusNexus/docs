---
title: Virtual machines
description: Provision, inspect, resize, and destroy VMs. Live endpoint reference auto-generated from the OpenAPI spec.
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Virtual machines

A NimbusNexus virtual machine is a compute instance with one boot disk and one network interface per network it joins. You create one with `POST /api/v1/instance/` in your session's region; everything else (block volumes, public IPs) attaches to it as separate resources.

## When to use a VM {#when-to-use}

VMs are the right primitive when you need:

- Persistent state on disk between requests (a database, a build cache, a long-running queue worker).
- Full OS control — installing packages, tuning kernel parameters, running anything that needs system access.
- A specific instance shape — the vCPU count and RAM your workload needs.

If your workload is **stateless and request-shaped**, container platforms (Kubernetes managed services, serverless runtimes) are usually a better fit. The line is roughly: if you'd be sad if a process restart erased local files, you want a VM.

## Shape and creation {#sizes}

`POST /api/v1/instance/` takes a `name` and a `spec` that sets the VM's shape: `architecture` and `vm_class`, `cpu` (vCPUs) and `ram` (MB), and the `volume_type` of its boot disk (see [Block storage](/docs/api/block-storage#tiers)). It also needs an `image` (or bootable `volumes`), at least one `network` and at least one `security_group`. Optional fields include `sshs` (the [SSH key](/docs/api/ssh-keys) to install), `volume_size` (the boot disk's size in GB when you boot from `image`; default 5), `user_data`, `metadata` and `subscription`. Joining a provider network also needs `bandwidth_mbps` and `subscription.bandwidth`; without them the call answers `400`.

There are no size codes. `GET /api/v1/instance/artifacts` lists the `architecture` and `vm_class` choices for your session's region in `vm_options`, along with the images, networks, security groups, SSH keys, server groups and volumes you can use. The VM runs on a [flavor](/docs/api/vm-sizes) with exactly your `cpu` and `ram`; the API creates one if none exists. Prices are in [Pricing data](/docs/api/pricing-data).

## Lifecycle {#lifecycle}

Creating a VM is asynchronous: `POST /api/v1/instance/` queues the work and answers `{"success": true}`, with no id. Find the new VM in `GET /api/v1/instance/` and follow its `status`, the compute service's own value. The ones you'll meet most:

- `BUILD` — the VM is being created.
- `ACTIVE` — running.
- `SHUTOFF` — stopped.
- `VERIFY_RESIZE` — resized, waiting for you to confirm or revert (see [VM sizes](/docs/api/vm-sizes#resizing)).
- `ERROR` — something failed; `fault` says what.

`POST /api/v1/instance/action` starts, stops or deletes VMs: list their ids in `servers` and set `cmd` to `start`, `stop` or `delete`. A stopped VM is still billed: billing runs from create until delete, on the plan in `subscription.vm` (default `Monthly`). Deleting a VM deletes the boot volume made from its image; volumes passed in `volumes`, or attached later, stay `available`.

## Naming and stable ids {#ids}

Two identifiers live on every VM:

- `id` — the VM's UUID. Stable for the life of the VM. Use this in URLs, foreign keys, audit logs.
- `name` — human-readable, any non-empty string. Change it, or the `description`, with `PATCH /api/v1/instance/{instance_id}`. Don't put this in any code path you don't want to rewrite the day someone renames the VM.

The endpoint reference below uses `{instance_id}` in path templates (`{server_id}` on the [VM interfaces](/docs/api/vm-interfaces) endpoints); the value you pass is the VM's `id`.
