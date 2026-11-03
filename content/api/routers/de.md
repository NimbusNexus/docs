---
title: "Router"
description: "Tenant-Subnetze mit dem externen Gateway des Projekts verbinden."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Router

Ein Router verschafft einem **Tenant-Netzwerk** (und seinen Subnetzen) Internetzugang. VMs, die an ein Tenant-Subnetz angebunden sind, erreichen das öffentliche Internet nicht von allein — sie liegen in einem privaten L2-Segment. Ein Router verbindet dieses Segment mit dem externen Netzwerk der Region, übernimmt NAT für ausgehenden Traffic und stellt (optional) Floating-IPs für eingehenden Traffic bereit.

## Wann Sie einen Router brauchen {#when-needed}

- **Öffentlich erreichbare VMs in einem Tenant-Netzwerk.** Binden Sie einen Router an, teilen Sie dann eine [Floating-IP](/docs/api/floating-ips) zu und hängen Sie sie an. Ausgehender Traffic läuft per NAT über den Router; eingehender Traffic an die Floating-IP wird zurück zur VM geroutet.
- **Gemischte private/öffentliche App-Schichten.** Die Web-Schicht liegt hinter einem Router mit Floating-IP; App- und DB-Schicht bleiben privat und erreichen das Internet (etwa für Paket-Updates) über das Source-NAT des Routers.
- **Routing zwischen mehreren Subnetzen.** Ein Router kann mehrere Subnetze gleichzeitig bedienen. Traffic zwischen zwei Subnetzen am selben Router bleibt innerhalb der VPC und verlässt NimbusNexus nie.

Wenn Sie VMs direkt an das externe Netzwerk anbinden, brauchen Sie keinen Router — das externe Netzwerk IST das Gateway.

## SNAT, DNAT und Floating-IPs {#nat}

Ein Router hat eine externe Gateway-Verbindung (zum externen Netzwerk der Region) und null oder mehr interne Verbindungen (zu Tenant-Subnetzen). Wenn Sie das Gateway in `external_gateway_info` setzen, braucht es außerdem `bandwidth_subscription` und `bandwidth_mbps` (ein Vielfaches von 10): Das Gateway wird auf diese Bandbreite begrenzt, und die Bandbreite wird abgerechnet (siehe [Preisdaten](/docs/api/pricing-data)).

- **Ausgehend von einer privaten VM** → der Router führt Source-NAT auf seine externe IP durch. Mehrere private VMs teilen sich diese eine externe IP für ausgehenden Traffic.
- **Eingehend an eine Floating-IP** → der Router führt Destination-NAT auf die private VM durch, an die die Floating-IP angehängt ist. Die private VM sieht die ursprüngliche Quell-IP (bei eingehendem Traffic erhalten wir die Client-IP über das NAT hinweg; nur ausgehender Traffic wird per SNAT umgesetzt).

Source-NAT richtet sich nach `external_gateway_info.enable_snat`, einer Plattformeinstellung. Destination-NAT konfigurieren Sie nicht direkt; der Router regelt es anhand der Floating-IPs, die Sie angehängt haben.

## Statische Routen {#static-routes}

Ein Router hat eine Tabelle statischer Routen, die Sie für Ziele abseits der Standardroute füllen können. Jede Route leitet Traffic für den CIDR in `destination`, aus jedem Subnetz am Router, an die Adresse in `nexthop` — eine andere VM wie eine VPN-Appliance oder einen transparenten Proxy. `PUT /api/v1/router/{router_id}/extraroutes` fügt Routen atomar hinzu, und `DELETE` auf demselben Pfad entfernt sie atomar. Die meisten Nutzer brauchen das nie; es ist für fortgeschrittene VPC-Layouts gedacht, die es benötigen.

## Nächste Schritte {#next-steps}

- [Netzwerke](/docs/api/networks) und [Subnetze](/docs/api/subnets) — was Router verbinden.
- [Floating-IPs](/docs/api/floating-ips) — öffentliche Adressen für eingehenden Traffic, die über einen Router laufen.
- [Sicherheitsgruppen](/docs/api/security-groups) — die Firewall-Schicht an der VM-Schnittstelle (der Router selbst filtert nicht).
