---
title: Routers
description: Connect tenant subnets to the project's external gateway.
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Routers

A router is what gives a **tenant network** (and its subnets) internet access. VMs attached to a tenant subnet can't reach the public internet on their own — they're on a private L2 segment. A router bridges that segment to the region's external network, doing NAT for outbound traffic and (optionally) hosting floating IPs for inbound.

## When you need a router {#when-needed}

- **Public-facing VMs on a tenant network.** Attach a router, then allocate + attach a [floating IP](/docs/api/floating-ips). Outbound traffic NATs through the router; inbound on the floating IP routes back to the VM.
- **Mixed private/public app tiers.** Web tier sits behind a router with a floating IP; app + db tiers stay private and reach the internet (for things like package updates) via the router's source-NAT.
- **Multi-subnet routing.** A router can serve multiple subnets simultaneously. Traffic between two subnets on the same router is intra-VPC and never leaves NimbusNexus.

If you're attaching VMs directly to the external network, you don't need a router — the external network IS the gateway.

## SNAT, DNAT, and floating IPs {#nat}

A router has one external gateway connection (to the region's external network) and zero or more internal connections (to tenant subnets). Setting the gateway in `external_gateway_info` also takes `bandwidth_subscription` and `bandwidth_mbps` (a multiple of 10): the gateway is capped at that bandwidth, and the bandwidth is billed (see [Pricing data](/docs/api/pricing-data)).

- **Outbound from a private VM** → router does source-NAT to the router's external IP. Multiple private VMs share that one external IP for outbound.
- **Inbound to a floating IP** → router does destination-NAT to the private VM the floating IP is attached to. The private VM sees the original source IP (we preserve client IP through the NAT for inbound; only outbound SNATs).

Source NAT follows `external_gateway_info.enable_snat`, which is a platform setting. You don't configure destination NAT directly; the router handles it based on which floating IPs you've attached.

## Static routes {#static-routes}

A router carries a static-route table you can populate for non-default destinations. Each route sends traffic for a `destination` CIDR, from any subnet on the router, to a `nexthop` address — a different VM such as a VPN appliance or a transparent proxy. `PUT /api/v1/router/{router_id}/extraroutes` atomically adds routes, and `DELETE` on the same path atomically removes them. Most users never touch this; it's there for the advanced VPC layouts that need it.

## What's next {#next-steps}

- [Networks](/docs/api/networks) and [Subnets](/docs/api/subnets) — what routers connect.
- [Floating IPs](/docs/api/floating-ips) — inbound public addresses that ride on a router.
- [Security groups](/docs/api/security-groups) — the firewall layer applied at the VM interface (the router itself doesn't filter).
