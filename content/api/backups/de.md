---
title: "Backups"
description: "Geplante und On-Demand-Backups mit Deduplizierung, Aufbewahrungsrichtlinien und Cross-Region-Restore."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Backups

Backups sind verwaltete Kopien von VMs, Volumes und Datenbanken, die mit Deduplizierung und konfigurierbarer Aufbewahrung im Cold-Storage-Tier liegen. Die Endpoints unterstützen sowohl **On-Demand**-Backups (einmalig, Sie rufen POST auf) als auch **geplante** Backups (wiederkehrend, gesteuert durch eine Richtlinie, die an die Quellressource angehängt ist).

## Backups vs. Snapshots {#backups-vs-snapshots}

Beide sind Point-in-Time-Kopien; sie unterscheiden sich im Betrieb:

| | Snapshot | Backup |
| --- | --- | --- |
| Erstellt durch | Nur direkten API-Aufruf | Direkten Aufruf ODER eine wiederkehrende Richtlinie |
| Aufbewahrung | Standardmäßig 7 Tage, manuell verlängerbar | Gesteuert durch eine explizite Aufbewahrungsrichtlinie (Tiers täglich/wöchentlich/monatlich) |
| Preise | \$0,04/GB-Monat (Cold-Storage-Tier, dedupliziert) | \$0,04/GB-Monat + Retrieval-Gebühren pro Restore |
| Cross-Region-Replikation | Manuell per Restore und anschließender Kopie | In die Richtlinie integriert |
| Restore als neue Ressource | Ja | Ja |
| Audit-Log | Standard | Standard + Metadaten zur Zuordnung zur Richtlinie |

Nutzen Sie Snapshots für Ad-hoc-Kopien, die Sie selbst verwenden. Nutzen Sie Backups für das wiederkehrende Muster „wir haben immer eine 7 Tage, eine 30 Tage und eine 365 Tage alte Kopie“ — das ist die richtliniengesteuerte Variante.

## Richtliniengesteuerte Backups {#policies}

So hängen Sie eine Backup-Richtlinie an eine VM / ein Volume / eine Datenbank an:

```json
{
  "source_id": "vm_01H...",
  "source_kind": "vm",
  "schedule": "daily",
  "retention": {
    "daily": 7,
    "weekly": 4,
    "monthly": 12,
    "yearly": 5
  }
}
```

Diese Richtlinie hält im eingeschwungenen Zustand 7 tägliche + 4 wöchentliche + 12 monatliche + 5 jährliche = 28 aktive Backups vor. Ältere Backups werden automatisch entfernt; Sie müssen nicht manuell aufräumen.

Die Endpoints für Richtlinien liegen unter `/v1/backups/policies` (im minimalen Beispiel unten nicht enthalten — die vollständige Referenz steht in der Live-Spezifikation).

## Aufbewahrungssperren {#retention}

Ein Backup in einem aktiven Aufbewahrungs-Tier (z. B. „täglich, 7 behalten“) unterliegt für diesen Zeitraum einer **Aufbewahrungssperre**. Versuchen Sie, es vor Ablauf zu löschen, antwortet die API mit 409. Das ist die Compliance-Funktion: Ein Benutzer kann ein Backup, das noch im Aufbewahrungsfenster liegt, nicht löschen, auch nicht mit Admin-Rechten.

Um das zu umgehen, müssten Sie die Quelle von der Richtlinie trennen (das Backup ist dann verwaist und nicht mehr gesperrt) und es anschließend löschen. Das Verwaisen wird im Audit-Log protokolliert.

## Cross-Region-Replikation {#cross-region}

Eine Richtlinie kann eine sekundäre Region angeben: Jedes Backup, das die Richtlinie erstellt, wird innerhalb von ~10 Minuten nach der Erstellung in die sekundäre Region repliziert. Die replizierte Kopie wird als Cross-Region-Speicher abgerechnet (\$0,005/GB-Monat Aufschlag gegenüber der primären Region).

Ein Restore aus der sekundären Region erfordert keinen zusätzlichen Aufwand — `POST /v1/backups/{id}/restore` mit der ID der sekundären Kopie; die Zielregion ist standardmäßig die Region der sekundären Kopie. Eine gängige DR-Übung: monatlicher Restore aus der sekundären Region in ein Sandbox-Projekt, prüfen, löschen.

## Nächste Schritte {#next-steps}

- [Snapshots](/docs/api/snapshots) — das Ad-hoc-Gegenstück.
- [Cold Storage](/docs/api/cold-storage) — das Tier, in dem Backups liegen.
- [Virtuelle Maschinen](/docs/api/vms), [Blockspeicher](/docs/api/block-storage), [Verwaltete Datenbanken](/docs/api/managed-databases) — die drei Arten von Quellressourcen.
