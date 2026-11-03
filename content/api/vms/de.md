---
title: "Virtuelle Maschinen"
description: "VMs bereitstellen, abfragen, in der Größe ändern und löschen. Live-Referenz der Endpoints, automatisch aus der OpenAPI-Spezifikation generiert."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Virtuelle Maschinen

Eine virtuelle Maschine von NimbusNexus ist eine Compute-Instanz mit einer Boot-Disk und einer Netzwerkschnittstelle pro Netzwerk, an das sie angebunden ist. Sie erstellen eine mit `POST /api/v1/instance/` in der Region Ihrer Sitzung; alles andere (Block-Volumes, öffentliche IPs) wird als separate Ressource an sie angehängt.

## Wann eine VM passt {#when-to-use}

VMs sind der richtige Baustein, wenn Sie Folgendes brauchen:

- Persistenten Zustand auf der Disk zwischen Requests (eine Datenbank, ein Build-Cache, ein lange laufender Queue-Worker).
- Volle Kontrolle über das Betriebssystem — Pakete installieren, Kernel-Parameter optimieren, alles ausführen, was Systemzugriff braucht.
- Eine bestimmte Instanzgröße — die Zahl der vCPUs und den RAM, die Ihr Workload braucht.

Wenn Ihr Workload **zustandslos und request-basiert** ist, passen Container-Plattformen (verwaltete Kubernetes-Dienste, Serverless-Laufzeitumgebungen) meist besser. Die Grenze verläuft ungefähr so: Wenn es Sie stören würde, dass ein Neustart des Prozesses lokale Dateien löscht, brauchen Sie eine VM.

## Ausstattung und Erstellung {#sizes}

`POST /api/v1/instance/` nimmt einen `name` und eine `spec` entgegen, die die Ausstattung der VM festlegt: `architecture` und `vm_class`, `cpu` (vCPUs) und `ram` (MB) sowie den `volume_type` ihrer Boot-Disk (siehe [Blockspeicher](/docs/api/block-storage#tiers)). Außerdem braucht der Aufruf ein `image` (oder bootfähige `volumes`), mindestens ein `network` und mindestens eine `security_group`. Zu den optionalen Feldern gehören `sshs` (der zu installierende [SSH-Key](/docs/api/ssh-keys)), `volume_size` (die Größe der Boot-Disk in GB, wenn Sie von `image` booten; Standard 5), `user_data`, `metadata` und `subscription`. Für den Beitritt zu einem Provider-Netzwerk braucht es außerdem `bandwidth_mbps` und `subscription.bandwidth`; ohne sie antwortet der Aufruf mit `400`.

Größencodes gibt es nicht. `GET /api/v1/instance/artifacts` listet in `vm_options` die Auswahl für `architecture` und `vm_class` in der Region Ihrer Sitzung auf, dazu die Images, Netzwerke, Sicherheitsgruppen, SSH-Keys, Servergruppen und Volumes, die Sie verwenden können. Die VM läuft auf einem [Flavor](/docs/api/vm-sizes) mit genau Ihren Werten für `cpu` und `ram`; gibt es keinen solchen, legt die API ihn an. Die Preise finden Sie unter [Preisdaten](/docs/api/pricing-data).

## Lebenszyklus {#lifecycle}

Das Erstellen einer VM ist asynchron: `POST /api/v1/instance/` stellt die Arbeit in die Warteschlange und antwortet mit `{"success": true}`, ohne ID. Suchen Sie die neue VM in `GET /api/v1/instance/` und verfolgen Sie ihren `status`, den eigenen Wert des Compute-Dienstes. Die Werte, die Ihnen am häufigsten begegnen:

- `BUILD` — die VM wird erstellt.
- `ACTIVE` — läuft.
- `SHUTOFF` — gestoppt.
- `VERIFY_RESIZE` — Größe geändert, wartet darauf, dass Sie bestätigen oder zurücksetzen (siehe [VM-Größen](/docs/api/vm-sizes#resizing)).
- `ERROR` — etwas ist fehlgeschlagen; `fault` sagt, was.

`POST /api/v1/instance/action` startet, stoppt oder löscht VMs: Führen Sie ihre IDs in `servers` auf und setzen Sie `cmd` auf `start`, `stop` oder `delete`. Auch eine gestoppte VM wird abgerechnet: Die Abrechnung läuft vom Erstellen bis zum Löschen, nach dem Plan in `subscription.vm` (Standard `Monthly`). Das Löschen einer VM löscht das Boot-Volume, das aus ihrem Image erstellt wurde; Volumes, die in `volumes` übergeben oder später angehängt wurden, bleiben `available`.

## Benennung und stabile IDs {#ids}

Jede VM hat zwei Kennungen:

- `id` — die UUID der VM. Stabil für die gesamte Lebensdauer der VM. Verwenden Sie sie in URLs, Fremdschlüsseln, Audit-Logs.
- `name` — für Menschen lesbar, eine beliebige nicht leere Zeichenkette. Ändern Sie ihn oder die `description` mit `PATCH /api/v1/instance/{instance_id}`. Verwenden Sie ihn in keinem Codepfad, den Sie nicht an dem Tag umschreiben wollen, an dem jemand die VM umbenennt.

Die Endpoint-Referenz unten verwendet `{instance_id}` in Pfadvorlagen (`{server_id}` bei den Endpoints für [VM-Schnittstellen](/docs/api/vm-interfaces)); der Wert, den Sie übergeben, ist die `id` der VM.
