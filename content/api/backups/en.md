---
title: Backups
description: Snapshots and backups of block volumes, on demand or on a schedule, restored in place.
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Backups

A backup is a point-in-time copy of one [block volume](/docs/api/block-storage), of one of two types: a `snapshot`, kept by the block-storage service alongside the volume, or a `backup`, a separate full copy. You make them **on demand**, or a [schedule](/docs/api/scheduled-backups) makes them for you.

## Backups vs snapshots {#backups-vs-snapshots}

Both are point-in-time copies; they differ in operational shape:

|               | `type: snapshot`                                              | `type: backup`                                              |
| ------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| What it is    | A snapshot kept with the volume                               | A separate full copy, which can also go to your own storage |
| Created by    | A direct call or a schedule                                   | A direct call or a schedule                                 |
| Restored with | `POST /api/v1/backup_restore/volume_backups/snapshot_restore` | `POST /api/v1/backup_restore/volume_backups/backup_restore` |

A snapshot belongs to its volume: deleting the volume with `cascade: true` (`DELETE /api/v1/storage/`) deletes its snapshots too.

## Making a copy {#create}

`POST /api/v1/backup_restore/volume_backups/create_backup` copies a volume now. Give the `volume_id` and the `type`, `snapshot` or `backup`, plus an optional `name`, `description` and `permanent`. For a `backup`, `storage_ids` also sends the copy to external storage connections you've set up with `POST /api/v1/external/connections/`.

The call queues the work and answers right away, or answers `409` if the copy wouldn't fit your backup quota. `GET /api/v1/backup_restore/volume_backups/` lists your copies, filtered by `backup_types` and `statuses`, with `limit` (default 10) and `offset`. A copy's `status` is `pending`, `in_progress`, `completed` or `failed`.

## Scheduled copies {#policies}

A schedule makes copies for you. Create one with `POST /api/v1/backup_restore/backup_scheduler/`, giving a `frequency` and a `backup_quantity`, then bind it to each volume with `POST /api/v1/backup_restore/volume_scheduler/`, giving the `volume_id`, the `schedule_id` and the `type`. [Scheduled backups](/docs/api/scheduled-backups) has the details.

## Retention {#retention}

A schedule keeps the newest `backup_quantity` copies (default 5) of each volume bound to it, and deletes older ones as new copies arrive; `outside_backup_quantity` (default 1) does the same for the copies in each external storage. Copies you make on demand stay until you delete them.

To keep a copy out of that rotation, set `permanent: true` on it, when you make it or later with `PATCH /api/v1/backup_restore/volume_backups/{volume_backup_id}`.

Delete one copy with `DELETE /api/v1/backup_restore/volume_backups/single/{volume_backup_id}`, or several with `DELETE /api/v1/backup_restore/volume_backups/bulk` and their ids in the `backup_ids` query parameter.

## Restoring {#restore}

Restore a snapshot with `POST /api/v1/backup_restore/volume_backups/snapshot_restore`, and a backup with `POST /api/v1/backup_restore/volume_backups/backup_restore`. Both take `{"backup_id": "…"}`, queue the work and answer right away. The copy must be `completed` and of the endpoint's type; otherwise the call answers `409`.

A restore works in place. It builds a new volume from the copy, the same size and in the same availability zone as the original, and puts it where the original was:

- A data volume is detached from its VM, and the restored volume is attached in its place.
- For a VM's boot volume, the VM is rebuilt on the restored disk. The new VM takes over the old one's ports and floating IPs, and the old VM is deleted. The VM gets a new `id`; the restored disk keeps the SSH keys it had.

The original volume's copies and schedule bindings move over to the restored volume.

## What's next {#next-steps}

- [Scheduled backups](/docs/api/scheduled-backups) — make copies on a timetable.
- [Block storage](/docs/api/block-storage) — the volumes these copies come from.
- [Virtual machines](/docs/api/vms) — what a boot-volume restore rebuilds.
