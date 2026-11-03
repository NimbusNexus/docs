---
title: "Regionen"
description: "Die Regionen, die NimbusNexus bedient, und wie Ihre Sitzung eine auswählt."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Regionen

Eine Region von NimbusNexus ist ein geografischer Standort mit mindestens einer Availability Zone. Jede Ressource, die Sie erstellen — VMs, Volumes, Buckets —, liegt in genau einer Region.

## Aktuelle Regionen {#current}

Die Produktionsumgebung bedient heute eine Region, in Frankfurt, Deutschland.

`GET /api/v1/account/datacenters` listet die Regionen auf, jede mit ihrem `region_name`, `label` und `order` für die Anzeige und einem Flag `healthy`; `current` ist die Region, in der sich Ihre Sitzung befindet. `GET /api/v1/account/rescope?region=<region_name>` wechselt die Sitzung in eine andere Region. Die Antwort der API ist verbindlich.

## Wie Sie eine Region wählen {#picking}

Drei Dinge zählen:

1. **Latenz zu Ihren Nutzern.** Wählen Sie die Region, die dem Ursprung der meisten Requests am nächsten liegt. Round-Trip-Zeiten unter 50 ms fühlen sich flott an; über 200 ms wirken sie selbst mit gutem Code träge.

2. **Latenz zu Ihren Abhängigkeiten.** Wenn Sie andere Dienste aufrufen (Datenbanken, APIs von Drittanbietern, Ihre eigene Infrastruktur), platzieren Sie die VM in der Region, die ihnen am nächsten liegt. Round-Trips zwischen Compute und Speicher fallen bei jedem Request an; Round-Trips zwischen Nutzer und Compute einmal pro Seitenaufruf.

3. **Anforderungen an die Datenresidenz.** GDPR / DSGVO / Datenschutzgesetze auf Bundesstaatsebene können festlegen, wo Kundendaten gespeichert sein dürfen. Die derzeit einzige Region liegt in Frankfurt, Deutschland.

## Nächste Schritte {#next-steps}

- [Virtuelle Maschinen](/docs/api/vms) — eine VM wird in der aktuellen Region Ihrer Sitzung erstellt.
- [Kontoübersicht](/docs/api/account-overview) — wo die Liste der Regionen und der Wechsel der Sitzung dokumentiert sind.
- [Regionsanfragen](/docs/api/region-requests) — eine Region anfragen, die noch nicht bedient wird.
