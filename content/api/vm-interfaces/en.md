---
title: VM interfaces
description: Attach and detach network interfaces on a running VM.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: vm-interfaces
---

# VM interfaces

A VM interface is a network attachment on a VM — the binding between the VM and one of its [network ports](/docs/api/network-ports). Most VMs are fine with the default interface created at launch; you only manage interfaces directly when you need to attach a VM to multiple networks (e.g. dual-homed services, blue/green network swings).

Attaching an interface is hot — the VM doesn't reboot. The kernel sees the new NIC immediately; you may need to bring it up (`ip link set <name> up`) and configure addressing manually unless the image's cloud-init handles it.

Detaching is also hot. Sockets bound to the detached interface drop; sockets on other interfaces are unaffected.

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — the parent resource these interfaces belong to.
- [Networks](/docs/api/networks) and [Subnets](/docs/api/subnets) — what an interface attaches to.
- [Floating IPs](/docs/api/floating-ips) — the public-IP layer on top of an interface.
