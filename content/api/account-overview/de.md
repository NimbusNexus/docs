---
title: "Kontoübersicht"
description: "Übergeordnete Kontometadaten — Inhaber, Abrechnungskontakt, Regionszugriff, Tarif."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: account-overview
---

# Kontoübersicht

Ein „Konto“ steht über jedem Workspace, jedem Projekt und jeder Ressource, die Ihnen bei NimbusNexus gehört. Es enthält den Abrechnungskontakt, den Namen der juristischen Person auf Rechnungen, den Tarif (free / starter / production / enterprise), die Regionen, für die Sie auf der Allow-List stehen, und kontoweite Einstellungen. Pro Registrierung gibt es genau ein Konto.

Die meisten dieser Endpoints erlauben Nicht-Inhabern nur Lesezugriff und Inhabern Lese- und Schreibzugriff. Die tägliche Arbeit findet auf Projektebene statt; Aufrufe auf Kontoebene sind typischerweise Operationen, die etwa einmal im Quartal anfallen (den Abrechnungskontakt ändern, eine neue Region beantragen, den Tarif upgraden).

## Nächste Schritte {#next-steps}

- [Workspaces](/docs/api/workspaces) — die nächste Ebene darunter innerhalb des Kontos.
- [Regionsanfragen](/docs/api/region-requests) — Zugriff auf eine Region beantragen, die Sie noch nicht haben.
