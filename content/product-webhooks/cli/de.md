---
title: "CLI für Webhooks"
description: "nn-webhooks — ein einzelnes statisches Binary zum Veröffentlichen von Events, Verwalten von Endpoints und Abarbeiten der Dead-Letter-Queue."
publishedAt: 2026-08-05
updatedAt: 2026-10-20
kind: cli
---

# CLI für Webhooks

`nn-webhooks` ist die Kommandozeilenschnittstelle für [Webhooks](/docs/product-webhooks). Ein statisches Binary — keine Runtime, kein virtualenv, nichts, was Sie vorher installieren müssen. Sie ist derzeit die einzige CLI von NimbusNexus; eine CLI für Infrastruktur gibt es noch nicht.

Genau deshalb ist sie in Go geschrieben. Wer um 3 Uhr nachts eine Dead-Letter-Queue abarbeitet, sitzt oft an einem Rechner, auf dem nichts installiert ist, und „erst eine Sprach-Runtime installieren“ ist in einem Incident kein akzeptabler Schritt.

## Installation {#install}

Das aktuelle Release ist **{{WEBHOOKS_CLI_VERSION}}**. Jedes Release des öffentlichen [Repositorys webhooks-go](https://github.com/NimbusNexus/webhooks-go/releases) enthält Archive für macOS, Linux und Windows auf amd64 und arm64, dazu eine `checksums.txt`, und Homebrew installiert genau diese Archive.

Unter macOS ist Homebrew der kürzeste Weg. Der Tap liefert ein Cask, und Homebrew installiert Casks nur unter macOS:

```bash
brew install nimbusnexus/tap/nn-webhooks
nn-webhooks version
```

Unter Linux oder unter macOS ohne Homebrew laden Sie das Archiv herunter, prüfen es gegen die Prüfsummen des Releases und legen das Binary in Ihren `PATH`. Setzen Sie `OS` auf `linux` oder `darwin` und `ARCH` auf `amd64` oder `arm64`:

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

Der Prüfsummen-Schritt muss für das Archiv `OK` ausgeben; brechen Sie ab, wenn er das nicht tut. Windows verwendet die Archive im Format `.zip`: Die Schritte für PowerShell finden Sie unter [CLI einrichten](/docs/setup/cli#windows).

Mit einer Go-Toolchain (1.25 oder neuer) bauen Sie die CLI stattdessen aus dem Quellcode:

```bash
go install github.com/NimbusNexus/webhooks-go/cmd/nn-webhooks@latest
```

## Anmelden {#sign-in}

```bash
nn-webhooks login         # opens your browser; approve, and the CLI is signed in
nn-webhooks whoami        # the workspace, key name, permissions and expiry
nn-webhooks logout        # revokes that key and removes the profile
```

`login` gibt einen kurzen Code aus und öffnet [{{ACCOUNT_BASE_URL}}/device]({{ACCOUNT_BASE_URL}}/device) in Ihrem Browser. Melden Sie sich wie gewohnt an, prüfen Sie, dass der Code auf der Seite mit dem in Ihrem Terminal übereinstimmt, und bestätigen Sie. Die CLI speichert dann einen API-Key mit dem Namen `nn-webhooks on <your hostname>` in ihrem Profil. Der Key ist 90 Tage gültig und wird in der Konsole unter **API keys** aufgeführt, wo Sie ihn jederzeit widerrufen können.

Ein Owner oder Admin des Workspaces bestätigt die Anfrage und kann ihre Berechtigungen einschränken (**Read & write**, **Publish** oder **Read**) oder den Key auf ein Projekt beschränken. Ein Member sieht die Anfrage, kann sie aber nicht bestätigen: Bitten Sie einen Admin darum oder [konfigurieren](#configure) Sie einen Key, den ein Admin für Sie erstellt hat.

Bestätigen Sie nur eine Anmeldung, die Sie selbst gestartet haben. Ein Code, den Ihnen jemand anderes schickt, würde dieser Person Zugriff auf Ihren Workspace geben.

Auf einem Rechner ohne Browser, etwa in einer SSH-Session oder einem Container, führen Sie `nn-webhooks login --no-browser` aus und öffnen den ausgegebenen Link auf einem beliebigen Gerät. Der Code ist 15 Minuten gültig. Eine erneute Anmeldung ersetzt den Key des Profils und widerruft den alten.

## Konfigurieren {#configure}

`configure` speichert einen Key, den Sie bereits haben, etwa einen, den ein Admin in der Konsole für CI erstellt hat:

```bash
nn-webhooks configure     # prompts for the API URL and key
nn-webhooks whoami        # what would be used, and where it came from
```

`nn-webhooks keys create` und `keys revoke` sind noch im Binary enthalten und werden in `--help` noch aufgeführt, aber die Routen `/v1/api-keys` dahinter wurden entfernt, daher schlagen beide jetzt mit `404` fehl. Erstellen Sie einen Key in Ihrer NimbusNexus-Kontokonsole unter **API keys** und wählen Sie **Webhooks** als Produkt — siehe [Zugang erhalten](/docs/product-webhooks#access). Ein Key mit `whsk_…` von vor der Umstellung authentifiziert nicht mehr; ein Profil, das noch einen solchen Key enthält, müssen Sie daher mit einem Ersatz neu konfigurieren.

Credentials liegen in `$XDG_CONFIG_HOME/nn-webhooks/credentials.json` — oder in `~/.config/nn-webhooks/credentials.json`, wenn `XDG_CONFIG_HOME` nicht gesetzt ist, was unter macOS standardmäßig der Fall ist — mit Modus `0600`, als **benannte Profile**, sodass ein zweites Deployment ein Flag ist, statt das erste zu überschreiben:

```bash
nn-webhooks --profile staging configure --url {{WEBHOOKS_BASE_URL}}
nn-webhooks --profile staging endpoints list
```

Für CI verzichten Sie ganz auf die Datei:

```bash
export NN_WEBHOOKS_URL={{WEBHOOKS_BASE_URL}}
export NN_WEBHOOKS_API_KEY="<your-api-key>"
nn-webhooks deliveries list --status dead
```

Die Rangfolge ist `--api-key`, dann `$NN_WEBHOOKS_API_KEY`, dann das Profil — und `whoami` meldet, **welche Quelle gewonnen hat**. Das ist wichtiger, als es klingt: Eine veraltete Umgebungsvariable, die das gerade geschriebene Profil stillschweigend überdeckt, ist die übliche Ursache für Verwirrung, und ein bloßes „configured“ kann das nicht erklären.

Der Key selbst wird nie ausgegeben, nur seine letzten vier Zeichen. Die Ausgabe eines Diagnosebefehls ist genau das, was in ein Support-Ticket kopiert wird.

## Befehle {#commands}

```bash
nn-webhooks publish deploy.completed --data '{"id":1}' --idempotency-key deploy-1

nn-webhooks endpoints list
nn-webhooks endpoints create --url https://example.com/hook --subscribe prefix:deploy.
nn-webhooks endpoints get ep_123
nn-webhooks endpoints update ep_123 --set max_attempts=10 --set status=disabled
nn-webhooks endpoints replace-subscriptions ep_123 --subscribe exact:deploy.completed --subscribe suffix:.failed
nn-webhooks endpoints rotate-secret ep_123
nn-webhooks endpoints enable ep_123

nn-webhooks deliveries list --status dead
nn-webhooks deliveries redeliver dlv_456

nn-webhooks verify --secret whsec_... --signature sha256=... --timestamp 1785984800 < body.json
```

Abos werden als `kind:pattern` angegeben, wiederholbar — `--subscribe prefix:deploy.` oder
`--subscribe exact:deploy.completed`. An `--set` übergebene Werte werden als JSON interpretiert, ersatzweise als
String, und `null` leert ein Feld.

`update` kann keine Abos ändern, weil webhookd sie bei einem PATCH ignoriert: `replace-subscriptions` setzt die ganze Liste auf einmal und ersetzt, was vorher da war, und `--none` meldet den Endpoint von allen Abos ab.

Alles wird als JSON ausgegeben, sodass Sie es an `jq` weiterleiten können, ohne sich ein Flag wie `--format` merken zu müssen:

```bash
nn-webhooks deliveries list --status dead | jq -r '.items[].id' | \
  xargs -n1 nn-webhooks deliveries redeliver
```

`nn-webhooks verify` prüft einen empfangenen Webhook — nützlich, um zu bestätigen, dass ein Handler wegen der Signatur ablehnt und nicht wegen der Body-Verarbeitung des Frameworks, die häufiger die Ursache ist. Übergeben Sie `--timestamp`: Ohne den Timestamp wird der HMAC nur über den Body berechnet, was nie zu einer echten Zustellung passt, daher schlägt jede Prüfung fehl. Der Befehl gibt `ok`/`failed` statt JSON aus und endet mit dem Exit-Code 0/1.

## Versionen {#versions}

```bash
nn-webhooks version
```

Es werden zwei Nummern gemeldet, und sie können sich zu Recht unterscheiden:

- `version` — das Release, aus dem dieses Binary stammt, beim Build eingetragen
- `sdk` — die Client-Bibliothek, die einkompiliert ist

Ein aus dem Quellcode gebautes Binary hat keinen Tag, den es nennen könnte, daher meldet es die SDK-Version mit dem Suffix `+source`, statt sich als Release auszugeben.

## Nächste Schritte {#next-steps}

- [SDKs](/docs/product-webhooks/sdks) — dieselben Operationen aus Anwendungscode.
- [Schnellstart](/docs/product-webhooks/quickstart) — der Ablauf, den diese Befehle automatisieren.
- [Signaturprüfung](/docs/product-webhooks/signatures) — was `nn-webhooks verify` prüft.
- [Überblick über Webhooks](/docs/product-webhooks) — Objekte und Zustellsemantik.
