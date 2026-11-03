---
title: "QoS-Richtlinien"
description: "Bandbreitenlimits, DSCP-Markierung und Mindestbandbreiten-Regeln für Ports, Netzwerke, Router-Gateways und Load-Balancer-VIPs."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: qos-policies
---

# QoS-Richtlinien

Eine QoS-Richtlinie bündelt eine Reihe von Regeln zur Netzwerkqualität — Bandbreitenobergrenzen, DSCP-Markierung von Paketen und Regeln für Mindestbandbreite — und wendet sie auf [Netzwerkports](/docs/api/network-ports), ganze Netzwerke, Router-Gateways oder VIPs von Load Balancern an, über deren `qos_policy_id` (bei einem Load Balancer `vip_qos_policy_id`). Die häufigste Regel ist ein **Bandbreitenlimit** (z. B. den Durchsatz eines Ports auf 100 Mbps begrenzen, damit ein außer Kontrolle geratener Workload gemeinsam genutzte Uplinks nicht auslastet).

DSCP-Markierung versieht Pakete, die einen Port verlassen, mit Prioritätshinweisen — nützlich, wenn nachgelagerte Netzwerke (Ihr Büro, ein Partnernetzwerk) DSCP für Traffic-Shaping berücksichtigen. Eine Regel für Mindestbandbreite fordert mindestens `min_kbps` in einer `direction` an.

Für typische Workloads brauchen Sie keine eigene Richtlinie. NimbusNexus hängt bereits eine Richtlinie mit Bandbreitenlimit an, wenn Sie eine VM im externen Netzwerk erstellen oder einem Router ein externes Gateway geben, bemessen nach der von Ihnen gewählten `bandwidth_mbps`. `POST /api/v1/bandwidth/resize` ändert das Limit an einem Port, einer Floating-IP oder einem Router-Gateway und damit auch die Abrechnung. Wenden Sie Richtlinien an, wenn Sie eine konkrete Anforderung an das Shaping haben — meist Compliance, latenzkritische Workloads oder die Eindämmung von Noisy Neighbors.

## Nächste Schritte {#next-steps}

- [Netzwerkports](/docs/api/network-ports) — eines der Dinge, an die QoS-Richtlinien angehängt werden.
- [Netzwerke](/docs/api/networks) und [Subnetze](/docs/api/subnets) — das umfassendere Netzwerkmodell.
