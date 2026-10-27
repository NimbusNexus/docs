---
title: "VM-Größen"
description: "Katalog der Compute-Größen in den Familien gp, co, mo und gx."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# VM-Größen

Eine VM-Größe ist eine benannte Compute-Größe — Anzahl der vCPUs, RAM, Größe der Root-Disk und Familie. Jede VM wird mit einem Größencode erstellt (z. B. `gp-4-16`); ändern Sie die Größe einer VM, wird der Code zur Laufzeit ausgetauscht.

## Die vier Familien {#families}

| Familie | Code-Präfix | Wofür sie optimiert ist |
| --- | --- | --- |
| **Allzweck** | `gp-*` | Ausgewogen bei CPU + RAM. Der Standard für die meisten Workloads. |
| **Compute-optimiert** | `co-*` | 2× so viel CPU pro Dollar wie `gp`, halb so viel RAM pro Dollar. Richtig für CPU-lastige Dienste, Batch-Jobs, Video-Encoding. |
| **RAM-optimiert** | `mo-*` | Umgekehrter Kompromiss. Richtig für In-Memory-Caches, JVM-Heaps, Scratch-Speicher für Analytics. |
| **GPU** | `gx-*` | Beschleuniger NVIDIA L4 / H100. ML-Inferenz, Training, Transcoding. |

## Namenskonvention {#naming}

Größencodes folgen dem Muster `<family>-<vCPU>-<RAM_GB>`. Also:

- `gp-1-2` — 1 vCPU, 2 GB RAM, Allzweck (die kleinste sinnvolle Größe, ~\$0,0145/vCPU-Stunde)
- `gp-4-16` — 4 vCPU, 16 GB RAM, Allzweck
- `co-16-32` — 16 vCPU, 32 GB RAM, Compute-optimiert
- `mo-8-64` — 8 vCPU, 64 GB RAM, RAM-optimiert
- `gx-4-32-l4` — 4 vCPU, 32 GB RAM, 1× L4-GPU (bei GPU-Größen wird der Code des Beschleunigers angehängt)

Der Katalog-Endpoint liefert die vollständige Liste mit den aktuellen Preisen pro Größe. Die Preise unterscheiden sich leicht zwischen Regionen; die Antwort enthält eine Preistabelle pro Region.

## Größe ändern {#resizing}

Eine VM kann ohne erneute Bereitstellung die Größe wechseln. Ein Resize innerhalb derselben Familie läuft online (ohne Downtime). Ein Resize über Familien hinweg erfordert einen Zyklus aus Stoppen / Starten. Ein Resize zwischen Architekturen (z. B. `gp` zu `gx`) bedeutet Löschen / Neuerstellen — die API lehnt den direkten Resize-Aufruf ab, damit der implizite Datenverlust explizit wird.

## Nächste Schritte {#next-steps}

- [Virtuelle Maschinen](/docs/api/vms) — die Endpoints, die eine VM in einer dieser Größen tatsächlich bereitstellen.
- [VM-Images](/docs/api/vm-images) — die OS-Vorlagen, mit denen Sie die VM booten.
- [SSH-Keys](/docs/api/ssh-keys) — öffentliche Schlüssel, die beim Boot in VMs eingespielt werden.
