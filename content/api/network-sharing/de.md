---
title: "Netzwerkfreigabe"
description: "Ein Netzwerk, eine QoS-Richtlinie, eine Sicherheitsgruppe, einen Subnetz-Pool, einen Adressbereich oder eine Adressgruppe für ein anderes Projekt freigeben, in dem Sie eine Rolle haben."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: network-sharing
---

# Netzwerkfreigabe

Netzwerke sind normalerweise pro Projekt isoliert — ein Netzwerk im Projekt `acme-prod` ist für `acme-staging` unsichtbar. Die Netzwerkfreigabe öffnet eine kontrollierte Lücke in dieser Isolation: Sie geben ein Objekt, das Ihrem Projekt gehört, für ein anderes Projekt frei, in dem Sie eine Rolle haben, und das empfangende Projekt kann es nutzen, als wäre es sein eigenes — etwa VMs an ein freigegebenes Netzwerk anbinden.

`POST /api/v1/rbac_policy/` nimmt die Freigabe vor. Der Aufruf nimmt den `object_type` (`network`, `qos_policy`, `security_group`, `subnetpool`, `address_scope` oder `address_group`), die `object_id` des Objekts, eine `action` wie `access_as_shared` und das empfangende Projekt in `target_tenant` entgegen.

Anwendungsfälle: ein gemeinsames Netzwerk für Dienste (Datenbanken, Caches, interne APIs), das mehrere Anwendungsprojekte erreichen müssen. Die Alternative wäre, die Dienste über öffentliche IPs bereitzustellen und sie auf L7 erneut abzusichern — möglich, aber aufwendiger, als das L2-Segment innerhalb der Vertrauensgrenze eines Workspaces freizugeben.

## Nächste Schritte {#next-steps}

- [Netzwerke](/docs/api/networks) — die Ressource, die freigegeben wird.
- [Projekte](/docs/api/projects) — die Besitzer und Empfänger freigegebener Objekte.
- [Sicherheitsgruppen](/docs/api/security-groups) — was den Traffic in einem freigegebenen Netzwerk filtert.
