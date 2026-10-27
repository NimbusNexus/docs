---
title: "Virtuelle Maschinen"
description: "VMs bereitstellen, abfragen, in der Größe ändern und löschen. Live-Referenz der Endpoints, automatisch aus der OpenAPI-Spezifikation generiert."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Virtuelle Maschinen

Eine virtuelle Maschine von NimbusNexus ist eine nach Verbrauch gemessene Compute-Instanz — ein Prozessbaum, eine Netzwerkschnittstelle, eine Root-Disk —, die sekundengenau abgerechnet wird. Sie erstellen eine, indem Sie eine Größe und eine Region wählen; alles andere (Block-Volumes, öffentliche IPs, Snapshots) wird als separate Ressource an sie angehängt.

## Wann eine VM passt {#when-to-use}

VMs sind der richtige Baustein, wenn Sie Folgendes brauchen:

- Persistenten Zustand auf der Disk zwischen Requests (eine Datenbank, ein Build-Cache, ein lange laufender Queue-Worker).
- Volle Kontrolle über das Betriebssystem — Pakete installieren, Kernel-Parameter optimieren, alles ausführen, was Systemzugriff braucht.
- Eine bestimmte Instanzgröße — viel RAM für einen Analytics-Workload, GPU für Inferenz, Compute-optimiert für einen CPU-lastigen Dienst.

Wenn Ihr Workload **zustandslos und request-basiert** ist, passen Container-Plattformen (verwaltete Kubernetes-Dienste, Serverless-Laufzeitumgebungen) meist besser. Die Grenze verläuft ungefähr so: Wenn es Sie stören würde, dass ein Neustart des Prozesses lokale Dateien löscht, brauchen Sie eine VM.

## Größen, Familien, Benennung {#sizes}

Größen folgen dem Muster `<family>-<vCPU>-<RAM_GB>`. Derzeit drei Familien:

- `gp-*` — Allzweck. Ausgewogen bei CPU + RAM. Die meisten Workloads beginnen hier.
- `co-*` — Compute-optimiert. 2× so viel CPU pro Dollar wie `gp`, halb so viel RAM pro Dollar.
- `mo-*` — RAM-optimiert. Umgekehrter Kompromiss. Richtig für In-Memory-Caches, JVM-Heaps, Scratch-Speicher für Analytics.

`gp-4-16` ist also 4 vCPU, 16 GB RAM, Allzweck. `co-16-32` ist 16 vCPU, 32 GB RAM, Compute-optimiert. Die vollständige Liste liefert `GET /v1/vms/sizes` (in dieser Referenz noch nicht automatisch dargestellt — folgt in Kürze).

## Lebenszyklus {#lifecycle}

Eine VM durchläuft diese Zustände:

- `provisioning` — die Disk wird vorbereitet und der Hypervisor weist die Instanz zu. ~5–30 Sekunden bei einem zwischengespeicherten Image, bis zu 90 Sekunden, wenn ein Image zum ersten Mal abgerufen wird.
- `running` — Boot abgeschlossen, die Instanz nimmt Traffic an. Das ist der stabile Zustand, in dem sich die VM die meiste Zeit befindet.
- `stopping` → `stopped` — geordnetes Herunterfahren. Die VM bleibt bestehen; Compute wird nicht mehr abgerechnet, Speicher weiterhin.
- `terminated` — die VM wurde gelöscht. Angehängte Block-Volumes wurden entweder ebenfalls gelöscht (Standard) oder getrennt und bleiben verfügbar (wenn beim Löschen `preserve_volumes: true` gesetzt war).

Zustandsübergänge stehen bei jedem `GET` im Feld `state`. Lang laufende Übergänge melden ihren Fortschritt in einem eingebetteten Objekt `operation` — das Muster zum Polling von Operationen, das hier und in der gesamten übrigen API verwendet wird, beschreibt die Seite [Konventionen](/docs/conventions).

## Benennung und stabile IDs {#ids}

Jede VM hat zwei Kennungen:

- `id` — opak, Präfix `vm_`, base32-Suffix mit 26 Zeichen. Stabil für die gesamte Lebensdauer der VM. Verwenden Sie sie in URLs, Fremdschlüsseln, Audit-Logs.
- `name` — für Menschen lesbar, 1–63 Zeichen, alphanumerisch + Bindestriche, eindeutig innerhalb eines Projekts. Änderbar über `PUT /v1/vms/{id}`. Verwenden Sie ihn in keinem Codepfad, den Sie nicht an dem Tag umschreiben wollen, an dem jemand die VM umbenennt.

Die Endpoint-Referenz unten verwendet `{id}` in Pfadvorlagen; der Wert, den Sie übergeben, ist die opake ID.
