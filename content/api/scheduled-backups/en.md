---
title: Scheduled backups
description: Recurring backup schedules — daily, weekly or monthly. Separate from on-demand backups.
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: scheduled-backups
---

# Scheduled backups

On-demand [backups](/docs/api/backups) cover the "I want a snapshot of this volume right now" case. Scheduled backups make copies of a volume on a timetable and keep the newest few.

A schedule has a `frequency` and a `backup_quantity`, the number of copies to keep (default 5). A `daily` schedule runs every day; `weekly` runs every 7 days and `monthly` every 30 days, counted from the day the schedule was created. Create one with `POST /api/v1/backup_restore/backup_scheduler/`; it belongs to your workspace. Then bind it to each volume with `POST /api/v1/backup_restore/volume_scheduler/`, giving the `volume_id`, the `schedule_id` and the `type` of copy, `snapshot` or `backup`. Binding answers `409` if the copies wouldn't fit your backup quota.

To send `backup` copies to external storage as well, set `use_outside_storage` on the binding and link the storage with `POST /api/v1/backup_restore/volume_scheduler/config-storage` (`config_id`, `storage_id`, `priority`). The schedule's `outside_backup_quantity` (default 1) sets how many copies to keep there.

The scheduler runs in the background. A failed run is retried, and one that keeps failing sends a [notification](/docs/api/notifications). To keep one copy beyond the rotation, such as a year-end copy, set `permanent: true` on it with `PATCH /api/v1/backup_restore/volume_backups/{volume_backup_id}`.

## What's next {#next-steps}

- [Backups](/docs/api/backups) — the on-demand counterpart and the resource type schedules produce.
- [Block storage](/docs/api/block-storage) — the volumes schedules copy.
