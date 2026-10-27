---
title: "Netzwerkfreigabe"
description: "Ein Netzwerk, ein Subnetz oder einen Port für andere Projekte im selben Workspace freigeben."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: network-sharing
---

# Netzwerkfreigabe

Netzwerke sind normalerweise pro Projekt isoliert — ein Netzwerk im Projekt `acme-prod` ist für `acme-staging` unsichtbar. Die Netzwerkfreigabe öffnet eine kontrollierte Lücke in dieser Isolation: Das besitzende Projekt gibt ein bestimmtes Netzwerk für ein bestimmtes anderes Projekt (im selben Workspace) frei, und das empfangende Projekt kann VMs an das freigegebene Netzwerk anbinden, als wäre es sein eigenes.

Anwendungsfälle: ein gemeinsames Netzwerk für Dienste (Datenbanken, Caches, interne APIs), das mehrere Anwendungsprojekte erreichen müssen. Die Alternative wäre, die Dienste über öffentliche IPs bereitzustellen und sie auf L7 erneut abzusichern — möglich, aber aufwendiger, als das L2-Segment innerhalb der Vertrauensgrenze eines Workspaces freizugeben.

Eine Freigabe über Workspaces hinweg ist nicht möglich — das ist eine bewusste Isolationsgrenze.

## Nächste Schritte {#next-steps}

- [Netzwerke](/docs/api/networks) — die Ressource, die freigegeben wird.
- [Workspaces](/docs/api/workspaces) — die Grenze der Freigabe.
- [Sicherheitsgruppen](/docs/api/security-groups) — was den Traffic in einem freigegebenen Netzwerk filtert.
