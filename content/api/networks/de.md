---
title: "Netzwerke"
description: "L2-Broadcast-Domains, an die VMs und Load Balancer angebunden werden. Der Grundbaustein der VPC eines Projekts."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Netzwerke

Ein Netzwerk ist eine virtuelle L2-Broadcast-Domain innerhalb einer Region. VMs und Load Balancer werden nicht direkt an das Internet angebunden — sie werden an ein **Subnetz** angebunden, das in einem **Netzwerk** liegt, und genau das beschreibt diese Ressource.

## Zwei Varianten {#flavors}

| Variante | Erstellt von | Ins Internet routbar | Verwendet für |
| --- | --- | --- | --- |
| **Extern** | Automatisch pro Region bereitgestellt; gemeinsam genutzt | Ja (über Floating-IPs) | Der Standard-Uplink für die meisten Workloads |
| **Tenant** | Ihnen, innerhalb des Projekts | Nicht direkt — braucht einen Router | Private VPC, mehrschichtige Apps, rein interne Dienste |

Das externe Netzwerk jeder Region (ID-Muster: `net_external_us_east_1`) wird von allen Projekten in dieser Region gemeinsam genutzt, ist aber auf Ebene der Sicherheitsgruppen / VLANs isoliert. Tenant-Netzwerke sind vollständig privat und nur innerhalb Ihres Projekts sichtbar.

## Warum Sie ein Tenant-Netzwerk erstellen {#why-tenant}

- **Mehrschichtige Architektur.** Frontend-VMs in einem öffentlich erreichbaren Subnetz; Backend-/DB-VMs in einem privaten Subnetz. Beide Seiten kommunizieren über das Tenant-Netzwerk, ohne je das öffentliche Internet zu berühren.
- **Mehrere isolierte Umgebungen in einer Region.** prod / staging / dev in drei getrennten Tenant-Netzwerken; kein versehentliches Übersprechen.
- **Compliance.** Manche Workloads erfordern private Adressierung für alles außer einem dokumentierten Egress-Pfad. Mit einem Tenant-Netzwerk + Router bauen Sie diesen Pfad explizit auf.

Bei einfachen Setups mit einer einzelnen VM binden Sie einfach an das externe Netzwerk an und verzichten ganz auf Tenant-Netzwerke.

## MTU und IPv6 {#mtu-ipv6}

Netzwerke verwenden standardmäßig MTU 1500 (Ethernet-Standard). Für VM-zu-VM-Workloads mit hohem Durchsatz im selben Netzwerk können Sie beim Erstellen ein Netzwerk mit Jumbo-Frames (MTU 9000) anfordern — beachten Sie, dass manche externen CDNs / Partner Jumbo-Frames nicht sauber aushandeln.

IPv6 aktivieren Sie, indem Sie die IP-Version des Netzwerks auf `dual` oder `ipv6` setzen (Standard: `ipv4`). Die Subnetze, die aus einem Netzwerk mit IPv6 abgeteilt werden, können entweder v4 oder v6 sein (gemischt innerhalb eines Netzwerks wird unterstützt).

## Nächste Schritte {#next-steps}

- [Subnetze](/docs/api/subnets) — IP-Adressblöcke, die aus einem Netzwerk abgeteilt werden.
- [Router](/docs/api/routers) — verbinden Tenant-Netzwerke mit dem externen Gateway.
- [Sicherheitsgruppen](/docs/api/security-groups) — Firewall-Regeln für Schnittstellen innerhalb eines Netzwerks.
- [Load Balancer](/docs/api/load-balancers) — verteilen Traffic auf VMs in einem Netzwerk.
