---
title: VM images
description: OS boot images — public templates plus project-owned custom images.
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# VM images

A VM image is the OS template used to boot a new VM's root disk. NimbusNexus ships **public images**, and you can upload your own **custom images**, built with tools like Packer.

## Public images {#public-images}

`GET /api/v1/image/` lists the images you can use; `visibility=public` narrows it to the public ones. An image is identified by its `id`, a UUID, and that's what you pass as `image` when you create a VM. Names are labels, not versioned slugs, so look the `id` up instead of hard-coding a name.

When a VM boots, it gets the SSH key you named in `sshs` (see [SSH keys](/docs/api/ssh-keys)) and any `user_data` you passed; an image with cloud-init applies them on first boot.

## Custom images {#custom-images}

A custom image takes two calls:

1. `POST /api/v1/image/` creates the image record from a `name` (at least 5 characters), a `disk_format` and a `container_format`, and returns its `id`. Optionally set `visibility` (default `private`: your project only) and `subscription`, the billing plan (default `Hourly`).
2. `POST /api/v1/image/file` uploads the file, as multipart `file` and `image_id`. Or `POST /api/v1/image/import` with `{"id": "…", "url": "…"}` fetches the image from a URL.

Accepted file extensions are `.img`, `.qcow2`, `.vmdk`, `.vhd`, `.vhdx`, `.raw`, `.iso`, `.ami`, `.ari`, `.aki` and `.vdi`; any other extension answers `400`.

Custom images are billed per GB, rounded up to a whole GB, as their own product, on the plan in `subscription`; see [Pricing data](/docs/api/pricing-data).

## Regions {#regions}

Image calls work in your session's region. There's no call to copy an image to another region.

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — provision a VM with one of these images.
- [VM sizes](/docs/api/vm-sizes) — the compute shape the image boots into.
- [Backups](/docs/api/backups) — snapshots and backups of a VM's volumes.
