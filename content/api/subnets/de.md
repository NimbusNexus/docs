---
title: "Subnetze"
description: "IP-Adressblöcke, die aus einem Netzwerk abgeteilt werden. Jedes Subnetz hat einen eigenen CIDR-Block, ein eigenes Gateway und eine eigene DHCP-Richtlinie."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Subnetze

Ein Subnetz ist ein IP-Adressblock innerhalb eines [Netzwerks](/docs/api/networks). Eine VM wird über einen Port an das Netzwerk angebunden, und der Port bezieht seine Adresse aus einem der Subnetze des Netzwerks.

## CIDR-Größen {#cidr}

Sie wählen den CIDR beim Erstellen. Typische Größen:

| Anwendungsfall | CIDR |
| --- | --- |
| Tests mit einer einzelnen VM | `/29` |
| Kleine App (≤ 20 VMs) | `/27` |
| Mittlere App (≤ 100 VMs) | `/25` |
| Große App | `/24` |
| Projektweite VPC | `/16` |

Nicht jede Adresse des Blocks geht an VMs: Ports beziehen ihre Adressen aus den `allocation_pools` des Subnetzes.

Der CIDR eines Subnetzes steht fest, sobald es erstellt ist. `PUT /api/v1/subnet/{subnet_id}` ändert `name`, `dns_nameservers`, `allocation_pools`, `gateway_ip` und `enable_dhcp`, nicht aber seine Größe; für mehr Adressen fügen Sie dem Netzwerk ein weiteres Subnetz hinzu. Verkleinern können Sie ein Subnetz **nicht**, ohne es neu zu erstellen; bestehende VM-IPs müssten neu nummeriert werden.

## DHCP, SLAAC und Verhalten des Gateways {#dhcp}

- **IPv4-Subnetze** verwenden standardmäßig DHCP. Jede VM erhält eine feste Adresse aus dem verfügbaren Bereich des Subnetzes. Wenn Sie eine stabile Adresse brauchen (z. B. für ein LB-Backend im DNS), können Sie bestimmte IPs über den Ports-Endpoint vorab zuteilen.
- **IPv6-Subnetze** nehmen dieselben Felder wie IPv4-Subnetze, mit `ip_version: 6`. Ein Feld, um zwischen SLAAC und DHCPv6 zu wählen, gibt es nicht.
- Das **Gateway** wird pro Subnetz festgelegt. Bei Tenant-Subnetzen, die Internetzugang brauchen, zeigt das Gateway auf den [Router](/docs/api/routers), der an das Subnetz angebunden ist.

## Mehrere Subnetze pro Netzwerk {#multiple}

Sie können mehrere Subnetze an ein Netzwerk anbinden. So richten Sie Dual-Stack mit IPv4 + IPv6 ein: ein v4-Subnetz und ein v6-Subnetz im selben Netzwerk.

## Nächste Schritte {#next-steps}

- [Netzwerke](/docs/api/networks) — die übergeordnete Ressource von Subnetzen.
- [Router](/docs/api/routers) — woran Sie ein Tenant-Subnetz anbinden, damit es das Internet erreicht.
- [Virtuelle Maschinen](/docs/api/vms) — VMs werden über Ports an Netzwerke angebunden.
