---
title: "Regionen"
description: "Geografische Standorte, die NimbusNexus bedient, mit Status Live oder Pre-Launch."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Regionen

Eine Region von NimbusNexus ist ein geografischer Standort mit mindestens einer Availability Zone. Jede Ressource, die Sie erstellen — VMs, verwaltete Datenbanken, Volumes, Buckets —, liegt in genau einer Region. Cross-Region-Operationen (Replikation, Failover, Traffic zwischen Ressourcen) funktionieren, sind aber explizit und werden abgerechnet.

## Aktuelle Regionen {#current}

| Code | Standort | Status |
| --- | --- | --- |
| `us-east-1` | Virginia, US | Live |
| `us-west-1` | Los Angeles, US | Live |
| `eu-central-1` | Frankfurt, DE | Live |
| `ap-southeast-1` | Singapur | Pre-Launch (~2 Monate) |

Die maßgebliche Liste liefert auch `GET /v1/regions`; die Tabelle oben ist nur ein Beispiel. Zu dem Zeitpunkt, an dem Sie diese Seite lesen, ist die Antwort der API verbindlich.

## Wie Sie eine Region wählen {#picking}

Drei Dinge zählen:

1. **Latenz zu Ihren Nutzern.** Wählen Sie die Region, die dem Ursprung der meisten Requests am nächsten liegt. Round-Trip-Zeiten unter 50 ms fühlen sich flott an; über 200 ms wirken sie selbst mit gutem Code träge.

2. **Latenz zu Ihren Abhängigkeiten.** Wenn Sie andere Dienste aufrufen (Datenbanken, APIs von Drittanbietern, Ihre eigene Infrastruktur), platzieren Sie die VM in der Region, die ihnen am nächsten liegt. Round-Trips zwischen Compute und Speicher fallen bei jedem Request an; Round-Trips zwischen Nutzer und Compute einmal pro Seitenaufruf.

3. **Anforderungen an die Datenresidenz.** GDPR / DSGVO / Datenschutzgesetze auf Bundesstaatsebene können festlegen, wo Kundendaten gespeichert sein dürfen. Die Region Frankfurt (`eu-central-1`) ist die Option mit Datenhaltung in der EU; `us-east-1` und `us-west-1` halten Daten beide in den USA. Wir replizieren Daten nicht ohne Ihre ausdrückliche Anforderung über Regionen hinweg.

Wenn Ihre Nutzer weltweit verteilt sind, **deployen Sie in mehrere Regionen**. Ein gängiges Muster ist `us-east-1` für Nord- und Südamerika + `eu-central-1` für EMEA + `ap-southeast-1` für APAC, mit DNS-basiertem Routing (latenzbasiert, standortbasiert oder mit einem vorgeschalteten CDN).

## Pre-Launch-Regionen {#preview}

Regionen mit `status: 'preview'` nehmen schon vor der allgemeinen Verfügbarkeit Workloads an. Konkret:

- Sie akzeptieren dieselben API-Aufrufe wie Live-Regionen.
- Die Preise entsprechen denen der Live-Regionen.
- Das SLA gilt während der Preview **nicht** — Störungen können noch zu Ausfällen führen, während wir die Region einfahren.
- Die allgemeine Verfügbarkeit folgt typischerweise ~2 Monate nach dem Start der Preview. Bevor wir eine Region auf `live` umstellen, informieren wir die Konto-Admins per E-Mail.

Singapur (`ap-southeast-1`) ist die aktuelle Preview-Region.

## Nächste Schritte {#next-steps}

- Siehe [Virtuelle Maschinen](/docs/api/vms) zum Erstellen einer VM in einer bestimmten Region.
- Siehe [Verwaltete Datenbanken](/docs/api/managed-databases) zur Verfügbarkeit von Datenbanken je Region (in neuen Regionen sind Kafka und OpenSearch ~30 Tage später verfügbar als VMs/Postgres).
- Zu Multi-Region-Architekturen mit Replikation siehe die Anleitung **Multi-Region-Failover** (folgt in Kürze).
