---
title: Notifications
description: Per-account notification preferences — what we email you about, and what to route via webhooks.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: notifications
---

# Notifications

Notification preferences control which events trigger an email to which contact, and which trigger a webhook delivery instead (or in addition). Categories include billing alerts, security events, quota warnings, scheduled-maintenance announcements, and feature releases.

The defaults are sane — billing and security always go to the billing/security contact regardless of preferences. The configurable categories are operational ones: maintenance windows, quota thresholds, beta-feature announcements, etc.

For larger teams the typical pattern is to route operational notifications via webhooks into your incident-management system (PagerDuty, Opsgenie) rather than email to a single contact. The webhook route here uses the same delivery semantics as the [webhooks](/docs/webhooks) doc.

## What's next {#next-steps}

- [Webhooks](/docs/webhooks) — the delivery channel for non-email routing.
- [Account overview](/docs/api/account-overview) — where the billing and security contacts live.
