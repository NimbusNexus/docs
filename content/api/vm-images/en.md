---
title: VM images
description: OS boot images — public templates plus project-owned custom images.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# VM images

A VM image is the OS template used to boot a new VM's root disk. NimbusNexus ships **public images** for the major Linux distros and Windows Server; you can also upload your own **custom images** built with tools like Packer or by snapshotting a configured VM.

## Public images {#public-images}

The public catalog updates monthly with security patches. Slugs are stable across patches; pulling `ubuntu-24.04` today and again in 6 months gives you 6 months of patches applied to the same base. Pin to a dated slug (e.g. `ubuntu-24.04-20260301`) if you need byte-reproducible boots.

Currently published slugs:

- `ubuntu-24.04`, `ubuntu-22.04`, `ubuntu-20.04`
- `debian-12`, `debian-11`
- `fedora-40`, `fedora-39`
- `rocky-9`, `rocky-8`
- `almalinux-9`, `almalinux-8`
- `windows-2022`, `windows-2019`

Every public image includes our minimal cloud-init configuration: SSH keys injected from the project's registered keys (see [SSH keys](/docs/api/ssh-keys)), `apt-get update` or equivalent on first boot, and the metadata service pinned to `169.254.169.254`.

## Custom images {#custom-images}

Bring-your-own images are accepted as **raw**, **qcow2**, or **vmdk** files up to **128 GB** uncompressed. The image is converted to our internal format on upload (~1–3 minutes per GB) and then becomes a regular bootable image for any VM in the same region.

Custom images are billed at \$0.013/GB-month (Object Standard rate) for storage. There's no separate "image storage" tier.

## Regions {#regions}

Public images are available in every live region. Custom images are region-scoped — uploading to `us-east-1` doesn't make the image bootable in `eu-central-1` without a copy. Use `POST /v1/vm-images/{id}/copy` (not in the reference below — coming) to replicate.

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — provision a VM with one of these images.
- [VM sizes](/docs/api/vm-sizes) — the compute shape the image boots into.
- [Snapshots](/docs/api/snapshots) — capture an existing VM as a snapshot, then convert to a custom image.
