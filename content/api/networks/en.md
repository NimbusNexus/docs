---
title: Networks
description: L2 broadcast domains that VMs and load balancers attach to. The base primitive of a project's VPC.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Networks

A network is a virtual L2 broadcast domain inside a region. VMs and load balancers don't attach to the internet directly — they attach to a **subnet**, which lives inside a **network**, which is what this resource describes.

## Two flavors {#flavors}

| Flavor       | Created by                          | Routable to internet         | Used for                                             |
| ------------ | ----------------------------------- | ---------------------------- | ---------------------------------------------------- |
| **External** | Auto-provisioned per region; shared | Yes (via floating IPs)       | The default uplink for most workloads                |
| **Tenant**   | You, inside the project             | No directly — needs a router | Private VPC, multi-tier apps, internal-only services |

The external network in each region (id pattern: `net_external_us_east_1`) is shared across all projects in that region but isolated at the security-group / VLAN level. Tenant networks are fully private and only visible inside your project.

## Why you'd create a tenant network {#why-tenant}

- **Multi-tier architecture.** Frontend VMs on a public-facing subnet; backend / DB VMs on a private subnet. The two sides talk over the tenant network without ever touching the public internet.
- **Multiple isolated environments in one region.** prod / staging / dev on three separate tenant networks; no accidental cross-talk.
- **Compliance.** Some workloads require private addressing for everything except a documented egress path. A tenant network + router lets you build that path explicitly.

For simple single-VM setups, just attach to the external network and skip tenant networks entirely.

## MTU and IPv6 {#mtu-ipv6}

Networks default to MTU 1500 (Ethernet standard). You can request a jumbo-frame network (MTU 9000) at creation time for high-throughput VM-to-VM workloads in the same network — beware that some external CDNs / partners don't negotiate jumbo frames cleanly.

IPv6 is enabled by setting the network's IP version to `dual` or `ipv6` (default `ipv4`). The subnets carved out of an IPv6-enabled network can be either v4 or v6 (mixed within one network is supported).

## What's next {#next-steps}

- [Subnets](/docs/api/subnets) — IP-address blocks carved out of a network.
- [Routers](/docs/api/routers) — connect tenant networks to the external gateway.
- [Security groups](/docs/api/security-groups) — firewall rules applied to interfaces inside a network.
- [Load balancers](/docs/api/load-balancers) — distribute traffic across VMs in a network.
