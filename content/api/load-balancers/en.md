---
title: Load balancers
description: Managed L4 / L7 traffic distribution across a pool of backend VMs.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Load balancers

A load balancer fronts a fleet of VMs with a single VIP (virtual IP), distributing traffic across the backends and removing unhealthy ones from rotation automatically. Two flavors: **L4** (TCP / UDP / proxy-protocol) and **L7** (HTTP / HTTPS with path + header routing).

## The four sub-resources {#sub-resources}

A load balancer is itself a container; the routing logic lives in nested resources:

- **Listener** — one per (protocol, port) the LB accepts traffic on. `HTTPS:443` is one listener; `HTTP:80` is another. A single LB can host many listeners.
- **Pool** — a group of backend VMs, defined per listener. Each pool has an algorithm (`round-robin`, `least-connections`, `source-ip-hash`) and a session-persistence policy.
- **Member** — one backend in a pool. References a VM + port + weight.
- **Health monitor** — the active health check per pool. Failed members are removed from rotation until they recover.

The endpoints below operate on the top-level load balancer. Nested CRUD for listeners/pools/members/health-monitors lives at `/v1/load-balancers/{id}/listeners`, etc. (not in this minimal sample — covered in the live spec).

## SSL termination {#ssl}

For HTTPS listeners you have two choices:

- **TLS terminated at the LB.** Upload a cert (or use Let's Encrypt via the cert-manager add-on), and the LB serves TLS to clients while talking plaintext to your VMs. Easier to manage; lets the LB inspect HTTP headers for L7 routing.
- **TLS passthrough.** The LB does L4 TCP forwarding only; your VMs handle TLS. Required when the backend needs to see the original client cert.

## Health checks {#health-checks}

A health monitor probes each member periodically (default every 10s) on a configured path / port. Three results:

- **Healthy** — last 2 probes succeeded (default; configurable). Member receives traffic.
- **Unhealthy** — last 3 probes failed (configurable). Member removed from rotation; current connections drain.
- **Recovering** — was unhealthy, now passing again. After 2 successful probes flips to healthy.

For HTTP health checks, the LB sends a GET to `/healthz` (configurable) and expects 200. Implement `/healthz` in your app to return a quick body — and avoid making the check do real work, or the check itself becomes the load.

## Pricing {#pricing}

Load balancers bill at a flat rate per hour per region (\$0.024/hr for the standard tier in the EN-pricing reference). Listener / pool / member / health-monitor creates are free. Cross-LB traffic between regions counts as standard inter-region egress.

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — what becomes pool members.
- [Floating IPs](/docs/api/floating-ips) — alternative for single-VM public access without an LB.
- [Security groups](/docs/api/security-groups) — the firewall at the VM interface; LBs respect security groups on members.
