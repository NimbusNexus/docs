---
title: Notifications
description: Your in-app notifications — list them, mark them read, delete them, and receive them live over a WebSocket.
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: notifications
---

# Notifications

A notification is an in-app message addressed to one user, for example an invitation to a workspace or the answer to a quota request. Each one has a `title` and a `message`, a `delivery_status` (`pending`, `unread` or `read`), a `visual_type` (`info`, `system`, `invite`, `payment`, `billing`, `warning`, `critical` or `resize`), and optional `meta_data` about the object it concerns.

`GET /api/v1/notifications/list` returns the caller's notifications, newest first, with a `total` and an `unread_count`. Filter with `statuses`, `workspace_id`, `meta_data_key` and `meta_data_value`, and page with `offset` and `limit` (up to 200). Mark one read with `PATCH /api/v1/notifications/`, or many at once with `PATCH /api/v1/notifications/bulk`. `DELETE` on the same two paths removes them.

For live delivery, open a WebSocket to `/api/v1/ws` with your session token in the handshake headers. `GET /api/v1/notifications/websocket-info` describes the connection.

## What's next {#next-steps}

- [Workspaces](/docs/api/workspaces) — workspace invitations arrive as notifications.
- [Quotas](/docs/api/quotas) — so do answers to quota requests.
- [Billing](/docs/api/invoices) — the email addresses that get statements and receipts.
