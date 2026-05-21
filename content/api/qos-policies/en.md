---
title: QoS policies
description: Bandwidth limits, DSCP marking, and minimum-bandwidth guarantees applied to network ports.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: qos-policies
---

# QoS policies

A QoS policy bundles a set of network-quality rules — bandwidth caps, DSCP packet marking, and minimum-bandwidth reservations — and applies them to one or more [network ports](/docs/api/network-ports). The most common rule is a **bandwidth limit** (cap throughput on a port at 100 Mbps, say, to prevent a runaway workload from saturating shared uplinks).

DSCP marking adds priority hints to packets leaving a port — useful when downstream networks (your office, a partner network) honor DSCP for traffic shaping. Minimum-bandwidth reservations guarantee a port gets at least N Mbps even under contention — useful for telephony and real-time workloads.

For typical workloads, the default (no QoS policy) is fine. Apply policies when you have a specific shaping requirement — usually compliance, latency-sensitive workloads, or noisy-neighbor mitigation.

## What's next {#next-steps}

- [Network ports](/docs/api/network-ports) — what QoS policies attach to.
- [Networks](/docs/api/networks) and [Subnets](/docs/api/subnets) — the broader network model.
