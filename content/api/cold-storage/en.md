---
title: Cold storage
description: Archive-tier storage with the cheapest per-GB rate and separately-metered retrieval.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Cold storage

Cold storage is the archive tier — cheap to keep, slower and metered to retrieve. Pick this when you almost never read the data: long-tail backups, compliance retention, raw logs for audits.

## What you pay for {#pricing}

Three cost components, all metered separately:

| Item                   | Rate                    | When you pay                                   |
| ---------------------- | ----------------------- | ---------------------------------------------- |
| **Storage**            | \$0.004/GB-month        | Continuously while the archive exists          |
| **Retrieval**          | \$0.02–\$0.05/GB        | Per restore request, varies by retrieval class |
| **Early-deletion fee** | per-GB × remaining days | If you delete before 90 days                   |

For comparison: Object Storage Standard is \$0.013/GB-month (3.25× the rate) — and Object Standard has no retrieval fee or minimum-storage duration. The trade-off is: pay less to keep, more to read.

## Minimum-storage duration {#min-duration}

Every archive incurs a **90-day minimum storage charge**. Delete an archive after 30 days, and you'll be billed for the remaining 60 days as part of the deletion. This is the same model AWS Glacier uses; it's what makes the storage rate this low.

In practice: don't churn cold-storage objects. The right pattern is write-once, keep-or-delete-after-90-days.

## Retrieval classes {#retrieval-classes}

| Class       | Latency     | Per-GB cost | When to use                                           |
| ----------- | ----------- | ----------- | ----------------------------------------------------- |
| `expedited` | 1–5 minutes | \$0.05      | Compliance retrievals; one-off audits with a deadline |
| `standard`  | 3–5 hours   | \$0.02      | The default; cost-effective for unplanned reads       |
| `bulk`      | 5–12 hours  | \$0.005     | Restoring tens-of-TB+ overnight                       |

A retrieval doesn't move data out of the archive permanently — it makes a temporary copy in Object Standard for 24 hours, accessible via a presigned URL. The archive itself is unchanged.

## When NOT to use cold storage {#when-not-to-use}

- Anything you might read more than ~once a quarter — the retrieval fees overwhelm the storage savings.
- Anything time-sensitive on read — even `expedited` retrieval is 1–5 minutes, not seconds.
- Data with a known short lifecycle — the 90-day minimum makes churn expensive.

For all three cases, [Object storage](/docs/api/object-storage) with the IA or Cold storage class is a better fit (lower retrieval fees, shorter or no minimum duration).

## What's next {#next-steps}

- [Object storage](/docs/api/object-storage) — same product family, higher-frequency access patterns.
- [Snapshots](/docs/api/snapshots) — VM and volume snapshots are stored on the cold tier by default.
