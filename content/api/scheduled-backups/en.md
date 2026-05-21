---
title: Scheduled backups
description: Recurring backup schedules — daily, weekly, custom. Separate from on-demand backups.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: scheduled-backups
---

# Scheduled backups

On-demand [backups](/docs/api/backups) cover the "I want a snapshot of this volume right now" case. Scheduled backups cover everything else: nightly backups of every production volume, weekly full backups paired with daily incrementals, monthly snapshots retained for a year for compliance.

A schedule is a small JSON document — pick a target (a volume, a VM, a database), a frequency (cron-style), a retention policy (keep N most recent, or expire after X days), and storage policy (which backup storage region/class). The scheduler runs in the background; failed runs retry with backoff and surface in the schedule's run log.

Most production accounts use 2–4 schedules: daily-keep-14, weekly-keep-8, monthly-keep-12, and occasionally a year-end snapshot kept for 7 years for finance/legal.

## What's next {#next-steps}

- [Backups](/docs/api/backups) — the on-demand counterpart and the resource type schedules produce.
- [Block storage](/docs/api/block-storage) and [Snapshots](/docs/api/snapshots) — the backup sources.
- [Managed databases](/docs/api/managed-databases) — has its own retention model; doesn't use schedules from this endpoint.
