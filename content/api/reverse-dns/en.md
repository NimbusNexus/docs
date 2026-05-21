---
title: Reverse DNS (PTR records)
description: PTR records for floating IPs — the hostname that reverse-resolves your IP.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: reverse-dns
---

# Reverse DNS (PTR records)

Reverse DNS is the hostname someone gets when they ask "what's the name behind this IP?" — the inverse of normal DNS resolution. The records live in a separate tree (`in-addr.arpa.` for IPv4, `ip6.arpa.` for IPv6) and are authoritative for the IP block they cover.

For most VMs, the default reverse DNS (`unused.nimbusnexus.net` or similar) is fine. Set a custom PTR when:

- **You run a mail server.** Most major email providers reject mail from IPs whose PTR doesn't match the sending hostname's forward DNS. Without a matching PTR, your delivery rate drops to zero.
- **You're allowlisted by a partner using PTR-based identification.** Some firewalls do reverse-lookup-then-forward-lookup verification for inbound TCP.

PTR records are scoped to NimbusNexus-allocated [floating IPs](/docs/api/floating-ips) — you can't set PTRs on an IP that isn't ours.

## What's next {#next-steps}

- [Floating IPs](/docs/api/floating-ips) — the IP allocations PTRs are set on.
- [DNS zones](/docs/api/dns-zones) and [DNS records](/docs/api/dns-records) — the forward-DNS side.
