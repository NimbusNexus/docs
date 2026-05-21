---
title: Block storage
description: Persistent NVMe volumes attached to VMs. Three tiers, live resize, snapshots.
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Block storage

Block volumes are persistent NVMe disks you attach to VMs. Each volume lives in a single region; survives the VM it's attached to (you can detach + reattach to a new VM); can be resized without downtime; and can be snapshotted to object storage on demand.

## Tiers {#tiers}

| Tier          | Per-GB-month | Throughput | IOPS (peak) | When to use                                                                                     |
| ------------- | ------------ | ---------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `standard`    | \$0.11       | 250 MB/s   | 3,000       | Root disks, dev databases, anything you want to keep cheap.                                     |
| `performance` | \$0.18       | 1,000 MB/s | 16,000      | Production database disks, build caches, hot data. **Default for managed databases.**           |
| `extreme`     | \$0.30       | 4,000 MB/s | 64,000      | Latency-sensitive workloads — ad serving, analytics scratch, anything that bottlenecks on disk. |

All three tiers use the same NVMe hardware; the differences are scheduling-tier QoS, not media-tier. You can resize **and** retier without downtime — start on Standard, bump to Performance when you outgrow the IOPS budget, drop back if usage settles.

## Lifecycle {#lifecycle}

Volumes move through four states:

- `available` — created but not attached. Bills the same as attached (storage doesn't care).
- `attached` — bound to a VM. Visible inside the VM as a block device (`/dev/sdb`, `/dev/sdc`, …).
- `detaching` → `available` — releasing from a VM. The unmount happens server-side; make sure your filesystem is flushed first.
- `deleted` — destroyed. **Cannot be recovered.** Snapshot first if you want a recoverable backup.

Detach is a separate call from delete. We deliberately don't auto-delete a volume when its attached VM is destroyed — losing a database disk because a teammate destroyed the wrong VM is exactly the kind of disaster the API should make hard to commit accidentally.

## Resizing {#resize}

`POST /v1/volumes/{id}/resize` with `{ "size_gb": 500 }` grows a volume. The disk grows live; the filesystem inside the VM needs a separate `resize2fs` / `xfs_growfs` call to claim the new space. We document that step in the per-OS [VM guides](/docs/api/vms).

Shrinking isn't supported online. To go smaller: snapshot, create a new smaller volume from the snapshot, attach the new one, copy data, detach the old one. Easy to script; we don't ship it as a built-in because the data-loss footgun is sharp.

## Snapshots {#snapshots}

Snapshots are point-in-time copies stored in object storage (the `cold` class — cheap, retrieved on demand when you restore).

- Triggered by `POST /v1/volumes/{id}/snapshots`.
- Take ~10 seconds for the consistency point, then continue copying in the background.
- Stored at \$0.04/GB-month.
- Restorable to a new volume of the **same or larger** size, in any region (cross-region restore counts as inter-region egress at \$0.005/GB).

The snapshot is consistent at the block layer, not the application layer. For databases, prefer the database's own snapshot API (see [Managed databases](/docs/api/managed-databases)) — those quiesce writes at the engine level. Block-layer snapshots are right for filesystem volumes that aren't running a transactional engine.

## Attach semantics {#attach}

A volume can be attached to **one VM at a time**. Multi-attach (shared-disk semantics) is not supported — application-level coordination over a shared NVMe volume is harder than the API surface makes it look, and we'd rather not build the footgun.

Attachment is region-scoped: a volume in `us-east-1` cannot attach to a VM in `eu-central-1`. Snapshot + restore is the right pattern for moving data between regions.

## Pricing notes {#pricing}

- Storage: per GB-month, billed by the second. Storage class (Standard/Performance/Extreme) drives the rate; size drives the multiplier.
- Snapshots: \$0.04/GB-month, billed against the snapshot's content size (deduped across snapshots from the same volume).
- Cross-region replication: \$0.005/GB-month for the replicated copy, plus standard inter-region egress for the initial sync.
- No IOPS-billed pricing. No per-attachment fee. No throughput surcharge.

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — what you attach volumes to.
- [Object storage](/docs/api/object-storage) — for unstructured data that doesn't need block-level access (logs, backups, user uploads). Cheaper at large scale.
- [Conventions](/docs/conventions) for operation-polling, idempotency, error shapes.
