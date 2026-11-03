---
title: Block storage
description: Persistent volumes for VMs — create, attach, detach, grow, and delete.
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Block storage

Block volumes are persistent disks you attach to VMs. Each volume lives in your session's region; a data volume survives the VM it's attached to (you can detach + reattach to a new VM); volumes can grow; and you can snapshot or back one up through [Backups](/docs/api/backups).

## Volume types {#tiers}

`GET /api/v1/storage/artifacts` lists what you can create in your session's region: the volume types in `types`, and the priced storage options in `volume_options`. `POST /api/v1/storage/` takes the `size` in GB and the `volume_type`, one of the `volume_options` labels, which sets the price. Optional fields are a `type` from `types`, a `name`, a `description`, an `image` to build the volume from, and `subscription`, the billing plan (default `Hourly`).

A volume keeps its type for life: there's no call to change it. Prices per `volume_type` are in [Pricing data](/docs/api/pricing-data).

## Lifecycle {#lifecycle}

`POST /api/v1/storage/` queues the work and answers without an id; the new volume shows up in `GET /api/v1/storage/`. Its `status` comes from the block-storage service. The ones you'll meet most:

- `available` — created but not attached. Bills the same as attached (storage doesn't care).
- `in-use` — bound to a VM. Visible inside the VM as a block device (`/dev/vdb`, `/dev/vdc`, …).
- `detaching` → `available` — releasing from a VM. Unmount the filesystem inside the VM before you detach.

Detach is a separate call from delete. Deleting a VM deletes the boot volume made from its image; volumes you attached, or passed in `volumes` when you created the VM, stay `available`.

`DELETE /api/v1/storage/` destroys the volumes whose ids you list in `ids`. A deleted volume **cannot be recovered**, so back it up first if you want a recoverable copy. With `cascade: true`, the volume's snapshots are deleted along with it.

## Resizing {#resize}

`POST /api/v1/storage/resize` with `{"volume_id": "…", "new_size": 500}` grows a volume to 500 GB. `new_size` must be larger than the current size; anything else answers `400`. The filesystem inside the VM needs a separate `resize2fs` / `xfs_growfs` call to claim the new space.

Shrinking isn't supported. To go smaller: create a new, smaller volume, attach it, copy the data, and detach the old one.

## Snapshots {#snapshots}

Snapshots and backups of a volume are made through [Backups](/docs/api/backups): `POST /api/v1/backup_restore/volume_backups/create_backup` with the `volume_id` and `type: snapshot` (a point-in-time copy kept with the volume) or `type: backup` (a separate full copy).

The snapshot is consistent at the block layer, not the application layer. For a database, pause writes first or use the database's own backup tool. Block-layer snapshots are right for filesystem volumes that aren't running a transactional engine.

A restore puts the copy back in place of the volume, at the same size; see [Backups](/docs/api/backups#restore).

## Attach semantics {#attach}

A volume can be attached to **one VM at a time**. Multi-attach (shared-disk semantics) is not supported.

`POST /api/v1/storage/attach` takes the `volume_id`, the `instance_id` and an optional `mountpoint`; without one, the volume gets the first free device from `/dev/vdb` on. `POST /api/v1/storage/detach` takes the `instance_id`, the `volume_id` and the `attachment_id`, which `GET /api/v1/storage/detach_artifacts` lists for a VM.

A volume and the VM it attaches to are both in your session's region.

## Pricing notes {#pricing}

- Storage: billed per GB at the price of the volume's `volume_type`, on the plan in `subscription`. Prices are in [Pricing data](/docs/api/pricing-data).
- No IOPS-billed pricing. No per-attachment fee. No throughput surcharge.

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — what you attach volumes to.
- [Object storage](/docs/api/object-storage) — for unstructured data that doesn't need block-level access (logs, backups, user uploads).
- [Backups](/docs/api/backups) — snapshots and backups of a volume, and restoring them.
