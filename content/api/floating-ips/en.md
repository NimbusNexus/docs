---
title: Floating IPs
description: Region-scoped public IPs that can be detached from one VM and reattached to another.
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Floating IPs

A floating IP is a public IP address that **belongs to your project, not to a specific VM**. You reserve one on an external network, allocate it to a port on a VM, and it becomes that VM's public IP. Detach it later and reattach to a different VM — your traffic now goes to the new VM, without the address changing.

## Why floating IPs exist {#why}

The default IP a VM gets is **ephemeral** — destroying the VM releases the IP back to the pool, and a recreated VM gets a new one. That's fine for stateless workers behind a load balancer. It's terrible for:

- Anything addressed by DNS A/AAAA record (the record breaks on every VM recreate)
- Anything in a partner's IP allowlist (the partner has to re-whitelist)
- Blue/green deployments where you want to swing traffic between two warm VMs without DNS propagation

A floating IP solves all three. The IP outlives any specific VM; you swing it from one VM to another with a single API call.

## Region scoping {#region}

Floating IPs are **region-scoped**. An IP comes from one region's external network and attaches only to ports in that region.

## Billing {#billing}

A floating IP bills at its own price from the moment it's created until it's deleted, attached or not. Attaching it to a VM doesn't fold it into the VM's cost. [Pricing data](/docs/api/pricing-data) has the current price.

The standard pattern: create the IP when you need it, attach it right away, and delete it when you're done.

## IPv4 vs IPv6 {#ipv4-ipv6}

There's no version field: an address comes from the external network you name in `floating_network_id`, and `POST /api/v1/floating_ip/reserve` can also take a specific `ip_address`. `GET /api/v1/floating_ip/artifacts` lists the external networks with each subnet's `ip_version`.

Each floating IP binds to one fixed IP on one port (`vm_port_id` and `vm_ip_address`), so a VM with several fixed IPs can carry one floating IP on each.

## Attach / detach semantics {#attach}

- **Attach** is `POST /api/v1/floating_ip/allocate`, with the external network (`floating_network_id`), the port (`vm_port_id`) and its fixed IP (`vm_ip_address`). Pass `floating_ip_id` to attach an address you already have; without it, allocate creates a new one. `GET /api/v1/floating_ip/artifacts?resource_id=<id>` lists a VM's or a load balancer's ports.
- **Detach** is `POST /api/v1/floating_ip/deallocate`. It doesn't release the IP; it just unbinds it from the VM. The IP keeps billing until you delete it, with `DELETE /api/v1/floating_ip/` (its id in `ids`) or `deallocate` with `delete: true`.
- Re-attaching the same IP to a different VM: this is exactly the failover path. Detach, attach to the new target, DNS doesn't change.

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — the resource that floating IPs attach to.
- [Regions](/docs/api/regions) — floating IPs are region-scoped.
