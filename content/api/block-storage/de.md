---
title: "Blockspeicher"
description: "Persistente NVMe-Volumes, die an VMs angehängt werden. Drei Tiers, Live-Resize, Snapshots."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Blockspeicher

Block-Volumes sind persistente NVMe-Disks, die Sie an VMs anhängen. Jedes Volume liegt in einer einzigen Region, überdauert die VM, an die es angehängt ist (Sie können es trennen und an eine neue VM anhängen), lässt sich ohne Downtime in der Größe ändern und kann bei Bedarf per Snapshot im Objektspeicher gesichert werden.

## Tiers {#tiers}

| Tier | Pro GB-Monat | Durchsatz | IOPS (Spitze) | Wann verwenden |
| --- | --- | --- | --- | --- |
| `standard` | \$0,11 | 250 MB/s | 3.000 | Root-Disks, Entwicklungsdatenbanken, alles, was günstig bleiben soll. |
| `performance` | \$0,18 | 1.000 MB/s | 16.000 | Disks für Produktionsdatenbanken, Build-Caches, häufig genutzte Daten. **Standard für verwaltete Datenbanken.** |
| `extreme` | \$0,30 | 4.000 MB/s | 64.000 | Latenzkritische Workloads — Ad-Serving, Scratch-Speicher für Analytics, alles, dessen Engpass die Disk ist. |

Alle drei Tiers nutzen dieselbe NVMe-Hardware; sie unterscheiden sich in der QoS auf Scheduling-Ebene, nicht im Speichermedium. Sie können ohne Downtime die Größe **und** das Tier ändern — beginnen Sie mit Standard, wechseln Sie zu Performance, wenn das IOPS-Budget nicht mehr reicht, und wechseln Sie zurück, wenn sich der Verbrauch einpendelt.

## Lebenszyklus {#lifecycle}

Volumes durchlaufen vier Zustände:

- `available` — erstellt, aber nicht angehängt. Wird genauso abgerechnet wie im angehängten Zustand (für den Speicher macht das keinen Unterschied).
- `attached` — an eine VM gebunden. In der VM als Blockgerät sichtbar (`/dev/sdb`, `/dev/sdc`, …).
- `detaching` → `available` — wird von einer VM getrennt. Das Aushängen geschieht serverseitig; stellen Sie vorher sicher, dass Ihr Dateisystem alle Daten auf die Disk geschrieben hat.
- `deleted` — gelöscht. **Kann nicht wiederhergestellt werden.** Erstellen Sie vorher einen Snapshot, wenn Sie ein wiederherstellbares Backup wollen.

Trennen und Löschen sind getrennte Aufrufe. Wir löschen ein Volume bewusst nicht automatisch, wenn die VM gelöscht wird, an der es hängt — eine Datenbank-Disk zu verlieren, weil ein Teammitglied die falsche VM gelöscht hat, ist genau die Art von Katastrophe, die mit der API nicht leicht aus Versehen passieren sollte.

## Größe ändern {#resize}

`POST /v1/volumes/{id}/resize` mit `{ "size_gb": 500 }` vergrößert ein Volume. Die Disk wächst im laufenden Betrieb; das Dateisystem in der VM braucht einen separaten Aufruf von `resize2fs` / `xfs_growfs`, um den neuen Platz zu nutzen. Diesen Schritt dokumentieren wir in den [VM-Anleitungen](/docs/api/vms) für das jeweilige Betriebssystem.

Verkleinern im laufenden Betrieb wird nicht unterstützt. So verkleinern Sie ein Volume: Snapshot erstellen, aus dem Snapshot ein neues, kleineres Volume erstellen, das neue anhängen, Daten kopieren, das alte trennen. Das lässt sich leicht skripten; wir liefern es nicht als integrierte Funktion aus, weil man sich damit zu leicht Datenverlust einhandelt.

## Snapshots {#snapshots}

Snapshots sind Point-in-Time-Kopien, die im Objektspeicher liegen (Klasse `cold` — günstig, wird bei einem Restore nach Bedarf abgerufen).

- Ausgelöst durch `POST /v1/volumes/{id}/snapshots`.
- Brauchen ~10 Sekunden bis zum Konsistenzpunkt und kopieren dann im Hintergrund weiter.
- Speicherung für \$0,04/GB-Monat.
- Wiederherstellbar in ein neues Volume **gleicher oder größerer** Größe, in jeder Region (ein Cross-Region-Restore zählt als Egress zwischen Regionen zu \$0,005/GB).

Der Snapshot ist auf Blockebene konsistent, nicht auf Anwendungsebene. Für Datenbanken nutzen Sie besser die Snapshot-API der Datenbank selbst (siehe [Verwaltete Datenbanken](/docs/api/managed-databases)) — sie hält Schreibvorgänge auf Engine-Ebene an. Snapshots auf Blockebene eignen sich für Dateisystem-Volumes, auf denen keine transaktionale Engine läuft.

## Verhalten beim Anhängen {#attach}

Ein Volume kann an **jeweils nur eine VM** angehängt sein. Multi-Attach (Semantik einer gemeinsam genutzten Disk) wird nicht unterstützt — die Koordination auf Anwendungsebene über ein gemeinsam genutztes NVMe-Volume ist schwieriger, als die API-Oberfläche vermuten lässt, und wir bauen diese Falle lieber gar nicht erst.

Das Anhängen ist regionsgebunden: Ein Volume in `us-east-1` kann nicht an eine VM in `eu-central-1` angehängt werden. Um Daten zwischen Regionen zu verschieben, ist Snapshot + Restore das richtige Muster.

## Hinweise zu Preisen {#pricing}

- Speicher: pro GB-Monat, sekundengenau abgerechnet. Die Storage-Klasse (Standard/Performance/Extreme) bestimmt den Preis; die Größe bestimmt den Multiplikator.
- Snapshots: \$0,04/GB-Monat, abgerechnet nach der Inhaltsgröße des Snapshots (dedupliziert über alle Snapshots desselben Volumes).
- Cross-Region-Replikation: \$0,005/GB-Monat für die replizierte Kopie, plus der normale Egress zwischen Regionen für die erste Synchronisierung.
- Keine Abrechnung nach IOPS. Keine Gebühr pro Anhängen. Kein Aufpreis für Durchsatz.

## Nächste Schritte {#next-steps}

- [Virtuelle Maschinen](/docs/api/vms) — woran Sie Volumes anhängen.
- [Objektspeicher](/docs/api/object-storage) — für unstrukturierte Daten, die keinen Zugriff auf Blockebene brauchen (Logs, Backups, Uploads von Nutzern). Bei großen Datenmengen günstiger.
- [Konventionen](/docs/conventions) zum Polling von Operationen, zu Idempotenz und Fehlerformaten.
