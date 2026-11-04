---
title: "Floating-IPs"
description: "Öffentliche IPs pro Region, die Sie von einer VM trennen und an eine andere anhängen können."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Floating-IPs

Eine Floating-IP ist eine öffentliche IP-Adresse, die **zu Ihrem Projekt gehört, nicht zu einer bestimmten VM**. Sie reservieren eine in einem externen Netzwerk, weisen sie einem Port einer VM zu, und sie wird zur öffentlichen IP dieser VM. Trennen Sie sie später und hängen Sie sie an eine andere VM an — Ihr Traffic geht dann an die neue VM, ohne dass sich die Adresse ändert.

## Warum es Floating-IPs gibt {#why}

Die Standard-IP einer VM ist **flüchtig** — wenn Sie die VM löschen, geht die IP zurück in den Pool, und eine neu erstellte VM bekommt eine neue. Für zustandslose Worker hinter einem Load Balancer ist das in Ordnung. Völlig ungeeignet ist es für:

- Alles, was über einen DNS-A/AAAA-Eintrag adressiert wird (der Eintrag funktioniert nach jeder Neuerstellung der VM nicht mehr)
- Alles, was auf der IP-Allow-List eines Partners steht (der Partner muss die neue IP erneut auf die Allow-List setzen)
- Blue-Green-Deployments, bei denen Sie Traffic ohne DNS-Propagation zwischen zwei betriebsbereiten VMs umschalten wollen

Eine Floating-IP löst alle drei Probleme. Die IP überdauert jede einzelne VM; Sie hängen sie mit einem einzigen API-Aufruf von einer VM an eine andere um.

## Regionsbindung {#region}

Floating-IPs sind **regionsgebunden**. Eine IP stammt aus dem externen Netzwerk einer Region und lässt sich nur an Ports in dieser Region anhängen.

## Abrechnung {#billing}

Eine Floating-IP wird zu ihrem eigenen Preis abgerechnet, vom Moment ihrer Erstellung bis zu ihrer Löschung, ob angehängt oder nicht. Wenn Sie sie an eine VM anhängen, geht sie nicht im Preis der VM auf. Den aktuellen Preis finden Sie unter [Preisdaten](/docs/api/pricing-data).

Das übliche Muster: die IP erstellen, wenn Sie sie brauchen, sofort anhängen und löschen, wenn Sie fertig sind.

## IPv4 vs. IPv6 {#ipv4-ipv6}

Ein Feld für die Version gibt es nicht: Eine Adresse stammt aus dem externen Netzwerk, das Sie in `floating_network_id` angeben, und `POST /api/v1/floating_ip/reserve` nimmt auch eine bestimmte `ip_address` entgegen. `GET /api/v1/floating_ip/artifacts` listet die externen Netzwerke mit der `ip_version` jedes Subnetzes auf.

Jede Floating-IP wird an eine feste IP auf einem Port gebunden (`vm_port_id` und `vm_ip_address`), sodass eine VM mit mehreren festen IPs auf jeder davon eine Floating-IP tragen kann.

## Verhalten beim Anhängen / Trennen {#attach}

- **Anhängen** ist `POST /api/v1/floating_ip/allocate`, mit dem externen Netzwerk (`floating_network_id`), dem Port (`vm_port_id`) und seiner festen IP (`vm_ip_address`). Übergeben Sie `floating_ip_id`, um eine Adresse anzuhängen, die Sie bereits haben; ohne diesen Wert erstellt allocate eine neue. `GET /api/v1/floating_ip/artifacts?resource_id=<id>` listet die Ports einer VM oder eines Load Balancers auf.
- **Trennen** ist `POST /api/v1/floating_ip/deallocate`. Es gibt die IP nicht frei; es löst nur die Bindung an die VM. Die IP wird weiter abgerechnet, bis Sie sie löschen, mit `DELETE /api/v1/floating_ip/` (ihre ID in `ids`) oder mit `deallocate` und `delete: true`.
- Dieselbe IP an eine andere VM anhängen: Genau das ist der Failover-Weg. Trennen, an das neue Ziel anhängen, DNS ändert sich nicht.

## Nächste Schritte {#next-steps}

- [Virtuelle Maschinen](/docs/api/vms) — die Ressource, an die Floating-IPs angehängt werden.
- [Regionen](/docs/api/regions) — Floating-IPs sind regionsgebunden.
