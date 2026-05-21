---
title: Subnets
description: IP-address blocks carved out of a network. Each subnet has its own CIDR, gateway, and DHCP policy.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Subnets

A subnet is an IP-address block inside a [network](/docs/api/networks). VMs and load balancers attach to subnets, not directly to networks — a network is just a container that one or more subnets live inside.

## CIDR sizing {#cidr}

You pick the CIDR at creation time. Typical sizes:

| Use case               | CIDR  | Usable addresses |
| ---------------------- | ----- | ---------------- |
| Single-VM testing      | `/29` | 5                |
| Small app (≤ 20 VMs)   | `/27` | 27               |
| Medium app (≤ 100 VMs) | `/25` | 123              |
| Large app              | `/24` | 251              |
| Project-wide VPC       | `/16` | 65,531           |

Every subnet reserves: the network address (first), the broadcast (last), the gateway (typically `.1`), and our DHCP server (typically `.2`). So a `/24` subnet has 256 raw addresses but only 251 usable for VMs.

You can resize a subnet **larger** (`/27` → `/25`) online without disruption. You **cannot** shrink a subnet without recreating it; existing VM IPs would have to be renumbered.

## DHCP, SLAAC, and gateway behavior {#dhcp}

- **IPv4 subnets** use DHCP by default. Each VM gets a fixed address from the subnet's available range. You can pre-allocate specific IPs via the ports endpoint when you need a stable address (e.g. for an LB backend in DNS).
- **IPv6 subnets** use SLAAC by default. Each VM auto-generates an address from the subnet's `/64` prefix + its MAC address. DHCPv6 is available as an opt-in for environments that require deterministic addressing.
- **Gateway** is set per subnet. For tenant subnets that need internet access, the gateway points at the [router](/docs/api/routers) attached to the subnet; for the external network's auto-created subnet, the gateway points at our edge.

## Multiple subnets per network {#multiple}

You can attach multiple subnets to one network. A VM connected to that network can be reachable from every subnet inside it (subject to security groups). This is useful for IPv4 + IPv6 dual-stack — one v4 subnet + one v6 subnet on the same network gives every VM both stacks.

## What's next {#next-steps}

- [Networks](/docs/api/networks) — the parent of subnets.
- [Routers](/docs/api/routers) — what to attach a tenant subnet to so it can reach the internet.
- [Virtual machines](/docs/api/vms) — VMs attach to subnets via ports.
