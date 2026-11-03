---
title: QoS policies
description: Bandwidth limits, DSCP marking and minimum-bandwidth rules for ports, networks, router gateways and load balancer VIPs.
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: qos-policies
---

# QoS policies

A QoS policy bundles a set of network-quality rules — bandwidth caps, DSCP packet marking, and minimum-bandwidth rules — and applies them to [network ports](/docs/api/network-ports), whole networks, router gateways or load balancer VIPs, through their `qos_policy_id` (a load balancer's is `vip_qos_policy_id`). The most common rule is a **bandwidth limit** (cap throughput on a port at 100 Mbps, say, to prevent a runaway workload from saturating shared uplinks).

DSCP marking adds priority hints to packets leaving a port — useful when downstream networks (your office, a partner network) honor DSCP for traffic shaping. A minimum-bandwidth rule asks for at least `min_kbps` in one `direction`.

For typical workloads you don't need a policy of your own. NimbusNexus already attaches a bandwidth-limit policy when you create a VM on the external network or give a router an external gateway, sized to the `bandwidth_mbps` you chose. `POST /api/v1/bandwidth/resize` changes the limit on a port, floating IP or router gateway, and its billing with it. Apply policies when you have a specific shaping requirement — usually compliance, latency-sensitive workloads, or noisy-neighbor mitigation.

## What's next {#next-steps}

- [Network ports](/docs/api/network-ports) — one of the things QoS policies attach to.
- [Networks](/docs/api/networks) and [Subnets](/docs/api/subnets) — the broader network model.
