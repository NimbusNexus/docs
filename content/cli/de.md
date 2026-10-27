---
title: "CLI"
description: "nimbus — die Kommandozeilenschnittstelle für die REST-API von NimbusNexus."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: cli
---

# CLI

> **Status: Vorabversion.** Die CLI befindet sich in aktiver Entwicklung. Diese Seite beschreibt den Stand von v1.0; bis das Binary veröffentlicht ist, verwenden Sie die REST-API direkt, wie unter [Authentifizierung](/docs/authentication) und [Konventionen](/docs/conventions) beschrieben.

`nimbus` ist die offizielle Kommandozeilenschnittstelle. Ein einzelnes statisches Binary ohne Laufzeitabhängigkeiten, verfügbar für macOS (Intel + Apple Silicon), Linux (amd64 + arm64) und Windows.

> **Sie suchen `nn-webhooks`?** Das ist die CLI für das separate [Produkt Webhooks](/docs/product-webhooks) — ein anderes Binary, bereits veröffentlicht und unter [CLI für Webhooks](/docs/product-webhooks/cli) dokumentiert. Diese Seite behandelt `nimbus`, die CLI der Cloud-Plattform.

## Installation (nach Veröffentlichung) {#install}

```bash
# macOS / Linux — Homebrew
brew install nimbusnexus/tap/nimbus

# Linux — curl + install
curl -fsSL {{BASE_URL}}/cli/install.sh | sh

# Verify
nimbus --version
```

Das Installationsskript lädt ein signiertes Binary für Ihre Plattform herunter, prüft die Signatur mit unserem veröffentlichten öffentlichen Schlüssel und installiert es nach `/usr/local/bin/nimbus`. Lesen Sie das Skript, bevor Sie es an `sh` weiterleiten, wenn Sie lieber zuerst verstehen möchten, was es tut.

## Authentifizieren {#auth}

```bash
nimbus auth login
# Opens a browser window, exchanges for an API key, stores it in your OS keychain.

# Or set an existing key directly:
export NIMBUS_KEY=nn_live_...
```

Der Ablauf von `auth login` generiert einen Key mit Starter-Scope, der an den aktuell im Dashboard angemeldeten Benutzer gebunden ist. Für CI / Automatisierung generieren Sie im Dashboard einen langlebigen Key und legen ihn in `NIMBUS_KEY` ab.

## Häufige Befehle {#common}

```bash
# Resources mirror the REST API structure
nimbus vms list --region us-east-1
nimbus vms create --name web-01 --size gp-1-2 --region us-east-1 --image ubuntu-24.04
nimbus vms get vm_01HG7Y3...
nimbus vms delete vm_01HG7Y3...

# Databases
nimbus databases list
nimbus databases create --engine postgres --tier production-2x4 --region us-east-1

# Object storage
nimbus buckets list
nimbus buckets create my-bucket --region us-east-1
nimbus buckets cp ./file.txt nn://my-bucket/file.txt

# DNS
nimbus dns zones create example.com
nimbus dns records create example.com A www 203.0.113.5

# Floating IPs
nimbus floating-ips allocate --region us-east-1
nimbus floating-ips attach ip_01H... --to vm_01HG7Y3...
```

Jeder Ressourcentyp hat mindestens `list`, `get`, `create`, `delete`, dazu typspezifische Befehle (z. B. `vms reboot`, `databases restore`, `dns records bulk-import`).

## Ausgabeformate {#output}

```bash
# Human-readable table (default for terminals)
nimbus vms list

# JSON for scripting
nimbus vms list --output json

# JSONL (newline-delimited, good for piping)
nimbus vms list --output jsonl | jq -r '.id'

# Just the IDs
nimbus vms list --output ids
```

`--output json` gibt die rohe API-Antwort zurück. `--output ids` ist eine Abkürzung für das häufige Muster „gib mir die IDs, damit ich sie an einen anderen Befehl weiterleiten kann“.

## Konfiguration + Profile {#config}

`nimbus` liest die Konfiguration aus `~/.config/nimbus/config.toml` (Linux/macOS) oder `%APPDATA%\nimbus\config.toml` (Windows). Mehrere Profile für verschiedene Projekte:

```toml
default_profile = "prod"

[profiles.prod]
api_key_keychain = "nimbus-prod"  # OS keychain reference
default_region = "us-east-1"

[profiles.staging]
api_key_keychain = "nimbus-staging"
default_region = "us-west-1"
```

Wechseln Sie das Profil pro Befehl:

```bash
nimbus --profile staging vms list
```

Oder pro Shell-Session:

```bash
export NIMBUS_PROFILE=staging
nimbus vms list
```

Das Feld `api_key_keychain` verweist auf einen Eintrag im Schlüsselbund des Betriebssystems; der Key selbst steht nie in der Konfigurationsdatei. Für CI / nicht interaktive Systeme setzen Sie `NIMBUS_KEY` direkt.

## Muster für Skripte {#scripting}

```bash
# Wait for a VM to be running
nimbus vms wait $VM_ID --state running --timeout 5m

# Bulk operations from a file
nimbus vms create --from-file vms.yaml

# Pipe IDs into deletion (with confirmation)
nimbus vms list --output ids --filter "state=stopped" | nimbus vms delete --stdin --yes

# Tail audit logs
nimbus audit-logs tail --project my-project
```

`wait` blockiert, bis eine Ressource den angeforderten Zustand erreicht (oder das Timeout abläuft). `--stdin` liest IDs von stdin. `--yes` überspringt Bestätigungsabfragen (nur in Skripten verwenden, bei denen Sie sicher sind).

## Shell-Vervollständigung {#completion}

```bash
# Bash
nimbus completion bash > /etc/bash_completion.d/nimbus

# Zsh
nimbus completion zsh > "${fpath[1]}/_nimbus"

# Fish
nimbus completion fish > ~/.config/fish/completions/nimbus.fish

# PowerShell
nimbus completion powershell | Out-String | Invoke-Expression
```

Die Vervollständigung umfasst Ressourcen-IDs (aus zwischengespeicherten, kürzlich ausgeführten List-Aufrufen), Regionen, Größen, Image-Namen und jeden Befehl/Unterbefehl.

## Aktueller Stand {#status}

Die CLI entsteht auf Basis des Go-SDK, ist aber noch nicht veröffentlicht. Bis dahin:

- Verwenden Sie die REST-API direkt. Jeder CLI-Befehl entspricht 1:1 einem API-Aufruf.
- Der Aufbau auf dieser Seite ist das API-Design, auf das wir uns festlegen.
- Abonnieren Sie den [Changelog]({{BASE_URL}}/changelog), um die Ankündigung der Veröffentlichung zu erhalten.

## Nächste Schritte {#next-steps}

- [Authentifizierung](/docs/authentication) — was `auth login` im Hintergrund tut.
- [Go-SDK](/docs/sdks/go) — das SDK, auf dem die CLI aufbaut.
- [Plattform-Webhooks](/docs/webhooks) — `nimbus webhooks endpoints` verwaltet sie über die Kommandozeile.
