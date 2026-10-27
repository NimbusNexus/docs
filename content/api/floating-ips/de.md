---
title: "Floating-IPs"
description: "Öffentliche IPs pro Region, die Sie von einer VM trennen und an eine andere anhängen können."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Floating-IPs

Eine Floating-IP ist eine öffentliche IP-Adresse, die **zu Ihrem Projekt gehört, nicht zu einer bestimmten VM**. Sie teilen eine zu, hängen sie an eine VM an, und sie wird zur öffentlichen IP dieser VM. Trennen Sie sie später und hängen Sie sie an eine andere VM an — Ihr Traffic geht dann an die neue VM, ohne dass sich die Adresse ändert.

## Warum es Floating-IPs gibt {#why}

Die Standard-IP einer VM ist **flüchtig** — wenn Sie die VM löschen, geht die IP zurück in den Pool, und eine neu erstellte VM bekommt eine neue. Für zustandslose Worker hinter einem Load Balancer ist das in Ordnung. Völlig ungeeignet ist es für:

- Alles, was über einen DNS-A/AAAA-Eintrag adressiert wird (der Eintrag funktioniert nach jeder Neuerstellung der VM nicht mehr)
- Alles, was auf der IP-Allow-List eines Partners steht (der Partner muss die neue IP erneut auf die Allow-List setzen)
- Blue-Green-Deployments, bei denen Sie Traffic ohne DNS-Propagation zwischen zwei betriebsbereiten VMs umschalten wollen

Eine Floating-IP löst alle drei Probleme. Die IP überdauert jede einzelne VM; Sie hängen sie mit einem einzigen API-Aufruf in ~2 Sekunden von einer VM an eine andere um.

## Regionsbindung {#region}

Floating-IPs sind **regionsgebunden**. Eine in `us-east-1` zugeteilte IP lässt sich nur an VMs in `us-east-1` anhängen. Für ein Cross-Region-Failover brauchen Sie entweder:

- Eine Floating-IP pro Region + ein Failover auf DNS-Ebene (latenzbasiert, mit Health-Checks)
- Ein Anycast-IP-Produkt, das wir derzeit nicht anbieten

Diese Einschränkung wollen wir nicht aufheben — regionsübergreifende Floating-IPs würden erfordern, öffentliche BGP-Announcements global zu routen, und das ist ein völlig anderes Produkt als die Zuteilung pro Region.

## Abrechnung {#billing}

- **Angehängt** an eine laufende VM: **\$0** — die IP ist im Preis der VM enthalten.
- **Angehängt** an eine gestoppte VM: \$2,50/Monat — wie die Position für die reservierte IP der VM.
- **Nicht angehängt**: \$2,50/Monat — derselbe Preis. Wir berechnen nicht angehängte IPs, damit niemand IPs hortet; das würde den Pool der Region schneller leeren, als wir ihn vergrößern können.

Das übliche Muster: die IP zuteilen, wenn Sie sie brauchen, sofort anhängen, freigeben, wenn Sie fertig sind.

## IPv4 vs. IPv6 {#ipv4-ipv6}

Floating-IPs gibt es in beiden Varianten. `version: 'ipv4'` ist der Standard (und das, was die meisten brauchen). `version: 'ipv6'` wird aus unserem `/48` pro Region zugeteilt; beide sind öffentlich und routbar.

An eine VM können gleichzeitig eine IPv4-Floating-IP und eine IPv6-Floating-IP angehängt sein. Mehrere IPv4-Adressen pro VM werden nicht unterstützt; wenn Sie mehrere Adressen auf einer VM brauchen, verwenden Sie private VPC-Adressen mit NAT.

## Verhalten beim Anhängen / Trennen {#attach}

- **Anhängen** ist atomar: Die VM erhält die Adresse innerhalb von ~2 Sekunden. Bestehende TCP-Verbindungen zur bisherigen öffentlichen IP der VM (falls vorhanden) werden abgebrochen — es ändert sich lediglich die Routingtabelle des Kernels.
- **Trennen** gibt die IP nicht frei; es löst nur die Bindung an die VM. Die IP wird weiter abgerechnet, bis Sie DELETE aufrufen.
- Dieselbe IP an eine andere VM anhängen: Genau das ist der Failover-Weg. Trennen, an das neue Ziel anhängen, DNS ändert sich nicht.

## Nächste Schritte {#next-steps}

- [Virtuelle Maschinen](/docs/api/vms) — die Ressource, an die Floating-IPs angehängt werden.
- [Regionen](/docs/api/regions) — Floating-IPs sind regionsgebunden.
- Die Anleitung **Multi-Region-Failover** (folgt in Kürze) beschreibt das Muster auf DNS-Ebene für ein Cross-Region-Failover, wenn Floating-IPs allein nicht reichen.
