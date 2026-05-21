---
title: Network ports
description: L2/L3 ports on a network. The lower-level primitive that VM interfaces and load balancers bind to.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: network-ports
---

# Network ports

A network port is the connection point between a network and something that uses it — a VM, a load balancer, a router. Most users don't manage ports directly; they create a VM with a network attachment and the port gets created behind the scenes. The API surface here is for the cases where you do need direct control: pre-allocating a port + IP before launching a VM, attaching a load balancer to a specific known IP, or migrating a service IP between hosts.

Ports carry a MAC address, one or more IP addresses on the parent subnet, and optional [security groups](/docs/api/security-groups) applied to filter ingress and egress. They're stateful — a port persists if you delete the VM it was attached to, ready to be re-attached to a replacement VM.

## What's next {#next-steps}

- [VM interfaces](/docs/api/vm-interfaces) — the higher-level "attach this to a VM" surface that creates ports under the hood.
- [Networks](/docs/api/networks) and [Subnets](/docs/api/subnets) — what ports live in.
- [Security groups](/docs/api/security-groups) — what filters port traffic.
