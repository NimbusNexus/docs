---
title: Webhooks CLI
description: nn-webhooks — a single static binary for publishing events, managing endpoints, and draining the dead-letter queue.
publishedAt: 2026-08-05
updatedAt: 2026-08-05
kind: cli
---

# Webhooks CLI

`nn-webhooks` is the command-line interface for [NimbusNexus Webhooks](/docs/product-webhooks). One static binary — no runtime, no virtualenv, nothing to install first.

That is the whole reason it is written in Go. An operator draining a dead-letter queue at 3am is often on a box that has nothing on it, and "first install a language runtime" is not an acceptable step in an incident.

## Install {#install}

```bash
# macOS / Linux
brew install nimbusnexus/tap/nn-webhooks
```

```bash
# any platform — archives and checksums.txt are attached to each release
curl -sSLO https://github.com/NimbusNexus/webhooks-go/releases/download/v0.5.1/nn-webhooks_0.5.1_linux_amd64.tar.gz
```

```bash
# with a Go toolchain
go install github.com/NimbusNexus/webhooks-go/cmd/nn-webhooks@latest
```

## Configure {#configure}

```bash
nn-webhooks configure     # prompts for the API URL and key
nn-webhooks whoami        # what would be used, and where it came from
```

Credentials live in `$XDG_CONFIG_HOME/nn-webhooks/credentials.json`, mode `0600`, as **named profiles** — so a second deployment is a flag rather than overwriting the first:

```bash
nn-webhooks --profile staging configure --url {{WEBHOOKS_BASE_URL}}
nn-webhooks --profile staging endpoints list
```

For CI, skip the file entirely:

```bash
export NN_WEBHOOKS_URL={{WEBHOOKS_BASE_URL}}
export NN_WEBHOOKS_API_KEY=whsk_...
nn-webhooks deliveries --status dead
```

Precedence is `--api-key`, then `$NN_WEBHOOKS_API_KEY`, then the profile — and `whoami` reports **which one won**. That matters more than it sounds: a stale environment variable silently shadowing the profile you just wrote is the usual confusion, and a bare "configured" cannot explain it.

The key itself is never printed, only its last four characters. The output of a diagnostic command is exactly what gets pasted into a support ticket.

## Commands {#commands}

```bash
nn-webhooks publish deploy.completed --data '{"id":1}' --idempotency-key deploy-1

nn-webhooks endpoints list
nn-webhooks endpoints create --url https://example.com/hook --subscribe prefix:deploy.
nn-webhooks endpoints get ep_123
nn-webhooks endpoints update ep_123 --set max_attempts=10 --set status=disabled
nn-webhooks endpoints rotate-secret ep_123
nn-webhooks endpoints enable ep_123

nn-webhooks deliveries list --status dead
nn-webhooks deliveries redeliver dlv_456

nn-webhooks keys create --name ci --scope publish

nn-webhooks verify --secret whsec_... --signature sha256=... < body.json
```

Subscriptions are given as `kind:pattern`, repeatable — `--subscribe prefix:deploy.` or
`--subscribe exact:deploy.completed`. Values passed to `--set` are JSON-coerced, falling back to a
string, and `null` clears a field.

Everything prints JSON, so it pipes into `jq` without a `--format` flag to remember:

```bash
nn-webhooks deliveries list --status dead | jq -r '.items[].id' | \
  xargs -n1 nn-webhooks deliveries redeliver
```

`nn-webhooks verify` checks a webhook you received — useful for confirming a handler's rejection is the signature and not the framework's body handling, which is the more common culprit.

## Versions {#versions}

```bash
nn-webhooks version
```

Two numbers are reported, and they can legitimately differ:

- `version` — the release this binary came from, stamped at build time
- `sdk` — the client library compiled into it

A binary built from source has no tag to name, so it reports the SDK version with a `+source` suffix rather than claiming to be a release.

## What's next {#next-steps}

- [SDKs](/docs/product-webhooks/sdks) — the same operations from application code.
- [Quickstart](/docs/product-webhooks/quickstart) — the flow these commands automate.
- [Signature verification](/docs/product-webhooks/signatures) — what `nn-webhooks verify` checks.
- [Webhooks (product)](/docs/product-webhooks) — objects and delivery semantics.
