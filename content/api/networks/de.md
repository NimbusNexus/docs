---
title: "Netzwerke"
description: "L2-Broadcast-Domains, an die VMs und Load Balancer angebunden werden. Der Grundbaustein der VPC eines Projekts."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Netzwerke

Ein Netzwerk ist eine virtuelle L2-Broadcast-Domain innerhalb einer Region. VMs und Load Balancer werden über Ports an ein **Netzwerk** angebunden, und die Adresse jedes Ports stammt aus einem der **Subnetze** des Netzwerks.

## Zwei Varianten {#flavors}

| Variante | Erstellt von | Ins Internet routbar | Verwendet für |
| --- | --- | --- | --- |
| **Extern** | Automatisch pro Region bereitgestellt; gemeinsam genutzt | Ja — direkt oder über Floating-IPs | Der Standard-Uplink für die meisten Workloads |
| **Tenant** | Ihnen, innerhalb des Projekts | Nicht direkt — braucht einen Router | Private VPC, mehrschichtige Apps, rein interne Dienste |

Das externe Netzwerk jeder Region wird von allen Projekten in dieser Region gemeinsam genutzt. Seine ID ist eine UUID wie jede andere; `GET /api/v1/network/` listet es mit `router:external: true` auf. Tenant-Netzwerke sind nur innerhalb Ihres Projekts sichtbar, es sei denn, Sie [geben sie frei](/docs/api/network-sharing).

## Warum Sie ein Tenant-Netzwerk erstellen {#why-tenant}

- **Mehrschichtige Architektur.** Frontend-VMs in einem öffentlich erreichbaren Subnetz; Backend-/DB-VMs in einem privaten Subnetz. Beide Seiten kommunizieren über das Tenant-Netzwerk, ohne je das öffentliche Internet zu berühren.
- **Mehrere isolierte Umgebungen in einer Region.** prod / staging / dev in drei getrennten Tenant-Netzwerken; kein versehentliches Übersprechen.
- **Compliance.** Manche Workloads erfordern private Adressierung für alles außer einem dokumentierten Egress-Pfad. Mit einem Tenant-Netzwerk + Router bauen Sie diesen Pfad explizit auf.

Bei einfachen Setups mit einer einzelnen VM binden Sie einfach an das externe Netzwerk an und verzichten ganz auf Tenant-Netzwerke. Der Port der VM hat dann eine öffentliche Adresse. Eine VM im externen Netzwerk zu erstellen, erfordert `bandwidth_mbps` und `subscription.bandwidth`, und der Port und seine Bandbreite werden abgerechnet (siehe [Preisdaten](/docs/api/pricing-data)).

## MTU und IPv6 {#mtu-ipv6}

Setzen Sie die `mtu` eines Netzwerks beim Erstellen oder Aktualisieren. Der Standardwert und der größte zulässige Wert sind Plattformeinstellungen.

Ein Netzwerk hat keine eigene IP-Version; seine Subnetze haben eine. Jedes Subnetz erhält eine `ip_version` von 4 oder 6, und ein Netzwerk kann beide enthalten.

## Nächste Schritte {#next-steps}

- [Subnetze](/docs/api/subnets) — IP-Adressblöcke, die aus einem Netzwerk abgeteilt werden.
- [Router](/docs/api/routers) — verbinden Tenant-Netzwerke mit dem externen Gateway.
- [Sicherheitsgruppen](/docs/api/security-groups) — Firewall-Regeln für Schnittstellen innerhalb eines Netzwerks.
- [Load Balancer](/docs/api/load-balancers) — verteilen Traffic auf VMs in einem Netzwerk.
