---
title: "VM-Images"
description: "OS-Boot-Images — öffentliche Vorlagen und projekteigene Custom-Images."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# VM-Images

Ein VM-Image ist die OS-Vorlage, von der die Root-Disk einer neuen VM bootet. NimbusNexus liefert **öffentliche Images**, und Sie können eigene **Custom-Images** hochladen, die Sie mit Tools wie Packer bauen.

## Öffentliche Images {#public-images}

`GET /api/v1/image/` listet die Images auf, die Sie verwenden können; `visibility=public` grenzt die Liste auf die öffentlichen ein. Ein Image wird über seine `id` identifiziert, eine UUID, und genau die übergeben Sie als `image`, wenn Sie eine VM erstellen. Namen sind Bezeichnungen, keine versionierten Slugs; schlagen Sie deshalb die `id` nach, statt einen Namen fest im Code zu hinterlegen.

Beim Booten erhält eine VM den SSH-Key, den Sie in `sshs` angegeben haben (siehe [SSH-Keys](/docs/api/ssh-keys)), und die `user_data`, die Sie übergeben haben; ein Image mit cloud-init wendet sie beim ersten Boot an.

## Custom-Images {#custom-images}

Ein Custom-Image braucht zwei Aufrufe:

1. `POST /api/v1/image/` legt den Image-Datensatz aus einem `name` (mindestens 5 Zeichen), einem `disk_format` und einem `container_format` an und gibt seine `id` zurück. Optional setzen Sie `visibility` (Standard `private`: nur Ihr Projekt) und `subscription`, den Abrechnungsplan (Standard `Hourly`).
2. `POST /api/v1/image/file` lädt die Datei hoch, als Multipart mit `file` und `image_id`. Alternativ holt `POST /api/v1/image/import` mit `{"id": "…", "url": "…"}` das Image von einer URL.

Akzeptierte Dateiendungen sind `.img`, `.qcow2`, `.vmdk`, `.vhd`, `.vhdx`, `.raw`, `.iso`, `.ami`, `.ari`, `.aki` und `.vdi`; auf jede andere Endung antwortet die API mit `400`.

Custom-Images werden pro GB abgerechnet, auf ganze GB aufgerundet, als eigenes Produkt nach dem Plan in `subscription`; siehe [Preisdaten](/docs/api/pricing-data).

## Regionen {#regions}

Image-Aufrufe wirken in der Region Ihrer Sitzung. Einen Aufruf, der ein Image in eine andere Region kopiert, gibt es nicht.

## Nächste Schritte {#next-steps}

- [Virtuelle Maschinen](/docs/api/vms) — eine VM mit einem dieser Images bereitstellen.
- [VM-Größen](/docs/api/vm-sizes) — die Compute-Größe, in der das Image bootet.
- [Backups](/docs/api/backups) — Snapshots und Backups der Volumes einer VM.
