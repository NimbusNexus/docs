---
title: SSH keys
description: Public keys registered on the project and injected into VMs at boot.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# SSH keys

SSH keys are how you log into Linux VMs after they boot. Register your public key on the project; every new VM gets it dropped into the default user's `~/.ssh/authorized_keys` via cloud-init.

## How it works {#how-it-works}

You register the **public** key only — NimbusNexus never sees your private key. At boot, the metadata service exposes the project's registered public keys to cloud-init, which writes them into the default user's authorized_keys file (`ubuntu` on Ubuntu, `debian` on Debian, `rocky` on Rocky, `Administrator` for Windows via WinRM).

Keys added **after** a VM boots are not automatically pushed to running VMs. Either reboot the VM (cloud-init re-runs on first boot only by default, so this only helps with images that opt in to re-run) or add the key inside the VM with your usual config management.

## Supported formats {#formats}

We accept:

- **ed25519** — recommended; small, fast, modern
- **ecdsa-sha2-nistp256 / nistp384 / nistp521**
- **RSA** — 2048-bit minimum; 4096-bit recommended; we reject < 2048

DSA is rejected (it's been deprecated upstream since OpenSSH 7.0).

The key string must be in OpenSSH format — the single line starting with `ssh-ed25519`, `ecdsa-sha2-nistp...`, or `ssh-rsa`, followed by the base64-encoded key material, optionally followed by a comment. That's what `~/.ssh/id_*.pub` files contain by default.

## Fingerprints + duplicates {#fingerprints}

Each key has a stable **SHA256 fingerprint**. The API rejects duplicates by fingerprint — adding the same key twice (even with a different label) returns 409. This catches the common "I added my laptop key to two projects" mistake before it causes confused account-attribution.

## Removing a key {#removing}

Deleting a key from the project removes it from future VM boots. **Already-booted VMs keep the key** in their authorized_keys file — cloud-init isn't a state-reconciler, it's a first-boot installer. To revoke a key from running VMs, either:

1. Recreate the VMs from a fresh snapshot, or
2. Edit `~/.ssh/authorized_keys` inside the VM directly (or via your config management).

If the goal is a fast revoke because the key was compromised: the dashboard has a one-click "revoke from all projects" that pushes a removal via the metadata service. The API equivalent is in the IAM reference (coming).

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — VMs use these keys at boot.
- [Authentication](/docs/authentication) — API keys are unrelated; they're for the management API, not VM login.
