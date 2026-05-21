---
title: Snapshots
description: Point-in-time copies of VMs, block volumes, and managed databases.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Snapshots

A snapshot is a point-in-time copy of a source resource — a VM, a block volume, or a managed database — written to object storage. Snapshots survive their source: deleting a VM doesn't delete its snapshots. Restoring a snapshot creates a **new** resource; the original is never modified.

## Three source kinds {#source-kinds}

| Source kind | What's captured                                                                              | Restore target                                            |
| ----------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `vm`        | Root disk + attached volume state at a consistent moment                                     | A new VM of the same or larger size, in any region        |
| `volume`    | Block volume contents at a consistent moment                                                 | A new block volume of the same or larger size, any region |
| `database`  | Logical snapshot at the engine level (Postgres / MySQL WAL fence, MongoDB oplog point, etc.) | A new database of the same engine + version               |

The snapshot's `source_kind` field tells you which it is; the restore endpoint dispatches to the right backend based on this field.

## How a snapshot is consistent {#consistency}

- **Volume snapshots** quiesce the I/O queue, take a block-layer snapshot (~10 seconds), and continue copying in the background. The VM keeps running; in-flight writes after the snapshot point land in the post-snapshot state.
- **VM snapshots** snapshot the root disk + every attached volume atomically. If you've configured pre/post-snapshot hooks (cloud-init scripts that flush an application's buffers), they run inline.
- **Database snapshots** use the engine's native consistency mechanism. No I/O quiescing needed on the caller's side; the database's own commit-log fence guarantees you can restore to a transactionally-consistent point.

For applications that need application-level consistency (e.g. a Postgres database hosted on a VM, not via managed databases), prefer the database's own snapshot API over a volume snapshot.

## Storage + retention {#storage}

Snapshots are stored on the cold tier (\$0.04/GB-month, deduped against earlier snapshots from the same source). Retention defaults to **7 days**; pass `retention_days` on create to extend up to 365 days.

The deduplication means: a series of daily snapshots of the same VM is roughly the size of the original VM plus the daily delta — not N× the VM size. Steady-state cost for a daily-snapshot-30-day-retention policy on a 100 GB VM is typically 130–160 GB total, depending on how much changes.

## Restore semantics {#restore}

Restore creates a **new resource** from the snapshot. The source resource (if still alive) is not affected. Restored VMs get a new id, a new IP, and new SSH key injection from the project's current keys (the original key set isn't preserved — restoring an old VM after a key rotation gives you VMs the old, removed keys can't access).

Cross-region restore is supported. Internal data transfer for the snapshot copy is metered as cross-region egress (\$0.005/GB) the first time; subsequent restores in the destination region don't repeat the transfer.

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — VM lifecycle that snapshots capture.
- [Block storage](/docs/api/block-storage) — volume snapshots specifically.
- [Managed databases](/docs/api/managed-databases) — database-specific snapshot via the database's own endpoint.
- [Cold storage](/docs/api/cold-storage) — the tier snapshots are stored on.
