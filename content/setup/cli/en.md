---
title: Set up the CLI
description: Install nn-webhooks with Homebrew, a verified download or go install, configure an API key, and make a first call.
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: cli
---

# Set up the CLI

`nn-webhooks` is the command-line tool for [Webhooks](/docs/product-webhooks): one static binary for macOS, Linux and Windows, with nothing else to install. It publishes events, manages endpoints and redelivers failed deliveries. It is the only NimbusNexus CLI today. A CLI for Infrastructure is not available yet; use the [REST API](/docs/setup/rest) instead.

The current release is **{{WEBHOOKS_CLI_VERSION}}**. Its archives and their `checksums.txt` are attached to each release of the public [webhooks-go repository](https://github.com/NimbusNexus/webhooks-go/releases), and Homebrew installs the same archives.

## 1 · Install {#install}

### macOS: Homebrew {#homebrew}

```bash
brew install nimbusnexus/tap/nn-webhooks
nn-webhooks version
```

The tap ships a cask, and Homebrew installs casks only on macOS. Upgrade later with `brew upgrade nn-webhooks`.

### Linux and macOS: download {#download}

Set `OS` to `linux` or `darwin` and `ARCH` to `amd64` or `arm64`. Then download the archive, check it against the release's checksums, and put the binary on your `PATH`:

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

The checksum step must print `OK` for the archive; stop there if it does not. Where `shasum` is missing, `sha256sum --check --ignore-missing checksums.txt` does the same. Without `sudo`, install into a directory you own that is on your `PATH`, for example `~/.local/bin`.

### Windows: download {#windows}

In PowerShell, download the zip, compare its hash with the matching line of `checksums.txt`, then unpack it into a folder on your `PATH`:

```powershell
$Version = "{{WEBHOOKS_CLI_VERSION}}"
$Base = "https://github.com/NimbusNexus/webhooks-go/releases/download/v$Version"
Invoke-WebRequest "$Base/nn-webhooks_${Version}_windows_amd64.zip" -OutFile nn-webhooks.zip
Invoke-WebRequest "$Base/checksums.txt" -OutFile checksums.txt
(Get-FileHash nn-webhooks.zip -Algorithm SHA256).Hash.ToLower()
Select-String "windows_amd64.zip" checksums.txt
Expand-Archive nn-webhooks.zip -DestinationPath "$env:LOCALAPPDATA\nn-webhooks"
```

The two hashes must match. Then add `%LOCALAPPDATA%\nn-webhooks` to your `PATH` and run `nn-webhooks version`. On ARM, use `windows_arm64` in both file names.

### With a Go toolchain {#go-install}

```bash
go install github.com/NimbusNexus/webhooks-go/cmd/nn-webhooks@latest
```

This needs Go 1.25 or later. A binary built from source reports its SDK version with a `+source` suffix rather than a release number.

## 2 · Configure a key {#configure}

Create a Webhooks key in your [account console]({{ACCOUNT_BASE_URL}}/api-keys) under **API keys**; [Get an API key](/docs/setup/rest#key) has the details. Then save it to a profile:

```bash
nn-webhooks configure --url {{WEBHOOKS_BASE_URL}}
nn-webhooks whoami
```

`configure` prompts for the key and stores it in `~/.config/nn-webhooks/credentials.json` with mode `0600`. `whoami` shows which URL and key would be used, and where each came from; it prints only the key's last four characters. In CI, skip the file and set the environment instead:

```bash
export NN_WEBHOOKS_URL={{WEBHOOKS_BASE_URL}}
export NN_WEBHOOKS_API_KEY="<your-api-key>"
```

## 3 · Make a first call {#first-call}

```bash
nn-webhooks deliveries list
```

Every command prints JSON, so it pipes straight into `jq`. An empty `items` list means the key works and nothing has been delivered yet.

## What's next {#next-steps}

- [Webhooks CLI](/docs/product-webhooks/cli): every command, profiles, precedence and versions.
- [Webhooks API reference](/docs/reference/webhooks): each operation with its `nn-webhooks` command where there is one.
- [SDKs](/docs/setup/sdk): the same operations from code.
