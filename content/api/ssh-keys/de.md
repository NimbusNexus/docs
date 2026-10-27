---
title: "SSH-Keys"
description: "Öffentliche Schlüssel, die im Projekt registriert und beim Boot in VMs eingespielt werden."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# SSH-Keys

Mit SSH-Keys melden Sie sich an Linux-VMs an, nachdem sie gebootet haben. Registrieren Sie Ihren öffentlichen Schlüssel im Projekt; jede neue VM erhält ihn über cloud-init in der Datei `~/.ssh/authorized_keys` des Standardbenutzers.

## So funktioniert es {#how-it-works}

Sie registrieren nur den **öffentlichen** Schlüssel — NimbusNexus sieht Ihren privaten Schlüssel nie. Beim Boot stellt der Metadatendienst cloud-init die registrierten öffentlichen Schlüssel des Projekts bereit, und cloud-init schreibt sie in die Datei authorized_keys des Standardbenutzers (`ubuntu` bei Ubuntu, `debian` bei Debian, `rocky` bei Rocky, `Administrator` bei Windows über WinRM).

Keys, die Sie **nach** dem Boot einer VM hinzufügen, werden nicht automatisch an laufende VMs übertragen. Starten Sie die VM entweder neu (cloud-init läuft standardmäßig nur beim ersten Boot, das hilft also nur bei Images, die erneutes Ausführen aktivieren) oder fügen Sie den Key in der VM mit Ihrem üblichen Konfigurationsmanagement hinzu.

## Unterstützte Formate {#formats}

Wir akzeptieren:

- **ed25519** — empfohlen; klein, schnell, modern
- **ecdsa-sha2-nistp256 / nistp384 / nistp521**
- **RSA** — mindestens 2048 Bit; 4096 Bit empfohlen; < 2048 lehnen wir ab

DSA wird abgelehnt (upstream seit OpenSSH 7.0 als veraltet markiert).

Der Key-String muss im OpenSSH-Format vorliegen — die einzelne Zeile, die mit `ssh-ed25519`, `ecdsa-sha2-nistp...` oder `ssh-rsa` beginnt, gefolgt vom base64-kodierten Schlüsselmaterial und optional einem Kommentar. Genau das enthalten die Dateien `~/.ssh/id_*.pub` standardmäßig.

## Fingerprints + Duplikate {#fingerprints}

Jeder Key hat einen stabilen **SHA256-Fingerprint**. Die API lehnt Duplikate anhand des Fingerprints ab — wenn Sie denselben Key zweimal hinzufügen (auch mit anderer Bezeichnung), antwortet sie mit 409. So fällt der häufige Fehler „Ich habe meinen Laptop-Key zu zwei Projekten hinzugefügt“ auf, bevor er zu einer verwirrenden Zuordnung von Konten führt.

## Key entfernen {#removing}

Wenn Sie einen Key aus dem Projekt löschen, wird er bei künftigen VM-Boots nicht mehr eingespielt. **Bereits gebootete VMs behalten den Key** in ihrer Datei authorized_keys — cloud-init gleicht keinen Zustand ab, sondern installiert nur beim ersten Boot. Um einen Key auf laufenden VMs zu widerrufen, können Sie entweder:

1. Die VMs aus einem frischen Snapshot neu erstellen oder
2. `~/.ssh/authorized_keys` direkt in der VM bearbeiten (oder über Ihr Konfigurationsmanagement).

Wenn Sie einen Key schnell widerrufen müssen, weil er kompromittiert wurde: Das Dashboard bietet mit einem Klick „revoke from all projects“, das die Entfernung über den Metadatendienst verteilt. Das Gegenstück in der API steht in der IAM-Referenz (folgt).

## Nächste Schritte {#next-steps}

- [Virtuelle Maschinen](/docs/api/vms) — VMs verwenden diese Keys beim Boot.
- [Authentifizierung](/docs/authentication) — API-Keys haben damit nichts zu tun; sie sind für die Management-API, nicht für die Anmeldung an VMs.
