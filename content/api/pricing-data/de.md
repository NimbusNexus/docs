---
title: "Preisdaten"
description: "Programmatischer Zugriff auf die maßgebliche Preisliste. Nur lesend."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: pricing-data
---

# Preisdaten

Die Endpoints für Preisdaten sind ein schreibgeschützter Feed dessen, was NimbusNexus berechnet, ein Endpoint pro Ressourcenart:

- `GET /api/v1/pricing/vm` — VM-Größen. `architecture` und `vm_class` sind Pflicht; `cpu` und `ram` grenzen die Liste ein.
- `GET /api/v1/pricing/storage` — Blockspeicher, für einen `volume_type`.
- `GET /api/v1/pricing/port`, `/api/v1/pricing/floating_ip` und `/api/v1/pricing/image` — Netzwerkports, Floating-IPs und Image-Speicher.
- `GET /api/v1/pricing/bandwidth` — ausgehende Bandbreite.

Jeder Preis kommt mit seinem Abrechnungszeitraum: einmalig, stündlich, täglich, monatlich oder jährlich. Zum Lesen müssen Sie sich nicht anmelden. Gilt der Aufruf für eines Ihrer Projekte, sieht der Aufrufer die Preise, die für Ihren Workspace gelten; alle anderen sehen die Listenpreise.

Anwendungsfälle: Kostenschätzungen in Echtzeit in Ihren Bereitstellungs-Workflow integrieren (zeigen Sie „diese VM kostet $X/Monat“, bevor der Nutzer auf Launch klickt), interne Tools zur Kostenzuordnung bauen oder einfach Ihre eigene Tabelle „was berechnet NimbusNexus gerade für X“ pflegen.

Die Preise sind in USD angegeben.

## Nächste Schritte {#next-steps}

- [Abrechnung](/docs/api/invoices) — Ihre Salden und die noch nicht beglichenen Kosten.
- [Monatsrechnung optimieren](/docs/guides/cost-optimization) — die Anleitung mit Strategien, um Ihre Rechnung zu senken.
- Die [Preisseite auf der Marketing-Website]({{BASE_URL}}/pricing) — die für Menschen lesbare Version dieser Daten.
