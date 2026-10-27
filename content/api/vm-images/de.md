---
title: "VM-Images"
description: "OS-Boot-Images — öffentliche Vorlagen und projekteigene Custom-Images."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# VM-Images

Ein VM-Image ist die OS-Vorlage, von der die Root-Disk einer neuen VM bootet. NimbusNexus liefert **öffentliche Images** für die großen Linux-Distributionen und Windows Server; Sie können auch eigene **Custom-Images** hochladen, die Sie mit Tools wie Packer bauen oder per Snapshot einer konfigurierten VM erstellen.

## Öffentliche Images {#public-images}

Der öffentliche Katalog wird monatlich mit Sicherheitspatches aktualisiert. Slugs bleiben über Patches hinweg stabil; wenn Sie `ubuntu-24.04` heute und in 6 Monaten erneut abrufen, erhalten Sie dieselbe Basis mit 6 Monaten an Patches. Legen Sie sich auf einen datierten Slug fest (z. B. `ubuntu-24.04-20260301`), wenn Sie byte-genau reproduzierbare Boots brauchen.

Derzeit veröffentlichte Slugs:

- `ubuntu-24.04`, `ubuntu-22.04`, `ubuntu-20.04`
- `debian-12`, `debian-11`
- `fedora-40`, `fedora-39`
- `rocky-9`, `rocky-8`
- `almalinux-9`, `almalinux-8`
- `windows-2022`, `windows-2019`

Jedes öffentliche Image enthält unsere minimale cloud-init-Konfiguration: SSH-Keys, die aus den registrierten Keys des Projekts eingespielt werden (siehe [SSH-Keys](/docs/api/ssh-keys)), `apt-get update` oder ein Äquivalent beim ersten Boot und den Metadatendienst, fest auf `169.254.169.254` eingestellt.

## Custom-Images {#custom-images}

Eigene Images akzeptieren wir als Dateien im Format **raw**, **qcow2** oder **vmdk** mit bis zu **128 GB** unkomprimiert. Das Image wird beim Upload in unser internes Format konvertiert (~1–3 Minuten pro GB) und ist danach ein normales bootfähiges Image für jede VM in derselben Region.

Custom-Images werden für die Speicherung mit \$0,013/GB-Monat abgerechnet (Preis des Objektspeichers in der Klasse Standard). Es gibt kein separates Tier „Image-Speicher“.

## Regionen {#regions}

Öffentliche Images sind in jeder Live-Region verfügbar. Custom-Images sind regionsgebunden — ein Upload nach `us-east-1` macht das Image in `eu-central-1` ohne Kopie nicht bootfähig. Verwenden Sie zum Replizieren `POST /v1/vm-images/{id}/copy` (nicht in der Referenz unten — folgt).

## Nächste Schritte {#next-steps}

- [Virtuelle Maschinen](/docs/api/vms) — eine VM mit einem dieser Images bereitstellen.
- [VM-Größen](/docs/api/vm-sizes) — die Compute-Größe, in der das Image bootet.
- [Snapshots](/docs/api/snapshots) — eine bestehende VM als Snapshot erfassen und dann in ein Custom-Image umwandeln.
