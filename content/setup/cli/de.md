---
title: "CLI einrichten"
description: "nn-webhooks mit Homebrew, einem geprüften Download oder go install installieren, einen API-Key konfigurieren und den ersten Aufruf senden."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: cli
---

# CLI einrichten

`nn-webhooks` ist das Kommandozeilentool für [Webhooks](/docs/product-webhooks): ein einzelnes statisches Binary für macOS, Linux und Windows, ohne dass Sie sonst etwas installieren müssen. Es veröffentlicht Events, verwaltet Endpoints und stellt fehlgeschlagene Zustellungen erneut zu. Es ist derzeit die einzige CLI von NimbusNexus. Eine CLI für Infrastruktur gibt es noch nicht; verwenden Sie stattdessen die [REST-API](/docs/setup/rest).

Das aktuelle Release ist **{{WEBHOOKS_CLI_VERSION}}**. Die Archive und ihre `checksums.txt` hängen an jedem Release des öffentlichen [Repositorys webhooks-go](https://github.com/NimbusNexus/webhooks-go/releases), und Homebrew installiert dieselben Archive.

## 1 · Installation {#install}

### macOS: Homebrew {#homebrew}

```bash
brew install nimbusnexus/tap/nn-webhooks
nn-webhooks version
```

Der Tap liefert ein Cask, und Homebrew installiert Casks nur unter macOS. Aktualisieren Sie später mit `brew upgrade nn-webhooks`.

### Linux und macOS: Download {#download}

Setzen Sie `OS` auf `linux` oder `darwin` und `ARCH` auf `amd64` oder `arm64`. Laden Sie dann das Archiv herunter, prüfen Sie es gegen die Prüfsummen des Releases und legen Sie das Binary in Ihren `PATH`:

```bash
VERSION={{WEBHOOKS_CLI_VERSION}}
OS=linux
ARCH=amd64
BASE=https://github.com/NimbusNexus/webhooks-go/releases/download/v$VERSION
curl -fsSLO "$BASE/nn-webhooks_${VERSION}_${OS}_${ARCH}.tar.gz"
curl -fsSLO "$BASE/checksums.txt"
shasum -a 256 --check --ignore-missing checksums.txt
tar -xzf "nn-webhooks_${VERSION}_${OS}_${ARCH}.tar.gz" nn-webhooks
sudo install -m 0755 nn-webhooks /usr/local/bin/nn-webhooks
nn-webhooks version
```

Der Schritt mit der Prüfsumme muss für das Archiv `OK` ausgeben; brechen Sie ab, wenn das nicht der Fall ist. Wo `shasum` fehlt, macht `sha256sum --check --ignore-missing checksums.txt` dasselbe. Ohne `sudo` installieren Sie in ein Verzeichnis, das Ihnen gehört und in Ihrem `PATH` liegt, zum Beispiel `~/.local/bin`.

### Windows: Download {#windows}

Laden Sie in PowerShell das Zip herunter, vergleichen Sie seinen Hash mit der passenden Zeile von `checksums.txt` und entpacken Sie es dann in einen Ordner in Ihrem `PATH`:

```powershell
$Version = "{{WEBHOOKS_CLI_VERSION}}"
$Base = "https://github.com/NimbusNexus/webhooks-go/releases/download/v$Version"
Invoke-WebRequest "$Base/nn-webhooks_${Version}_windows_amd64.zip" -OutFile nn-webhooks.zip
Invoke-WebRequest "$Base/checksums.txt" -OutFile checksums.txt
(Get-FileHash nn-webhooks.zip -Algorithm SHA256).Hash.ToLower()
Select-String "windows_amd64.zip" checksums.txt
Expand-Archive nn-webhooks.zip -DestinationPath "$env:LOCALAPPDATA\nn-webhooks"
```

Die beiden Hashes müssen übereinstimmen. Fügen Sie dann `%LOCALAPPDATA%\nn-webhooks` zu Ihrem `PATH` hinzu und führen Sie `nn-webhooks version` aus. Unter ARM verwenden Sie `windows_arm64` in beiden Dateinamen.

### Mit einer Go-Toolchain {#go-install}

```bash
go install github.com/NimbusNexus/webhooks-go/cmd/nn-webhooks@latest
```

Dafür brauchen Sie Go 1.25 oder neuer. Ein aus dem Quellcode gebautes Binary meldet seine SDK-Version mit dem Suffix `+source` statt mit einer Release-Nummer.

## 2 · Key konfigurieren {#configure}

Auf Ihrem eigenen Rechner melden Sie sich über den Browser an:

```bash
nn-webhooks login
```

Der Befehl gibt einen Code aus und öffnet Ihre Kontokonsole. Prüfen Sie dort, ob der Code übereinstimmt, und genehmigen Sie dann die Anfrage; die CLI speichert einen Key mit 90 Tagen Laufzeit in ihrem Profil. Details finden Sie unter [Anmelden](/docs/product-webhooks/cli#sign-in).

Wenn Sie stattdessen einen Key verwenden wollen, den Sie bereits haben, etwa einen für die CI, erstellen Sie einen Webhooks-Key in Ihrer [Kontokonsole]({{ACCOUNT_BASE_URL}}/api-keys) unter **API keys**; Details finden Sie unter [API-Key erstellen](/docs/setup/rest#key). Speichern Sie ihn dann in einem Profil:

```bash
nn-webhooks configure --url {{WEBHOOKS_BASE_URL}}
nn-webhooks whoami
```

`configure` fragt nach dem Key und speichert ihn mit dem Modus `0600` in `~/.config/nn-webhooks/credentials.json`. `whoami` zeigt, welche URL und welcher Key verwendet würden und woher beide jeweils stammen; vom Key gibt es nur die letzten vier Zeichen aus. In der CI lassen Sie die Datei weg und setzen stattdessen Umgebungsvariablen:

```bash
export NN_WEBHOOKS_URL={{WEBHOOKS_BASE_URL}}
export NN_WEBHOOKS_API_KEY="<your-api-key>"
```

## 3 · Ersten Aufruf senden {#first-call}

```bash
nn-webhooks deliveries list
```

Jeder Befehl gibt JSON aus, sodass Sie die Ausgabe direkt an `jq` weiterleiten können. Eine leere Liste `items` bedeutet, dass der Key funktioniert und noch nichts zugestellt wurde.

## Nächste Schritte {#next-steps}

- [CLI für Webhooks](/docs/product-webhooks/cli): alle Befehle, Profile, Rangfolge und Versionen.
- [Referenz für die Webhooks-API](/docs/reference/webhooks): jede Operation mit ihrem Befehl in `nn-webhooks`, sofern es einen gibt.
- [SDKs](/docs/setup/sdk): dieselben Operationen aus Ihrem Code.
