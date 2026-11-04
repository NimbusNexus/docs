---
title: Network ports
description: L2/L3 ports on a network. The lower-level primitive that VM interfaces and load balancers bind to.
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: network-ports
---

# Network ports

A network port is the connection point between a network and something that uses it — a VM, a load balancer, a router. Most users don't manage ports directly; they create a VM with a network attachment and the port gets created behind the scenes. The API surface here is for the cases where you do need direct control: creating a port with a known IP and attaching it to a running VM, attaching a load balancer to a specific known IP, or migrating a service IP between hosts.

Ports carry a MAC address, one or more IP addresses on the parent subnet, and optional [security groups](/docs/api/security-groups) applied to filter ingress and egress. A port you create yourself outlives the VM it's attached to, ready for a replacement VM; the ports a VM gets when it's created on a network are deleted with it. A port on the external network bills until you delete it (see [Pricing data](/docs/api/pricing-data)).

Creating a VM takes networks only (`network`), so a port you created joins a VM after launch: `POST /api/v1/instance/{server_id}/interfaces/` with its `port_id`.

## What's next {#next-steps}

- [VM interfaces](/docs/api/vm-interfaces) — the higher-level "attach this to a VM" surface that creates ports under the hood.
- [Networks](/docs/api/networks) and [Subnets](/docs/api/subnets) — what ports live in.
- [Security groups](/docs/api/security-groups) — what filters port traffic.
