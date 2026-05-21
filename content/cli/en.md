---
title: CLI
description: nimbus — the command-line interface for the NimbusNexus REST API.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: cli
---

# CLI

> **Status: pre-release.** The CLI is in active development. This page documents the v1.0 shape; until the binary is published, use the REST API directly per [Authentication](/docs/authentication) and [Conventions](/docs/conventions).

`nimbus` is the official command-line interface. A single static binary, no runtime dependencies, available for macOS (Intel + Apple Silicon), Linux (amd64 + arm64), and Windows.

## Install (when shipped) {#install}

```bash
# macOS / Linux — Homebrew
brew install nimbusnexus/tap/nimbus

# Linux — curl + install
curl -fsSL {{BASE_URL}}/cli/install.sh | sh

# Verify
nimbus --version
```

The install script downloads a signed binary for your platform, verifies the signature against our published public key, and installs to `/usr/local/bin/nimbus`. Read the script before piping to `sh` if you'd rather understand what it does first.

## Authenticate {#auth}

```bash
nimbus auth login
# Opens a browser window, exchanges for an API key, stores it in your OS keychain.

# Or set an existing key directly:
export NIMBUS_KEY=nn_live_...
```

The `auth login` flow generates a starter-scope key tied to the currently signed-in dashboard user. For CI / automation, generate a long-lived key in the dashboard and put it in `NIMBUS_KEY`.

## Common commands {#common}

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

Every resource type has `list`, `get`, `create`, `delete` at minimum, plus type-specific commands (e.g. `vms reboot`, `databases restore`, `dns records bulk-import`).

## Output formats {#output}

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

`--output json` returns the raw API response. `--output ids` is a shortcut for the common "give me the IDs to pipe to another command" pattern.

## Config + profiles {#config}

`nimbus` reads config from `~/.config/nimbus/config.toml` (Linux/macOS) or `%APPDATA%\nimbus\config.toml` (Windows). Multiple profiles for different projects:

```toml
default_profile = "prod"

[profiles.prod]
api_key_keychain = "nimbus-prod"  # OS keychain reference
default_region = "us-east-1"

[profiles.staging]
api_key_keychain = "nimbus-staging"
default_region = "us-west-1"
```

Switch profiles per command:

```bash
nimbus --profile staging vms list
```

Or per shell session:

```bash
export NIMBUS_PROFILE=staging
nimbus vms list
```

The `api_key_keychain` field references an OS keychain entry; the raw key never lives in the config file. For CI / non-interactive systems, set `NIMBUS_KEY` directly.

## Scripting patterns {#scripting}

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

`wait` blocks until a resource reaches the requested state (or times out). `--stdin` reads IDs from stdin. `--yes` skips confirmation prompts (use only in scripts where you're sure).

## Shell completion {#completion}

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

Completion handles resource IDs (autocompletes from cached recent list calls), regions, sizes, image names, and every command/subcommand.

## Where it stands today {#status}

The CLI is being built on top of the Go SDK but hasn't shipped yet. While you wait:

- Use the REST API directly. Every CLI command corresponds 1:1 to an API call.
- The shape on this page is the API design we're committing to.
- Subscribe to the [changelog]({{BASE_URL}}/changelog) for the release announcement.

## What's next {#next-steps}

- [Authentication](/docs/authentication) — what `auth login` is doing under the hood.
- [Go SDK](/docs/sdks/go) — the SDK the CLI is built on.
- [Webhooks](/docs/webhooks) — `nimbus webhooks endpoints` manages these from the command line.
