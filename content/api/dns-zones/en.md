---
title: DNS zones
description: Authoritative DNS zones hosted on NimbusNexus nameservers.
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# DNS zones

A DNS zone is an authoritative domain hosted on NimbusNexus nameservers. Create one with `POST /api/v1/zones/`, giving its `name` with the trailing dot (`example.com.`) and an administrator `email`; the zone belongs to the calling project. Then point your domain registrar at our nameservers, and add [records](/docs/api/dns-records) to publish addresses, mail routing, and verification tokens for that domain.

## Delegation {#delegation}

These are the nameservers to configure at your registrar:

```text
{{DNS_NS1}}
{{DNS_NS2}}
{{DNS_NS3}}
{{DNS_NS4}}
```

Set these as the NS records for your domain at your registrar (GoDaddy, Cloudflare Registrar, Porkbun, etc.). Once propagation completes (typically minutes to a few hours, depending on the registrar's TTLs), our nameservers become authoritative for the domain.

You can keep using your existing DNS provider in parallel during a migration — both providers' NS records can coexist for a short period if you set the registrar to use both sets, then drop the old set once you've moved every record.

## Zone vs subdomain {#zone-vs-subdomain}

One zone = one domain. `example.com` is one zone; `api.example.com` is a subdomain handled by an A or CNAME record inside the `example.com` zone, not a separate zone — unless you specifically want to delegate `api.example.com` to a different DNS provider, in which case you'd create both `example.com` (with NS records pointing at the other provider for the subdomain) and the subdomain zone separately.

For typical use, one zone per registered domain is the right shape.

## What's next {#next-steps}

- [DNS records](/docs/api/dns-records) — the records inside a zone.
- [Floating IPs](/docs/api/floating-ips) — typical target for an A or AAAA record.
- [Load balancers](/docs/api/load-balancers) — another typical record target.
