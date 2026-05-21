---
title: Floating IPs
description: Region-scoped public IPs that can be detached from one VM and reattached to another.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Floating IPs

A floating IP is a public IP address that **belongs to your project, not to a specific VM**. You allocate one, attach it to a VM, and it becomes that VM's public IP. Detach it later and reattach to a different VM — your traffic now goes to the new VM, without the address changing.

## Why floating IPs exist {#why}

The default IP a VM gets is **ephemeral** — destroying the VM releases the IP back to the pool, and a recreated VM gets a new one. That's fine for stateless workers behind a load balancer. It's terrible for:

- Anything addressed by DNS A/AAAA record (the record breaks on every VM recreate)
- Anything in a partner's IP allowlist (the partner has to re-whitelist)
- Blue/green deployments where you want to swing traffic between two warm VMs without DNS propagation

A floating IP solves all three. The IP outlives any specific VM; you swing it from one VM to another in ~2 seconds via a single API call.

## Region scoping {#region}

Floating IPs are **region-scoped**. An IP allocated in `us-east-1` can only attach to VMs in `us-east-1`. Cross-region failover requires either:

- A floating IP per region + a DNS-level failover (latency-based, health-checked)
- An anycast IP product, which we don't currently offer

This isn't a limitation we plan to remove — cross-region floating IPs would require routing public BGP advertisements globally, which is a totally different product than per-region allocation.

## Billing {#billing}

- **Attached** to a running VM: **\$0** — the IP is included in the VM cost.
- **Attached** to a stopped VM: \$2.50/month — same as the VM's reserved-IP line.
- **Unattached**: \$2.50/month — same rate. We charge for unattached IPs to discourage hoarding, which would deplete the regional pool faster than we can grow it.

The standard pattern: allocate the IP when you need it, attach immediately, release when you're done.

## IPv4 vs IPv6 {#ipv4-ipv6}

Floating IPs come in both flavors. `version: 'ipv4'` is the default (and what most people want). `version: 'ipv6'` is allocated from our `/48` per region; both are public and routable.

A VM can have one IPv4 floating IP and one IPv6 floating IP attached simultaneously. Multi-IPv4-per-VM is not supported; if you need multiple addresses on one VM, use VPC private addresses with NAT.

## Attach / detach semantics {#attach}

- **Attach** is atomic: the VM gains the address within ~2 seconds. Existing TCP connections to the VM's prior public IP (if any) are dropped — the kernel's routing table just changes.
- **Detach** doesn't release the IP; it just unbinds it from the VM. The IP keeps billing until you call DELETE.
- Re-attaching the same IP to a different VM: this is exactly the failover path. Detach, attach to the new target, DNS doesn't change.

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — the resource that floating IPs attach to.
- [Regions](/docs/api/regions) — floating IPs are region-scoped.
- The **Multi-region failover** guide (coming soon) covers the DNS-level pattern for cross-region failover when floating IPs alone aren't enough.
