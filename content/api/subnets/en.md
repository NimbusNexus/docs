---
title: Subnets
description: IP-address blocks carved out of a network. Each subnet has its own CIDR, gateway, and DHCP policy.
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Subnets

A subnet is an IP-address block inside a [network](/docs/api/networks). A VM attaches to the network through a port, and the port takes its address from one of the network's subnets.

## CIDR sizing {#cidr}

You pick the CIDR at creation time. Typical sizes:

| Use case               | CIDR  |
| ---------------------- | ----- |
| Single-VM testing      | `/29` |
| Small app (≤ 20 VMs)   | `/27` |
| Medium app (≤ 100 VMs) | `/25` |
| Large app              | `/24` |
| Project-wide VPC       | `/16` |

Not every address in the block goes to VMs: ports draw theirs from the subnet's `allocation_pools`.

A subnet's CIDR is fixed once it's created. `PUT /api/v1/subnet/{subnet_id}` changes its `name`, `dns_nameservers`, `allocation_pools`, `gateway_ip` and `enable_dhcp`, not its size; to get more addresses, add another subnet to the network. You **cannot** shrink a subnet without recreating it; existing VM IPs would have to be renumbered.

## DHCP, SLAAC, and gateway behavior {#dhcp}

- **IPv4 subnets** use DHCP by default. Each VM gets a fixed address from the subnet's available range. You can pre-allocate specific IPs via the ports endpoint when you need a stable address (e.g. for an LB backend in DNS).
- **IPv6 subnets** take the same fields as IPv4 ones, with `ip_version: 6`. There's no field to choose SLAAC or DHCPv6.
- **Gateway** is set per subnet. For tenant subnets that need internet access, the gateway points at the [router](/docs/api/routers) attached to the subnet.

## Multiple subnets per network {#multiple}

You can attach multiple subnets to one network. This is how you set up IPv4 + IPv6 dual-stack: one v4 subnet and one v6 subnet on the same network.

## What's next {#next-steps}

- [Networks](/docs/api/networks) — the parent of subnets.
- [Routers](/docs/api/routers) — what to attach a tenant subnet to so it can reach the internet.
- [Virtual machines](/docs/api/vms) — VMs attach to networks through ports.
