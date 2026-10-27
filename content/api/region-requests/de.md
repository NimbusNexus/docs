---
title: "Regionsanfragen"
description: "Zugriff auf eine Region beantragen, die Sie derzeit nicht haben, oder eine Kontingenterhöhung in einer Region, die Sie bereits nutzen."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: region-requests
---

# Regionsanfragen

Neue Konten erhalten standardmäßig Zugriff auf eine Region (die bei der Registrierung gewählte). Für Zugriff auf weitere Regionen ist eine Regionsanfrage nötig — ein kurzes Formular, in dem Sie den Workload beschreiben, der die neue Region braucht. Die meisten Produktionskonten werden innerhalb eines Werktags freigegeben; die Prüfung dient der Kapazitätsplanung und dazu, ungewöhnliche Muster zu erkennen (ein brandneues Konto, das am ersten Tag Kapazität in fünf Regionen anfragt, ist ein kurzes Gespräch wert).

Dieser Endpoint verarbeitet auch Kontingenterhöhungen — eine Anfrage, die Anzahl der VMs, die vCPU oder das Speicherlimit in einer Region zu erhöhen, auf die Sie bereits Zugriff haben. Der Grund für die Prüfung ist derselbe: Große Anfragen brauchen Kapazitätsplanung. Zum Kontingentmodell selbst siehe [Kontingente](/docs/api/quotas).

Die API gibt es hier, damit automatisierte Deployments die Anfrage nach dem Prinzip Fire-and-Forget absenden können; die Freigabe erfolgt weiterhin manuell bei uns (das ist bewusst einer der wenigen Bereiche der API, die nicht vollständig Self-Service sind).

## Nächste Schritte {#next-steps}

- [Regionen](/docs/api/regions) — die Liste der verfügbaren Regionen.
- [Kontingente](/docs/api/quotas) — die Limits pro Projekt, die eine Regionsanfrage ebenfalls anpassen kann.
- [Kontoübersicht](/docs/api/account-overview) — der Kontokontext für den Regionszugriff.
