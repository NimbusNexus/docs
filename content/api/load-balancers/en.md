---
title: Load balancers
description: Managed L4 / L7 traffic distribution across a pool of backend VMs.
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Load balancers

A load balancer fronts a fleet of VMs with a single VIP (virtual IP), distributing traffic across the backends and removing unhealthy ones from rotation automatically. A listener speaks `TCP`, `UDP`, `SCTP`, `HTTP`, `HTTPS`, `TERMINATED_HTTPS` or `PROMETHEUS`, and sends all of its traffic to its default pool; there are no path or header routing rules.

## The four sub-resources {#sub-resources}

A load balancer is itself a container; the routing logic lives in nested resources:

- **Listener** — one per (protocol, port) the LB accepts traffic on. `HTTPS:443` is one listener; `HTTP:80` is another. A single LB can host many listeners.
- **Pool** — a group of backends, attached to one listener (`listener_id`) or to the load balancer (`loadbalancer_id`). Each pool has a `protocol` (`HTTP`, `HTTPS`, `TCP`, `UDP`, `SCTP`, `PROXY` or `PROXYV2`) and an `lb_algorithm`: `ROUND_ROBIN`, `LEAST_CONNECTIONS`, `SOURCE_IP` or `SOURCE_IP_PORT`. There's no session-persistence setting.
- **Member** — one backend in a pool: an IP `address` and a `protocol_port`, with a `weight` (0–256, default 1).
- **Health monitor** — the active health check per pool. Failed members are removed from rotation until they recover.

Each has its own endpoints, listed below: `/api/v1/loadbalancers/`, `/api/v1/listeners/`, `/api/v1/pools/`, `/api/v1/pools/{pool_id}/members/` and `/api/v1/health_monitors/`.

## SSL termination {#ssl}

For HTTPS listeners you have two choices:

- **TLS terminated at the LB.** Use a `TERMINATED_HTTPS` listener and point `default_tls_container_ref` (and `sni_container_refs`, for more certificates) at an existing certificate container. The LB serves TLS to clients while talking plaintext to your VMs. This API doesn't upload or issue certificates.
- **TLS passthrough.** The LB does L4 TCP forwarding only; your VMs handle TLS. Required when the backend needs to see the original client cert. Use an `HTTPS` or `TCP` listener.

## Health checks {#health-checks}

A health monitor probes each member every `delay` seconds and waits `timeout` seconds, less than `delay`, for an answer; you set both. Its `type` is `HTTP`, `HTTPS`, `PING`, `TCP`, `TLS-HELLO`, `UDP-CONNECT` or `SCTP`. `GET /api/v1/loadbalancers/{loadbalancer_id}/status` shows each member's `operating_status`.

- A member is removed from rotation after `max_retries_down` failed probes (3 if you leave it out).
- It's back in rotation after `max_retries` successful probes, which you must set.

For HTTP and HTTPS checks, set the `url_path`, `http_method` and `expected_codes`. Point `url_path` at something in your app that returns a quick body — and avoid making the check do real work, or the check itself becomes the load.

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — what becomes pool members.
- [Floating IPs](/docs/api/floating-ips) — alternative for single-VM public access without an LB.
- [Security groups](/docs/api/security-groups) — the firewall at the VM interface; LBs respect security groups on members.
