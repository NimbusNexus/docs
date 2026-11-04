---
title: Networks
description: L2 broadcast domains that VMs and load balancers attach to. The base primitive of a project's VPC.
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Networks

A network is a virtual L2 broadcast domain inside a region. VMs and load balancers attach to a **network** through ports, and each port's address comes from one of the network's **subnets**.

## Two flavors {#flavors}

| Flavor       | Created by                          | Routable to internet                | Used for                                             |
| ------------ | ----------------------------------- | ----------------------------------- | ---------------------------------------------------- |
| **External** | Auto-provisioned per region; shared | Yes — directly, or via floating IPs | The default uplink for most workloads                |
| **Tenant**   | You, inside the project             | Not directly — needs a router       | Private VPC, multi-tier apps, internal-only services |

The external network in each region is shared across all projects in that region. Its id is a UUID like any other; `GET /api/v1/network/` lists it with `router:external: true`. Tenant networks are visible only inside your project, unless you [share them](/docs/api/network-sharing).

## Why you'd create a tenant network {#why-tenant}

- **Multi-tier architecture.** Frontend VMs on a public-facing subnet; backend / DB VMs on a private subnet. The two sides talk over the tenant network without ever touching the public internet.
- **Multiple isolated environments in one region.** prod / staging / dev on three separate tenant networks; no accidental cross-talk.
- **Compliance.** Some workloads require private addressing for everything except a documented egress path. A tenant network + router lets you build that path explicitly.

For simple single-VM setups, just attach to the external network and skip tenant networks entirely. The VM's port then holds a public address. Creating a VM on the external network needs `bandwidth_mbps` and `subscription.bandwidth`, and the port and its bandwidth are billed (see [Pricing data](/docs/api/pricing-data)).

## MTU and IPv6 {#mtu-ipv6}

Set a network's `mtu` when you create or update it. The default and the largest value allowed are platform settings.

A network has no IP version of its own; its subnets do. Each subnet takes an `ip_version` of 4 or 6, and one network can hold both.

## What's next {#next-steps}

- [Subnets](/docs/api/subnets) — IP-address blocks carved out of a network.
- [Routers](/docs/api/routers) — connect tenant networks to the external gateway.
- [Security groups](/docs/api/security-groups) — firewall rules applied to interfaces inside a network.
- [Load balancers](/docs/api/load-balancers) — distribute traffic across VMs in a network.
