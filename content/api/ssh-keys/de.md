---
title: "SSH-Keys"
description: "Öffentliche Schlüssel, die unter Ihrem Benutzer registriert und beim Boot in einer VM installiert werden."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# SSH-Keys

Mit SSH-Keys melden Sie sich an Linux-VMs an, nachdem sie gebootet haben. Registrieren Sie einen Key unter Ihrem Benutzer und geben Sie ihn dann in `sshs` an, wenn Sie eine VM erstellen; cloud-init schreibt ihn in die Datei `~/.ssh/authorized_keys` des Standardbenutzers.

## So funktioniert es {#how-it-works}

Es gibt zwei Wege, einen Key zu registrieren:

- `POST /api/v1/ssh/add_public` mit einem `name` und Ihrem `ssh_public_key`. Sie senden nur den **öffentlichen** Schlüssel; der private Schlüssel bleibt bei Ihnen.
- `POST /api/v1/ssh/` mit einem `name` erzeugt ein Schlüsselpaar und gibt seinen `private_key` einmal zurück. Speichern Sie ihn sofort: Die API zeigt ihn nie wieder an.

Eine VM erhält den einen Key, den Sie beim Erstellen in `sshs` angeben. Beim Boot stellt der Metadatendienst cloud-init diesen öffentlichen Schlüssel bereit, und cloud-init schreibt ihn in die Datei authorized_keys des Standardbenutzers.

Keys, die Sie **nach** dem Boot einer VM hinzufügen, werden nicht automatisch an laufende VMs übertragen. Eine VM behält den Key, mit dem sie erstellt wurde; fügen Sie einen neuen Key deshalb in der VM mit Ihrem üblichen Konfigurationsmanagement hinzu.

## Unterstützte Formate {#formats}

Der Key-String muss im OpenSSH-Format vorliegen — die einzelne Zeile, die mit `ssh-ed25519`, `ecdsa-sha2-nistp...` oder `ssh-rsa` beginnt, gefolgt vom base64-kodierten Schlüsselmaterial und optional einem Kommentar. Genau das enthalten die Dateien `~/.ssh/id_*.pub` standardmäßig.

## Fingerprints + Duplikate {#fingerprints}

Jeder Key hat einen stabilen **SHA256-Fingerprint**. `GET /api/v1/ssh/` listet Ihre Keys mit ihrem `fingerprint` und dem öffentlichen `key` auf. Key-Namen müssen unter Ihren Keys eindeutig sein: Registrieren Sie einen zweiten Key unter einem Namen, den Sie bereits verwenden, antwortet die API mit `409`.

## Key entfernen {#removing}

`DELETE /api/v1/ssh/` mit der ID des Keys in `ssh_keys` löscht ihn, sodass neue VMs ihn nicht verwenden können. **Bereits gebootete VMs behalten den Key** in ihrer Datei authorized_keys — cloud-init gleicht keinen Zustand ab, sondern installiert nur beim ersten Boot. Um einen Key auf laufenden VMs zu widerrufen, können Sie entweder:

1. Die VMs mit einem anderen Key in `sshs` neu erstellen oder
2. `~/.ssh/authorized_keys` direkt in der VM bearbeiten (oder über Ihr Konfigurationsmanagement).

## Nächste Schritte {#next-steps}

- [Virtuelle Maschinen](/docs/api/vms) — VMs verwenden diese Keys beim Boot.
- [Authentifizierung](/docs/authentication) — API-Keys sind für die Management-API, nicht für die Anmeldung an VMs. Die SSH-Key-Endpoints brauchen eine angemeldete Sitzung, keinen API-Key.
