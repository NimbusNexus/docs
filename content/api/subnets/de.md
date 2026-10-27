---
title: "Subnetze"
description: "IP-Adressblöcke, die aus einem Netzwerk abgeteilt werden. Jedes Subnetz hat einen eigenen CIDR-Block, ein eigenes Gateway und eine eigene DHCP-Richtlinie."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Subnetze

Ein Subnetz ist ein IP-Adressblock innerhalb eines [Netzwerks](/docs/api/networks). VMs und Load Balancer werden an Subnetze angebunden, nicht direkt an Netzwerke — ein Netzwerk ist nur ein Container, in dem ein oder mehrere Subnetze liegen.

## CIDR-Größen {#cidr}

Sie wählen den CIDR beim Erstellen. Typische Größen:

| Anwendungsfall | CIDR | Nutzbare Adressen |
| --- | --- | --- |
| Tests mit einer einzelnen VM | `/29` | 5 |
| Kleine App (≤ 20 VMs) | `/27` | 27 |
| Mittlere App (≤ 100 VMs) | `/25` | 123 |
| Große App | `/24` | 251 |
| Projektweite VPC | `/16` | 65.531 |

Jedes Subnetz reserviert: die Netzwerkadresse (erste), die Broadcast-Adresse (letzte), das Gateway (typischerweise `.1`) und unseren DHCP-Server (typischerweise `.2`). Ein Subnetz mit `/24` hat also 256 Rohadressen, aber nur 251 für VMs nutzbare.

Sie können ein Subnetz im laufenden Betrieb ohne Unterbrechung **vergrößern** (`/27` → `/25`). Verkleinern können Sie ein Subnetz **nicht**, ohne es neu zu erstellen; bestehende VM-IPs müssten neu nummeriert werden.

## DHCP, SLAAC und Verhalten des Gateways {#dhcp}

- **IPv4-Subnetze** verwenden standardmäßig DHCP. Jede VM erhält eine feste Adresse aus dem verfügbaren Bereich des Subnetzes. Wenn Sie eine stabile Adresse brauchen (z. B. für ein LB-Backend im DNS), können Sie bestimmte IPs über den Ports-Endpoint vorab zuteilen.
- **IPv6-Subnetze** verwenden standardmäßig SLAAC. Jede VM erzeugt automatisch eine Adresse aus dem Präfix `/64` des Subnetzes + ihrer MAC-Adresse. DHCPv6 lässt sich für Umgebungen aktivieren, die deterministische Adressierung erfordern.
- Das **Gateway** wird pro Subnetz festgelegt. Bei Tenant-Subnetzen, die Internetzugang brauchen, zeigt das Gateway auf den [Router](/docs/api/routers), der an das Subnetz angebunden ist; beim automatisch erstellten Subnetz des externen Netzwerks zeigt das Gateway auf unseren Edge.

## Mehrere Subnetze pro Netzwerk {#multiple}

Sie können mehrere Subnetze an ein Netzwerk anbinden. Eine VM, die mit diesem Netzwerk verbunden ist, kann aus jedem Subnetz darin erreichbar sein (vorbehaltlich der Sicherheitsgruppen). Das ist nützlich für Dual-Stack mit IPv4 + IPv6 — ein v4-Subnetz + ein v6-Subnetz im selben Netzwerk geben jeder VM beide Stacks.

## Nächste Schritte {#next-steps}

- [Netzwerke](/docs/api/networks) — die übergeordnete Ressource von Subnetzen.
- [Router](/docs/api/routers) — woran Sie ein Tenant-Subnetz anbinden, damit es das Internet erreicht.
- [Virtuelle Maschinen](/docs/api/vms) — VMs werden über Ports an Subnetze angebunden.
