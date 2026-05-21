---
title: DNS zones
description: Authoritative DNS zones hosted on NimbusNexus nameservers.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# DNS zones

A DNS zone is an authoritative domain hosted on NimbusNexus nameservers. Create a zone for `example.com`, point your domain registrar at our nameservers, then add [records](/docs/api/dns-records) to publish addresses, mail routing, and verification tokens for that domain.

## Delegation {#delegation}

After creating a zone, the response carries the four nameservers you need to configure at your registrar:

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

## DNSSEC {#dnssec}

DNSSEC is enabled by default on every zone we host. The DS records to publish at your registrar are returned in the zone record and can be re-fetched at any time. We rotate ZSK + KSK on a 90-day cadence; KSK rollovers require a DS update at the registrar.

## Pricing {#pricing}

- **Zones:** \$0.50 per zone per month.
- **Queries:** First 1 million queries/month free per zone, \$0.40 per million after.

For comparison: Cloudflare's authoritative DNS is free at the basic tier, Route 53 is \$0.50/zone + per-query, AWS Cloud Map is more expensive. Our pricing puts us between Cloudflare and Route 53.

## What's next {#next-steps}

- [DNS records](/docs/api/dns-records) — the records inside a zone.
- [Floating IPs](/docs/api/floating-ips) — typical target for an A or AAAA record.
- [Load balancers](/docs/api/load-balancers) — another typical record target.
