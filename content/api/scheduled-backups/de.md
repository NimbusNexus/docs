---
title: "Geplante Backups"
description: "Wiederkehrende Backup-Zeitpläne — täglich, wöchentlich, individuell. Getrennt von On-Demand-Backups."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: scheduled-backups
---

# Geplante Backups

[On-Demand-Backups](/docs/api/backups) decken den Fall „Ich will jetzt sofort einen Snapshot dieses Volumes“ ab. Geplante Backups decken alles andere ab: nächtliche Backups jedes Produktions-Volumes, wöchentliche Voll-Backups kombiniert mit täglichen inkrementellen Backups, monatliche Snapshots, die aus Compliance-Gründen ein Jahr lang aufbewahrt werden.

Ein Zeitplan ist ein kleines JSON-Dokument — wählen Sie ein Ziel (ein Volume, eine VM, eine Datenbank), eine Häufigkeit (im Cron-Stil), eine Aufbewahrungsrichtlinie (die N neuesten behalten oder nach X Tagen ablaufen lassen) und eine Speicherrichtlinie (welche Region/Klasse für den Backup-Speicher). Der Scheduler läuft im Hintergrund; fehlgeschlagene Läufe werden mit Backoff wiederholt und erscheinen im Ausführungsprotokoll des Zeitplans.

Die meisten Produktionskonten nutzen 2–4 Zeitpläne: daily-keep-14, weekly-keep-8, monthly-keep-12 und gelegentlich einen Snapshot zum Jahresende, der für Finanzen/Recht 7 Jahre lang aufbewahrt wird.

## Nächste Schritte {#next-steps}

- [Backups](/docs/api/backups) — das On-Demand-Gegenstück und der Ressourcentyp, den Zeitpläne erzeugen.
- [Blockspeicher](/docs/api/block-storage) und [Snapshots](/docs/api/snapshots) — die Quellen der Backups.
- [Verwaltete Datenbanken](/docs/api/managed-databases) — mit eigenem Aufbewahrungsmodell; nutzt keine Zeitpläne dieses Endpoints.
