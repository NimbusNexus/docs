---
title: DNS records
description: A, AAAA, CNAME, MX, TXT, SRV, NS records inside a zone.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# DNS records

A record set is one `(name, type)` tuple inside a [zone](/docs/api/dns-zones), holding one or more values. `www.example.com → A → 203.0.113.5` is a single-value A record set; multi-value sets (round-robin DNS) hold N values under one set id.

## Supported record types {#types}

| Type      | Purpose                                    | Example value                              |
| --------- | ------------------------------------------ | ------------------------------------------ |
| **A**     | IPv4 address                               | `203.0.113.5`                              |
| **AAAA**  | IPv6 address                               | `2001:db8::1`                              |
| **CNAME** | Alias to another name                      | `other.example.com.`                       |
| **MX**    | Mail exchanger                             | `10 mail.example.com.`                     |
| **TXT**   | Free text — verification, SPF, DKIM, DMARC | `"v=spf1 -all"`                            |
| **SRV**   | Service location                           | `10 5 5060 sip.example.com.`               |
| **NS**    | Delegation to other nameservers            | `ns1.other.com.`                           |
| **CAA**   | Cert-authority authorization               | `0 issue "letsencrypt.org"`                |
| **PTR**   | Reverse-DNS pointer (for floating IPs)     | See [floating IPs](/docs/api/floating-ips) |

We don't support: `ALIAS` / `ANAME` (CNAME-flattening at the apex) — use the CNAME at a subdomain instead, or an A record pointing at a floating IP at the apex.

## Multi-value records {#multi-value}

You can put multiple values in one record set:

```
www.example.com → A → 203.0.113.5
                  → 203.0.113.6
                  → 203.0.113.7
```

The nameservers serve all three values per query, and resolvers spread requests across them — basic round-robin load balancing without an LB. For real load balancing you'd point the record at a [load balancer](/docs/api/load-balancers) VIP instead; multi-value is for cases where the client + resolver can handle failover on their own (most modern HTTP clients can).

## TTLs {#ttl}

Each record set has a TTL in seconds — how long resolvers cache the answer before re-querying. Defaults:

- **A / AAAA / CNAME:** 300 seconds (5 minutes) — friendly for rapid updates / failover
- **MX / NS:** 3600 (1 hour) — these change rarely
- **TXT for verification:** 60 — short to make verification re-checks fast

Pick lower TTLs while you're actively iterating; bump them up once the records stabilize, to reduce query volume + cost.

## What's next {#next-steps}

- [DNS zones](/docs/api/dns-zones) — the container records live in.
- [Floating IPs](/docs/api/floating-ips) — common A/AAAA target.
- [Load balancers](/docs/api/load-balancers) — VIP target for higher-traffic services.
