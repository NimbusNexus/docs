---
title: Security groups
description: Stateful firewall rule sets applied to VM network interfaces.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Security groups

Security groups are **stateful firewall** rule sets. You attach one or more groups to a VM's network interface; the union of every group's rules is what gets enforced. Default behavior: **deny all ingress, allow all egress** — explicit allow-list for incoming traffic, open outbound until you say otherwise.

## Stateful means {#stateful}

You only write rules for the **initiating** direction. If you allow inbound TCP on port 443, the response packets to the client are allowed automatically — no separate egress rule needed for the return traffic.

Compare to a stateless ACL (e.g. AWS Network ACLs), where you'd need symmetric rules in both directions. Security groups are easier to reason about for application-level firewalling; stateless ACLs are easier to reason about for tenant-network policy at a layer below the VM.

## Rule shape {#rules}

Each rule has:

- **Direction** — `ingress` or `egress`
- **Protocol** — `tcp`, `udp`, `icmp`, or `any`
- **Port range** — single port (`80`), range (`8000-9000`), or "any"
- **Source / destination** — a CIDR block (`0.0.0.0/0`, `10.0.0.0/8`) OR another security group id

The "source is another security group" mode is the one most worth knowing about. A rule like "allow port 5432 from `web-tier-sg`" lets every VM in the `web-tier-sg` group hit your Postgres VM on 5432 — without needing to enumerate IPs, and the rule keeps working as VMs scale in and out of the `web-tier-sg`.

## A common pattern {#pattern}

For a 3-tier web app:

1. **`web-tier-sg`** — ingress allow `tcp/80` and `tcp/443` from `0.0.0.0/0` (public)
2. **`app-tier-sg`** — ingress allow `tcp/8080` from `web-tier-sg` (only the web tier can hit the app tier)
3. **`db-tier-sg`** — ingress allow `tcp/5432` from `app-tier-sg` (only the app tier can hit the database)

This composes; you can add a 4th group for an ops VPN that allows SSH from your office IPs, and attach it alongside `db-tier-sg` on the database VMs without touching the app rules.

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — what security groups attach to.
- [Networks](/docs/api/networks) and [Subnets](/docs/api/subnets) — the network primitives that security groups guard.
