---
title: "Backups"
description: "Snapshots und Backups von Block-Volumes, on demand oder nach Zeitplan, an Ort und Stelle wiederhergestellt."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Backups

Ein Backup ist eine Point-in-Time-Kopie eines [Block-Volumes](/docs/api/block-storage), in einem von zwei Typen: ein `snapshot`, den der Blockspeicher-Dienst neben dem Volume aufbewahrt, oder ein `backup`, eine separate vollständige Kopie. Sie erstellen sie **on demand**, oder ein [Zeitplan](/docs/api/scheduled-backups) erstellt sie für Sie.

## Backups vs. Snapshots {#backups-vs-snapshots}

Beide sind Point-in-Time-Kopien; sie unterscheiden sich im Betrieb:

| | `type: snapshot` | `type: backup` |
| --- | --- | --- |
| Was es ist | Ein Snapshot, der beim Volume bleibt | Eine separate vollständige Kopie, die auch in Ihren eigenen Speicher gehen kann |
| Erstellt durch | Einen direkten Aufruf oder einen Zeitplan | Einen direkten Aufruf oder einen Zeitplan |
| Wiederhergestellt mit | `POST /api/v1/backup_restore/volume_backups/snapshot_restore` | `POST /api/v1/backup_restore/volume_backups/backup_restore` |

Ein Snapshot gehört zu seinem Volume: Wenn Sie das Volume mit `cascade: true` löschen (`DELETE /api/v1/storage/`), werden auch seine Snapshots gelöscht.

## Eine Kopie erstellen {#create}

`POST /api/v1/backup_restore/volume_backups/create_backup` kopiert ein Volume sofort. Geben Sie die `volume_id` und den `type` an, `snapshot` oder `backup`, dazu optional `name`, `description` und `permanent`. Bei einem `backup` sendet `storage_ids` die Kopie zusätzlich an externe Speicherverbindungen, die Sie mit `POST /api/v1/external/connections/` eingerichtet haben.

Der Aufruf stellt die Arbeit in die Warteschlange und antwortet sofort, oder er antwortet mit `409`, wenn die Kopie nicht in Ihr Backup-Kontingent passen würde. `GET /api/v1/backup_restore/volume_backups/` listet Ihre Kopien auf, gefiltert nach `backup_types` und `statuses`, mit `limit` (Standard 10) und `offset`. Der `status` einer Kopie ist `pending`, `in_progress`, `completed` oder `failed`.

## Geplante Kopien {#policies}

Ein Zeitplan erstellt Kopien für Sie. Legen Sie einen mit `POST /api/v1/backup_restore/backup_scheduler/` an und geben Sie dabei eine `frequency` und eine `backup_quantity` an; binden Sie ihn dann mit `POST /api/v1/backup_restore/volume_scheduler/` an jedes Volume und geben Sie dabei die `volume_id`, die `schedule_id` und den `type` an. Die Details stehen unter [Geplante Backups](/docs/api/scheduled-backups).

## Aufbewahrung {#retention}

Ein Zeitplan behält von jedem daran gebundenen Volume die neuesten `backup_quantity` Kopien (Standard 5) und löscht ältere, sobald neue Kopien hinzukommen; `outside_backup_quantity` (Standard 1) tut dasselbe für die Kopien in jedem externen Speicher. Kopien, die Sie on demand erstellen, bleiben, bis Sie sie löschen.

Um eine Kopie aus dieser Rotation herauszuhalten, setzen Sie bei ihr `permanent: true`, beim Erstellen oder später mit `PATCH /api/v1/backup_restore/volume_backups/{volume_backup_id}`.

Löschen Sie eine Kopie mit `DELETE /api/v1/backup_restore/volume_backups/single/{volume_backup_id}` oder mehrere mit `DELETE /api/v1/backup_restore/volume_backups/bulk` und ihren IDs im Query-Parameter `backup_ids`.

## Wiederherstellen {#restore}

Stellen Sie einen Snapshot mit `POST /api/v1/backup_restore/volume_backups/snapshot_restore` wieder her und ein Backup mit `POST /api/v1/backup_restore/volume_backups/backup_restore`. Beide nehmen `{"backup_id": "…"}` entgegen, stellen die Arbeit in die Warteschlange und antworten sofort. Die Kopie muss `completed` sein und den Typ des Endpoints haben; sonst antwortet der Aufruf mit `409`.

Ein Restore wirkt an Ort und Stelle. Er erstellt aus der Kopie ein neues Volume, in derselben Größe und in derselben Availability Zone wie das Original, und setzt es an die Stelle des Originals:

- Ein Daten-Volume wird von seiner VM getrennt, und das wiederhergestellte Volume wird an seiner Stelle angehängt.
- Beim Boot-Volume einer VM wird die VM auf der wiederhergestellten Disk neu aufgebaut. Die neue VM übernimmt die Ports und Floating-IPs der alten, und die alte VM wird gelöscht. Die VM erhält eine neue `id`; die wiederhergestellte Disk behält die SSH-Keys, die sie hatte.

Die Kopien und Zeitplan-Bindungen des ursprünglichen Volumes gehen auf das wiederhergestellte Volume über.

## Nächste Schritte {#next-steps}

- [Geplante Backups](/docs/api/scheduled-backups) — Kopien nach Zeitplan erstellen.
- [Blockspeicher](/docs/api/block-storage) — die Volumes, von denen diese Kopien stammen.
- [Virtuelle Maschinen](/docs/api/vms) — was ein Restore des Boot-Volumes neu aufbaut.
