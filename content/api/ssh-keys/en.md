---
title: SSH keys
description: Public keys registered under your user and installed in a VM at boot.
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# SSH keys

SSH keys are how you log into Linux VMs after they boot. Register a key under your user, then name it in `sshs` when you create a VM; cloud-init writes it into the default user's `~/.ssh/authorized_keys`.

## How it works {#how-it-works}

There are two ways to register a key:

- `POST /api/v1/ssh/add_public` with a `name` and your `ssh_public_key`. You send the **public** key only; the private key stays with you.
- `POST /api/v1/ssh/` with a `name` generates a key pair and returns its `private_key` once. Save it then: the API never shows it again.

A VM gets the one key you name in `sshs` when you create it. At boot, the metadata service exposes that public key to cloud-init, which writes it into the default user's authorized_keys file.

Keys added **after** a VM boots are not automatically pushed to running VMs. A VM keeps the key it was created with, so add a new key inside the VM with your usual config management.

## Supported formats {#formats}

The key string must be in OpenSSH format — the single line starting with `ssh-ed25519`, `ecdsa-sha2-nistp...`, or `ssh-rsa`, followed by the base64-encoded key material, optionally followed by a comment. That's what `~/.ssh/id_*.pub` files contain by default.

## Fingerprints + duplicates {#fingerprints}

Each key has a stable **SHA256 fingerprint**. `GET /api/v1/ssh/` lists your keys with their `fingerprint` and public `key`. Key names must be unique among your keys: registering a second key under a name you already use answers `409`.

## Removing a key {#removing}

`DELETE /api/v1/ssh/` with the key's id in `ssh_keys` deletes it, so new VMs can't use it. **Already-booted VMs keep the key** in their authorized_keys file — cloud-init isn't a state-reconciler, it's a first-boot installer. To revoke a key from running VMs, either:

1. Recreate the VMs with a different key in `sshs`, or
2. Edit `~/.ssh/authorized_keys` inside the VM directly (or via your config management).

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — VMs use these keys at boot.
- [Authentication](/docs/authentication) — API keys are for the management API, not VM login. The SSH-key endpoints take a signed-in session, not an API key.
