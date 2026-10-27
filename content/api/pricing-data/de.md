---
title: "Preisdaten"
description: "Programmatischer Zugriff auf die maßgebliche Preisliste. Nur lesend."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: pricing-data
---

# Preisdaten

Der Endpoint für Preisdaten ist ein schreibgeschützter Feed der maßgeblichen Preisliste von NimbusNexus — VM-Größen nach Familie, Klassen des Blockspeichers, Tiers des Objektspeichers, Egress-Preise, Engine-Multiplikatoren für verwaltete Datenbanken, alles. Dieselben Daten speisen die Preisseiten auf der Marketing-Website und die Kostenprognosen im Dashboard.

Anwendungsfälle: Kostenschätzungen in Echtzeit in Ihren Bereitstellungs-Workflow integrieren (zeigen Sie „diese VM kostet $X/Monat“, bevor der Nutzer auf Launch klickt), interne Tools zur Kostenzuordnung bauen oder einfach Ihre eigene Tabelle „was berechnet NimbusNexus gerade für X“ pflegen.

Die Preise sind in USD angegeben und ändern sich, wenn wir die veröffentlichte Preisliste anpassen (selten — typischerweise ein- bis zweimal pro Jahr, und vor jeder Erhöhung informieren wir 30 Tage im Voraus per E-Mail).

## Nächste Schritte {#next-steps}

- [Rechnungen](/docs/api/invoices) — was die Preise in der Praxis ergeben.
- [Monatsrechnung optimieren](/docs/guides/cost-optimization) — die Anleitung mit Strategien, um Ihre Rechnung zu senken.
- Die [Preisseite auf der Marketing-Website]({{BASE_URL}}/pricing) — die für Menschen lesbare Version dieser Daten.
