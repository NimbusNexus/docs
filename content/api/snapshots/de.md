---
title: "Snapshots"
description: "Point-in-Time-Kopien von VMs, Block-Volumes und verwalteten Datenbanken."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Snapshots

Ein Snapshot ist eine Point-in-Time-Kopie einer Quellressource — einer VM, eines Block-Volumes oder einer verwalteten Datenbank —, die in den Objektspeicher geschrieben wird. Snapshots überdauern ihre Quelle: Wenn Sie eine VM löschen, bleiben ihre Snapshots erhalten. Ein Restore aus einem Snapshot erstellt eine **neue** Ressource; das Original wird nie verändert.

## Drei Arten von Quellen {#source-kinds}

| Quellart | Was erfasst wird | Ziel des Restores |
| --- | --- | --- |
| `vm` | Root-Disk + Zustand der angehängten Volumes zu einem konsistenten Zeitpunkt | Eine neue VM gleicher oder größerer Größe, in jeder Region |
| `volume` | Inhalt des Block-Volumes zu einem konsistenten Zeitpunkt | Ein neues Block-Volume gleicher oder größerer Größe, jede Region |
| `database` | Logischer Snapshot auf Engine-Ebene (WAL-Fence bei Postgres / MySQL, Oplog-Punkt bei MongoDB usw.) | Eine neue Datenbank mit derselben Engine + Version |

Das Feld `source_kind` des Snapshots zeigt, um welche Art es sich handelt; der Restore-Endpoint leitet anhand dieses Felds an das richtige Backend weiter.

## Wie ein Snapshot Konsistenz erreicht {#consistency}

- **Volume-Snapshots** halten die I/O-Warteschlange an, erstellen einen Snapshot auf Blockebene (~10 Sekunden) und kopieren dann im Hintergrund weiter. Die VM läuft weiter; Schreibvorgänge nach dem Snapshot-Zeitpunkt landen im Zustand nach dem Snapshot.
- **VM-Snapshots** erfassen die Root-Disk + jedes angehängte Volume atomar. Wenn Sie Hooks vor/nach dem Snapshot konfiguriert haben (cloud-init-Skripte, die die Puffer einer Anwendung leeren), laufen sie direkt im Ablauf mit.
- **Datenbank-Snapshots** nutzen den nativen Konsistenzmechanismus der Engine. Der Aufrufer muss kein I/O anhalten; der Commit-Log-Fence der Datenbank selbst garantiert, dass Sie auf einen transaktional konsistenten Zeitpunkt wiederherstellen können.

Für Anwendungen, die Konsistenz auf Anwendungsebene brauchen (z. B. eine Postgres-Datenbank, die auf einer VM läuft statt als verwaltete Datenbank), nutzen Sie besser die Snapshot-API der Datenbank selbst als einen Volume-Snapshot.

## Speicherung + Aufbewahrung {#storage}

Snapshots liegen im Cold-Storage-Tier (\$0,04/GB-Monat, dedupliziert gegenüber früheren Snapshots derselben Quelle). Die Aufbewahrung beträgt standardmäßig **7 Tage**; übergeben Sie beim Erstellen `retention_days`, um sie auf bis zu 365 Tage zu verlängern.

Die Deduplizierung bedeutet: Eine Reihe täglicher Snapshots derselben VM ist ungefähr so groß wie die ursprüngliche VM plus die tägliche Änderung — nicht N× die Größe der VM. Im eingeschwungenen Zustand fallen für eine Richtlinie mit täglichen Snapshots und 30 Tagen Aufbewahrung bei einer VM mit 100 GB typischerweise Kosten für insgesamt 130–160 GB an, je nachdem, wie viel sich ändert.

## Verhalten beim Restore {#restore}

Ein Restore erstellt aus dem Snapshot eine **neue Ressource**. Die Quellressource (falls noch vorhanden) bleibt unberührt. Wiederhergestellte VMs erhalten eine neue ID, eine neue IP und neu eingespielte SSH-Keys aus den aktuellen Keys des Projekts (der ursprüngliche Satz an Keys bleibt nicht erhalten — stellen Sie eine alte VM nach einer Key-Rotation wieder her, erhalten Sie VMs, auf die die alten, entfernten Keys keinen Zugriff haben).

Cross-Region-Restore wird unterstützt. Die interne Datenübertragung für die Kopie des Snapshots wird beim ersten Mal als Cross-Region-Egress abgerechnet (\$0,005/GB); spätere Restores in der Zielregion wiederholen die Übertragung nicht.

## Nächste Schritte {#next-steps}

- [Virtuelle Maschinen](/docs/api/vms) — der Lebenszyklus von VMs, den Snapshots erfassen.
- [Blockspeicher](/docs/api/block-storage) — speziell Volume-Snapshots.
- [Verwaltete Datenbanken](/docs/api/managed-databases) — datenbankspezifische Snapshots über den Endpoint der Datenbank selbst.
- [Cold Storage](/docs/api/cold-storage) — das Tier, in dem Snapshots liegen.
