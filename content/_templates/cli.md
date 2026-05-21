---
title: CLI
description: nimbus — the command-line interface for the NimbusNexus REST API.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: cli
---

<!-- TEMPLATE — copy this file before editing. Delete this comment when you do.

  The CLI page documents the command-line interface. There's typically
  one CLI (the official `nimbus` binary); this template captures that
  shape. If a separate CLI ever ships for a niche purpose, copy this
  template and adapt.

  Length target: 800–1,400 words.

  Body structure:
    - Status banner (pre-release / GA / deprecated) as a > blockquote.
    - Short intro paragraph.
    - Install section. Multiple paths (Homebrew, curl install, raw
      download) — let the reader pick.
    - Authenticate section. Both the browser flow and the env-var
      flow for non-interactive systems.
    - Common commands. The dozen most-used commands with one-liner
      explanations. Resource groups mirror the REST API.
    - Output formats. Table (default), JSON, JSONL, ids. Examples.
    - Config + profiles. How to switch between projects/environments.
    - Scripting patterns. The two or three patterns power users
      actually use: wait-for-state, bulk operations from a file,
      stdin pipelines.
    - Shell completion install commands per shell.
    - "Where it stands today" section. Honest about what's shipped.
    - "What's next" cross-links.

  Tone: imperative, command-focused. Power users will skim for the
  command they need — make commands easy to scan and copy.

-->

# CLI

> **Status: pre-release / GA / deprecated.** One sentence on current state. If pre-release, mention what to use in the meantime.

A short paragraph describing the CLI — what it does, what platforms it targets, where it comes from (e.g. "built on top of the Go SDK"). Two or three sentences.

## Install {#install}

```bash
# Homebrew (macOS / Linux)
brew install nimbusnexus/tap/nimbus

# curl install script (Linux, manual platforms)
curl -fsSL {{BASE_URL}}/cli/install.sh | sh

# Verify
nimbus --version
```

Brief note on what the install script does + signature verification approach.

## Authenticate {#auth}

```bash
# Interactive — opens a browser, stores key in OS keychain
nimbus auth login

# Non-interactive — set env var directly
export NIMBUS_KEY=nn_live_...
```

One paragraph on when to use which.

## Common commands {#common}

```bash
# Resources mirror the REST API
nimbus vms list --region us-east-1
nimbus vms create --name web-01 --size gp-1-2 --region us-east-1 --image ubuntu-24.04
nimbus vms get vm_01HG7Y3...
nimbus vms delete vm_01HG7Y3...

# (a dozen lines of the most common commands across resource groups)
```

Brief comment: "Every resource has `list`, `get`, `create`, `delete` at minimum, plus type-specific commands."

## Output formats {#output}

```bash
# Default — table for terminals
nimbus vms list

# JSON for scripting
nimbus vms list --output json

# JSONL for piping
nimbus vms list --output jsonl | jq -r '.id'

# Just the IDs
nimbus vms list --output ids
```

## Config + profiles {#config}

Brief explanation of where config lives + a TOML example showing two profiles + how to switch.

## Scripting patterns {#scripting}

```bash
# Pattern 1: wait for state
nimbus vms wait $VM_ID --state running --timeout 5m

# Pattern 2: bulk from file
nimbus vms create --from-file vms.yaml

# Pattern 3: stdin pipeline
nimbus vms list --output ids --filter "state=stopped" | nimbus vms delete --stdin --yes
```

One paragraph framing each pattern.

## Shell completion {#completion}

```bash
# Bash, Zsh, Fish, PowerShell — one command per shell
```

## Where it stands today {#status}

Honest about ship state: what's published, what's in design, where to follow for release announcements.

## What's next {#next-steps}

- [Authentication](/docs/authentication) — what `auth login` is doing under the hood.
- [Relevant SDK page](/docs/sdks/go) — the SDK the CLI is built on.
- [Webhooks](/docs/webhooks) — `nimbus webhooks endpoints` manages these from the command line.
