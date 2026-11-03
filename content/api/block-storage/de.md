---
title: "Blockspeicher"
description: "Persistente Volumes für VMs — erstellen, anhängen, trennen, vergrößern und löschen."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Blockspeicher

Block-Volumes sind persistente Disks, die Sie an VMs anhängen. Jedes Volume liegt in der Region Ihrer Sitzung; ein Daten-Volume überdauert die VM, an die es angehängt ist (Sie können es trennen und an eine neue VM anhängen); Volumes lassen sich vergrößern; und über [Backups](/docs/api/backups) können Sie von einem Volume einen Snapshot oder ein Backup erstellen.

## Volume-Typen {#tiers}

`GET /api/v1/storage/artifacts` listet auf, was Sie in der Region Ihrer Sitzung erstellen können: die Volume-Typen in `types` und die Speicheroptionen mit Preis in `volume_options`. `POST /api/v1/storage/` nimmt die `size` in GB und den `volume_type` entgegen, eine der Bezeichnungen aus `volume_options`, die den Preis bestimmt. Optionale Felder sind ein `type` aus `types`, ein `name`, eine `description`, ein `image`, aus dem das Volume erstellt wird, und `subscription`, der Abrechnungsplan (Standard `Hourly`).

Ein Volume behält seinen Typ für immer: Einen Aufruf, ihn zu ändern, gibt es nicht. Die Preise pro `volume_type` finden Sie unter [Preisdaten](/docs/api/pricing-data).

## Lebenszyklus {#lifecycle}

`POST /api/v1/storage/` stellt die Arbeit in die Warteschlange und antwortet ohne ID; das neue Volume erscheint in `GET /api/v1/storage/`. Sein `status` kommt vom Blockspeicher-Dienst. Die Werte, die Ihnen am häufigsten begegnen:

- `available` — erstellt, aber nicht angehängt. Wird genauso abgerechnet wie im angehängten Zustand (für den Speicher macht das keinen Unterschied).
- `in-use` — an eine VM gebunden. In der VM als Blockgerät sichtbar (`/dev/vdb`, `/dev/vdc`, …).
- `detaching` → `available` — wird von einer VM getrennt. Hängen Sie das Dateisystem in der VM aus, bevor Sie das Volume trennen.

Trennen und Löschen sind getrennte Aufrufe. Das Löschen einer VM löscht das Boot-Volume, das aus ihrem Image erstellt wurde; Volumes, die Sie angehängt oder beim Erstellen der VM in `volumes` übergeben haben, bleiben `available`.

`DELETE /api/v1/storage/` löscht die Volumes, deren IDs Sie in `ids` aufführen. Ein gelöschtes Volume **kann nicht wiederhergestellt werden**; sichern Sie es deshalb vorher, wenn Sie eine wiederherstellbare Kopie wollen. Mit `cascade: true` werden die Snapshots des Volumes mitgelöscht.

## Größe ändern {#resize}

`POST /api/v1/storage/resize` mit `{"volume_id": "…", "new_size": 500}` vergrößert ein Volume auf 500 GB. `new_size` muss größer sein als die aktuelle Größe; auf alles andere antwortet die API mit `400`. Das Dateisystem in der VM braucht einen separaten Aufruf von `resize2fs` / `xfs_growfs`, um den neuen Platz zu nutzen.

Verkleinern wird nicht unterstützt. So verkleinern Sie ein Volume: ein neues, kleineres Volume erstellen, es anhängen, die Daten kopieren und das alte trennen.

## Snapshots {#snapshots}

Snapshots und Backups eines Volumes erstellen Sie über [Backups](/docs/api/backups): `POST /api/v1/backup_restore/volume_backups/create_backup` mit der `volume_id` und `type: snapshot` (eine Point-in-Time-Kopie, die beim Volume bleibt) oder `type: backup` (eine separate vollständige Kopie).

Der Snapshot ist auf Blockebene konsistent, nicht auf Anwendungsebene. Halten Sie bei einer Datenbank zuerst die Schreibvorgänge an oder verwenden Sie das eigene Backup-Tool der Datenbank. Snapshots auf Blockebene eignen sich für Dateisystem-Volumes, auf denen keine transaktionale Engine läuft.

Ein Restore setzt die Kopie an die Stelle des Volumes, in derselben Größe; siehe [Backups](/docs/api/backups#restore).

## Verhalten beim Anhängen {#attach}

Ein Volume kann an **jeweils nur eine VM** angehängt sein. Multi-Attach (Semantik einer gemeinsam genutzten Disk) wird nicht unterstützt.

`POST /api/v1/storage/attach` nimmt die `volume_id`, die `instance_id` und optional einen `mountpoint` entgegen; ohne ihn erhält das Volume das erste freie Gerät ab `/dev/vdb`. `POST /api/v1/storage/detach` nimmt die `instance_id`, die `volume_id` und die `attachment_id` entgegen, die `GET /api/v1/storage/detach_artifacts` für eine VM auflistet.

Ein Volume und die VM, an die es angehängt wird, liegen beide in der Region Ihrer Sitzung.

## Hinweise zu Preisen {#pricing}

- Speicher: pro GB abgerechnet, zum Preis des `volume_type` des Volumes, nach dem Plan in `subscription`. Die Preise finden Sie unter [Preisdaten](/docs/api/pricing-data).
- Keine Abrechnung nach IOPS. Keine Gebühr pro Anhängen. Kein Aufpreis für Durchsatz.

## Nächste Schritte {#next-steps}

- [Virtuelle Maschinen](/docs/api/vms) — woran Sie Volumes anhängen.
- [Objektspeicher](/docs/api/object-storage) — für unstrukturierte Daten, die keinen Zugriff auf Blockebene brauchen (Logs, Backups, Uploads von Nutzern).
- [Backups](/docs/api/backups) — Snapshots und Backups eines Volumes und ihre Wiederherstellung.
