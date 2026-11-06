---
title: CLI
description: nn-example — the command-line interface for the Example API.
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: cli
---

<!-- TEMPLATE — copy this file before editing. Delete this comment when you do.

  The CLI page documents a command-line tool. Each CLI is its own
  binary, named for its product; `nn-webhooks` is the one that ships
  today (see /docs/product-webhooks/cli). This template captures that
  shape, with `nn-example` standing in for the real name.

  Length target: 800–1,400 words.

  Body structure:
    - Status banner (pre-release / GA / deprecated) as a > blockquote.
    - Short intro paragraph.
    - Install section. Multiple paths (Homebrew, verified download,
      go install) — let the reader pick.
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

A short paragraph describing the CLI — what it does, what platforms it targets, where it comes from. Two or three sentences.

## Install {#install}

```bash
# Homebrew (macOS)
brew install nimbusnexus/tap/nn-example

# Verify
nn-example version
```

Brief note on what else there is, such as a download checked against the release's checksums, and how to verify it.

## Authenticate {#auth}

```bash
# Interactive — opens a browser and saves a key to a profile
nn-example login

# Non-interactive — set an env var directly
export EXAMPLE_API_KEY="<your-api-key>"
```

One paragraph on when to use which.

## Common commands {#common}

```bash
# Resources mirror the REST API
nn-example items list
nn-example items create --name first-item
nn-example items get <item-id>
nn-example items delete <item-id>

# (a dozen lines of the most common commands across resource groups)
```

Brief comment: "Every resource has `list`, `get`, `create`, `delete` at minimum, plus type-specific commands."

## Output formats {#output}

```bash
# Default — table for terminals
nn-example items list

# JSON for scripting
nn-example items list --output json

# JSONL for piping
nn-example items list --output jsonl | jq -r '.id'

# Just the IDs
nn-example items list --output ids
```

## Config + profiles {#config}

Brief explanation of where config lives + a TOML example showing two profiles + how to switch.

## Scripting patterns {#scripting}

```bash
# Pattern 1: wait for state
nn-example items wait <item-id> --state ready --timeout 5m

# Pattern 2: bulk from file
nn-example items create --from-file items.yaml

# Pattern 3: stdin pipeline
nn-example items list --output ids | nn-example items delete --stdin --yes
```

One paragraph framing each pattern.

## Shell completion {#completion}

```bash
# Bash, Zsh, Fish, PowerShell — one command per shell
```

## Where it stands today {#status}

Honest about ship state: what's published, what's in design, where to follow for release announcements.

## What's next {#next-steps}

- [Authentication](/docs/authentication) — what `login` is doing under the hood.
- [Relevant SDK page](/docs/setup/sdk) — the SDK the CLI is built on.
- [Set up the REST API](/docs/setup/rest) — the same calls without the CLI.
