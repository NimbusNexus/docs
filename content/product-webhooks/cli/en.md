---
title: Webhooks CLI
description: nn-webhooks — a single static binary for publishing events, managing endpoints, and draining the dead-letter queue.
publishedAt: 2026-08-05
updatedAt: 2026-10-20
kind: cli
---

# Webhooks CLI

`nn-webhooks` is the command-line interface for [NimbusNexus Webhooks](/docs/product-webhooks). One static binary — no runtime, no virtualenv, nothing to install first. It is the only NimbusNexus CLI today; a CLI for Infrastructure is not available yet.

That is the whole reason it is written in Go. An operator draining a dead-letter queue at 3am is often on a box that has nothing on it, and "first install a language runtime" is not an acceptable step in an incident.

## Install {#install}

The current release is **{{WEBHOOKS_CLI_VERSION}}**. Each release of the public [webhooks-go repository](https://github.com/NimbusNexus/webhooks-go/releases) carries archives for macOS, Linux and Windows on amd64 and arm64, with a `checksums.txt`, and Homebrew installs those same archives.

On macOS, Homebrew is the shortest path. The tap ships a cask, and Homebrew installs casks only on macOS:

```bash
brew install nimbusnexus/tap/nn-webhooks
nn-webhooks version
```

On Linux or macOS without Homebrew, download the archive, check it against the release's checksums, and put the binary on your `PATH`. Set `OS` to `linux` or `darwin` and `ARCH` to `amd64` or `arm64`:

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

The checksum step must print `OK` for the archive; stop there if it does not. Windows uses the `.zip` archives: [Set up the CLI](/docs/setup/cli#windows) has the PowerShell steps.

With a Go toolchain (1.25 or later), build it from source instead:

```bash
go install github.com/NimbusNexus/webhooks-go/cmd/nn-webhooks@latest
```

## Sign in {#sign-in}

```bash
nn-webhooks login         # opens your browser; approve, and the CLI is signed in
nn-webhooks whoami        # the workspace, key name, permissions and expiry
nn-webhooks logout        # revokes that key and removes the profile
```

`login` prints a short code and opens [{{ACCOUNT_BASE_URL}}/device]({{ACCOUNT_BASE_URL}}/device) in your browser. Sign in as you usually do, check that the code on the page matches the one in your terminal, and approve. The CLI then saves an API key named `nn-webhooks on <your hostname>` to its profile. The key is valid for 90 days and is listed under **API keys** in the console, where you can revoke it at any time.

A workspace owner or admin approves the request, and can narrow its permissions (**Read & write**, **Publish** or **Read**) or limit the key to one project. A member sees the request but cannot approve it: ask an admin, or [configure](#configure) a key an admin made for you.

Only approve a sign-in you started yourself. A code someone else sends you would give them access to your workspace.

On a machine without a browser, such as an SSH session or a container, run `nn-webhooks login --no-browser` and open the printed link on any device. The code is valid for 15 minutes. Signing in again replaces the profile's key and revokes the old one.

## Configure {#configure}

`configure` saves a key you already have, such as one an admin minted in the console for CI:

```bash
nn-webhooks configure     # prompts for the API URL and key
nn-webhooks whoami        # what would be used, and where it came from
```

`nn-webhooks keys create` and `keys revoke` are still in the binary and still listed in `--help`, but the `/v1/api-keys` routes behind them were removed, so both now fail with a `404`. Mint a key in your NimbusNexus account console, under **API keys**, choosing **Webhooks** as the product — see [Getting access](/docs/product-webhooks#access). A `whsk_…` key from before the change no longer authenticates, so a profile still holding one needs reconfiguring with a replacement.

Credentials live in `$XDG_CONFIG_HOME/nn-webhooks/credentials.json` — or `~/.config/nn-webhooks/credentials.json` when `XDG_CONFIG_HOME` is unset, which it is by default on macOS — mode `0600`, as **named profiles**, so a second deployment is a flag rather than overwriting the first:

```bash
nn-webhooks --profile staging configure --url {{WEBHOOKS_BASE_URL}}
nn-webhooks --profile staging endpoints list
```

For CI, skip the file entirely:

```bash
export NN_WEBHOOKS_URL={{WEBHOOKS_BASE_URL}}
export NN_WEBHOOKS_API_KEY="<your-api-key>"
nn-webhooks deliveries list --status dead
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
nn-webhooks endpoints replace-subscriptions ep_123 --subscribe exact:deploy.completed --subscribe suffix:.failed
nn-webhooks endpoints rotate-secret ep_123
nn-webhooks endpoints enable ep_123

nn-webhooks deliveries list --status dead
nn-webhooks deliveries redeliver dlv_456

nn-webhooks verify --secret whsec_... --signature sha256=... --timestamp 1785984800 < body.json
```

Subscriptions are given as `kind:pattern`, repeatable — `--subscribe prefix:deploy.` or
`--subscribe exact:deploy.completed`. Values passed to `--set` are JSON-coerced, falling back to a
string, and `null` clears a field.

`update` cannot change subscriptions, because webhookd ignores them on a PATCH: `replace-subscriptions` sets the whole list at once, replacing what was there, and `--none` unsubscribes the endpoint from everything.

Everything prints JSON, so it pipes into `jq` without a `--format` flag to remember:

```bash
nn-webhooks deliveries list --status dead | jq -r '.items[].id' | \
  xargs -n1 nn-webhooks deliveries redeliver
```

`nn-webhooks verify` checks a webhook you received — useful for confirming a handler's rejection is the signature and not the framework's body handling, which is the more common culprit. Pass `--timestamp`: without it the HMAC is computed over the body alone, which never matches a real delivery, so every check fails. It prints `ok`/`failed` rather than JSON, and exits 0/1.

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
- [Webhooks overview](/docs/product-webhooks) — objects and delivery semantics.
