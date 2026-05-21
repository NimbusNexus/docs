---
title: Object storage
description: S3-compatible buckets with three storage classes and free in-region transfer to VMs.
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Object storage

NimbusNexus Object Storage exposes the **AWS S3 API**. Existing tools and libraries — `aws s3` CLI, boto3, the official Java/Go/Node SDKs, every framework that talks S3 — work unchanged after pointing them at our endpoint and dropping in our credentials.

## What's S3-compatible, what's not {#compat}

We implement the operations 90% of S3 callers use:

- Bucket CRUD (`PutBucket`, `GetBucket`, `DeleteBucket`)
- Object CRUD (`PutObject`, `GetObject`, `DeleteObject`, `HeadObject`, `ListObjects`/`ListObjectsV2`)
- Multipart upload (`CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`)
- Pre-signed URLs (sig v4)
- Object metadata, content-type, custom headers
- Server-side encryption (always-on, AES-256)

We **don't** implement:

- AWS-specific IAM (we have our own — use the [Authentication](/docs/authentication) bearer-token model for the management API; S3 credentials are issued separately).
- S3 Object Lock / WORM compliance (planned for 2026 Q4).
- S3 Select (server-side query).
- Cross-region replication via S3 API (we expose it via the management API instead, with cleaner pricing).

If your app uses an S3 feature that's not in the supported list, it'll get a `501 Not Implemented` with the operation name in `error.code`. Switch to the supported equivalent or open a feature request.

## Storage classes {#classes}

Three classes, picked at object-put time (or per-bucket default):

| Class      | Per-GB-month | First-byte latency | Min storage duration | When to use                                                                                                                                                        |
| ---------- | ------------ | ------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `standard` | \$0.013      | <50 ms             | None                 | Hot data — web assets, frequent reads, anything served live.                                                                                                       |
| `ia`       | \$0.007      | <50 ms             | 30 days              | "Infrequent access" — accessed sometimes, but you want it fast when you do. Same retrieval performance as Standard, half the storage rate, a per-GB retrieval fee. |
| `cold`     | \$0.004      | 1–60 minutes       | 90 days              | Archive — backups, raw logs, compliance retention. Cheaper to keep, slower to retrieve.                                                                            |

Minimum-storage-duration means: if you delete an object before the minimum window, you pay the per-GB rate for the rest of the window. That's the "infrequent" in IA: it's cheap if you let objects sit, expensive if you churn them.

For pure archive needs where you almost never read the data, see [Cold storage]({{BASE_URL}}/cold-storage) — a dedicated archive product with even cheaper rates (\$0.004/GB-month flat, plus retrieval fees).

## Egress, the actually-different thing {#egress}

The single biggest difference from AWS S3 is **how egress is priced**:

- VM ↔ object storage **in the same region**: **free**, always. This is the load path for most workloads — your VMs talk to your buckets — and we don't bill it. Effective egress for production traffic that stays inside one region: \$0.
- Public internet egress: \$0.009/GB, with the first **1 TB free per month** per project. For comparison, AWS S3 charges \$0.09/GB for the first 10 TB.
- Cross-region egress: \$0.005/GB. Lower than public-internet egress because the path is on our backbone, not the open internet.

The "free in-region transfer to VMs" line on the marketing page is a real architectural commitment, not a promotion. The point is to make multi-tier architectures (object storage as the source-of-truth, fronted by VMs that read and serve) economical.

## Bucket naming {#naming}

Bucket names are **globally unique across all NimbusNexus tenants** — same rule as AWS. DNS-compatible: lower-case, 3–63 chars, no underscores, no leading/trailing dashes. Bucket-name squatting is the main reason claim early for important names.

Bucket names appear in the URL: `https://<bucket>.{{S3_HOST_US_EAST_1}}/<key>` or path-style at `{{S3_ENDPOINT_US_EAST_1}}/<bucket>/<key>`. Both styles work; SDK clients pick one based on their config.

## Listing, paging, performance {#listing}

`ListObjectsV2` returns up to 1,000 keys per request, sorted lexicographically by key. Beyond 1,000, paginate with `continuation_token` — same as S3.

For very wide buckets (millions of keys), use **delimited listing**: pass `delimiter=/` to get directory-style listing where keys are grouped by prefix. Listing a "directory" with a delimiter scans only its immediate children, not the whole bucket.

Cold-class objects in a list response are returned identically to Standard / IA — listing doesn't trigger retrieval, only `GetObject` does. You can scan a 100M-object Cold bucket for free; restoring an object out of Cold has its own per-GB charge.

## What's next {#next-steps}

- [Authentication](/docs/authentication) — bearer-token auth for the management API. S3 credentials (access key + secret key) are issued separately via the management API.
- [Block storage](/docs/api/block-storage) — when you want a filesystem rather than a key-value store, or you need POSIX semantics.
- [Mosaic editor]({{BASE_URL}}/products/mosaic) — browser-based editor for YAML/JSON/Markdown files inside your buckets. Free with every Storage account.
