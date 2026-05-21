---
title: Backups
description: Scheduled and on-demand backups with deduplication, retention policies, and cross-region restore.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Backups

Backups are managed copies of VMs, volumes, and databases, kept on the cold-storage tier with deduplication and configurable retention. The endpoints support both **on-demand** backups (one-off, you call POST) and **scheduled** backups (recurring, driven by a policy attached to the source resource).

## Backups vs snapshots {#backups-vs-snapshots}

Both are point-in-time copies; they differ in operational shape:

|                          | Snapshot                             | Backup                                                              |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------------- |
| Created by               | Direct API call only                 | Direct call OR a recurring policy                                   |
| Retention                | Default 7 days, manual extend        | Driven by an explicit retention policy (daily/weekly/monthly tiers) |
| Pricing                  | \$0.04/GB-month (cold tier, deduped) | \$0.04/GB-month + per-restore retrieval fees                        |
| Cross-region replication | Manual via restore-then-copy         | Built into the policy                                               |
| Restore-as-new-resource  | Yes                                  | Yes                                                                 |
| Audit log                | Standard                             | Standard + policy-attribution metadata                              |

Use snapshots for ad-hoc copies you'll consume yourself. Use backups for the recurring "we always have a 7-day-old, 30-day-old, and 365-day-old copy" pattern — that's the policy-driven shape.

## Policy-driven backups {#policies}

Attach a backup policy to a VM / volume / database with:

```json
{
  "source_id": "vm_01H...",
  "source_kind": "vm",
  "schedule": "daily",
  "retention": {
    "daily": 7,
    "weekly": 4,
    "monthly": 12,
    "yearly": 5
  }
}
```

That policy maintains 7 dailies + 4 weeklies + 12 monthlies + 5 yearlies = 28 active backups at steady state. Older backups age out automatically; you don't have to garbage-collect manually.

Policy endpoints live at `/v1/backups/policies` (not shown in the minimal sample below — full reference in the live spec).

## Retention locks {#retention}

A backup under an active retention tier (e.g. "daily, retain 7") is **retention-locked** for that period. Attempting to delete it before expiry returns 409. This is the compliance feature: a user can't delete a backup that's still inside the retention window, even if they have admin rights.

To override, you'd need to detach the source from the policy (which orphans the backup, no longer retention-locked), then delete. The orphaning is logged in the audit trail.

## Cross-region replication {#cross-region}

A policy can specify a secondary region: every backup created by the policy is replicated to the secondary within ~10 minutes of creation. The replicated copy bills as cross-region storage (\$0.005/GB-month delta over the primary).

Restoring from the secondary doesn't require any extra ceremony — `POST /v1/backups/{id}/restore` with the secondary's id, target region defaults to the secondary's region. Common DR drill: monthly restore from the secondary into a sandbox project, validate, destroy.

## What's next {#next-steps}

- [Snapshots](/docs/api/snapshots) — the ad-hoc cousin.
- [Cold storage](/docs/api/cold-storage) — the tier backups live on.
- [Virtual machines](/docs/api/vms), [Block storage](/docs/api/block-storage), [Managed databases](/docs/api/managed-databases) — the three source-kind targets.
