---
title: Reverse DNS (PTR records)
description: PTR records for floating IPs — the hostname that reverse-resolves your IP.
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: reverse-dns
---

# Reverse DNS (PTR records)

Reverse DNS is the hostname someone gets when they ask "what's the name behind this IP?" — the inverse of normal DNS resolution. The records live in a separate tree (`in-addr.arpa.` for IPv4, `ip6.arpa.` for IPv6) and are authoritative for the IP block they cover.

For most VMs, the default reverse DNS is fine. Set a custom PTR when:

- **You run a mail server.** Most major email providers reject mail from IPs whose PTR doesn't match the sending hostname's forward DNS. Without a matching PTR, your delivery rate drops to zero.
- **You're allowlisted by a partner using PTR-based identification.** Some firewalls do reverse-lookup-then-forward-lookup verification for inbound TCP.

There are two ways to set one:

- **On a [floating IP](/docs/api/floating-ips).** `PUT /api/v1/ptr/records/set/{floatingip_id}` sets or replaces its PTR, with the target hostname in `ptrdname`; `PUT /api/v1/ptr/records/unset/{floatingip_id}` removes it. The ID has the form `<region>:<floating-ip-id>`.
- **In a reverse zone your project owns.** `POST /api/v1/zones/{zone_id}/ptr/` adds a PTR record set for an `ip`, with the target hostname in `records`.

## What's next {#next-steps}

- [Floating IPs](/docs/api/floating-ips) — the IP allocations PTRs are set on.
- [DNS zones](/docs/api/dns-zones) and [DNS records](/docs/api/dns-records) — the forward-DNS side.
