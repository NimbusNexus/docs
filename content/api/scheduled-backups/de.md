---
title: "Geplante Backups"
description: "Wiederkehrende Backup-Zeitpläne — täglich, wöchentlich oder monatlich. Getrennt von On-Demand-Backups."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: scheduled-backups
---

# Geplante Backups

[On-Demand-Backups](/docs/api/backups) decken den Fall „Ich will jetzt sofort einen Snapshot dieses Volumes“ ab. Geplante Backups erstellen nach Zeitplan Kopien eines Volumes und behalten die neuesten davon.

Ein Zeitplan hat eine `frequency` und eine `backup_quantity`, die Anzahl der Kopien, die behalten werden (Standard 5). Ein Zeitplan mit `daily` läuft jeden Tag; `weekly` läuft alle 7 Tage und `monthly` alle 30 Tage, gezählt ab dem Tag, an dem der Zeitplan erstellt wurde. Legen Sie einen mit `POST /api/v1/backup_restore/backup_scheduler/` an; er gehört zu Ihrem Workspace. Binden Sie ihn dann mit `POST /api/v1/backup_restore/volume_scheduler/` an jedes Volume und geben Sie dabei die `volume_id`, die `schedule_id` und den `type` der Kopie an, `snapshot` oder `backup`. Auf das Binden antwortet die API mit `409`, wenn die Kopien nicht in Ihr Backup-Kontingent passen würden.

Um Kopien vom Typ `backup` zusätzlich an externen Speicher zu senden, setzen Sie `use_outside_storage` an der Bindung und verknüpfen den Speicher mit `POST /api/v1/backup_restore/volume_scheduler/config-storage` (`config_id`, `storage_id`, `priority`). Die `outside_backup_quantity` des Zeitplans (Standard 1) legt fest, wie viele Kopien dort behalten werden.

Der Scheduler läuft im Hintergrund. Ein fehlgeschlagener Lauf wird wiederholt, und einer, der immer wieder fehlschlägt, sendet eine [Benachrichtigung](/docs/api/notifications). Um eine Kopie über die Rotation hinaus zu behalten, etwa eine Kopie zum Jahresende, setzen Sie mit `PATCH /api/v1/backup_restore/volume_backups/{volume_backup_id}` bei ihr `permanent: true`.

## Nächste Schritte {#next-steps}

- [Backups](/docs/api/backups) — das On-Demand-Gegenstück und der Ressourcentyp, den Zeitpläne erzeugen.
- [Blockspeicher](/docs/api/block-storage) — die Volumes, die Zeitpläne kopieren.
