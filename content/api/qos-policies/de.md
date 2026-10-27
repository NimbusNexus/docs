---
title: "QoS-Richtlinien"
description: "Bandbreitenlimits, DSCP-Markierung und garantierte Mindestbandbreite, angewendet auf Netzwerkports."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: qos-policies
---

# QoS-Richtlinien

Eine QoS-Richtlinie bündelt eine Reihe von Regeln zur Netzwerkqualität — Bandbreitenobergrenzen, DSCP-Markierung von Paketen und Reservierungen von Mindestbandbreite — und wendet sie auf einen oder mehrere [Netzwerkports](/docs/api/network-ports) an. Die häufigste Regel ist ein **Bandbreitenlimit** (z. B. den Durchsatz eines Ports auf 100 Mbps begrenzen, damit ein außer Kontrolle geratener Workload gemeinsam genutzte Uplinks nicht auslastet).

DSCP-Markierung versieht Pakete, die einen Port verlassen, mit Prioritätshinweisen — nützlich, wenn nachgelagerte Netzwerke (Ihr Büro, ein Partnernetzwerk) DSCP für Traffic-Shaping berücksichtigen. Reservierungen von Mindestbandbreite garantieren einem Port mindestens N Mbps, auch wenn mehrere um die Bandbreite konkurrieren — nützlich für Telefonie und Echtzeit-Workloads.

Für typische Workloads reicht der Standard (keine QoS-Richtlinie). Wenden Sie Richtlinien an, wenn Sie eine konkrete Anforderung an das Shaping haben — meist Compliance, latenzkritische Workloads oder die Eindämmung von Noisy Neighbors.

## Nächste Schritte {#next-steps}

- [Netzwerkports](/docs/api/network-ports) — woran QoS-Richtlinien angehängt werden.
- [Netzwerke](/docs/api/networks) und [Subnetze](/docs/api/subnets) — das umfassendere Netzwerkmodell.
