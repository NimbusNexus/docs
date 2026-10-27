---
title: "DNS-Einträge"
description: "A-, AAAA-, CNAME-, MX-, TXT-, SRV- und NS-Einträge innerhalb einer Zone."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# DNS-Einträge

Ein Record-Set ist ein Tupel `(name, type)` innerhalb einer [Zone](/docs/api/dns-zones) und enthält einen oder mehrere Werte. `www.example.com → A → 203.0.113.5` ist ein A-Record-Set mit einem einzigen Wert; Sets mit mehreren Werten (Round-Robin-DNS) enthalten N Werte unter einer Set-ID.

## Unterstützte Eintragstypen {#types}

| Typ | Zweck | Beispielwert |
| --- | --- | --- |
| **A** | IPv4-Adresse | `203.0.113.5` |
| **AAAA** | IPv6-Adresse | `2001:db8::1` |
| **CNAME** | Alias auf einen anderen Namen | `other.example.com.` |
| **MX** | Mailserver | `10 mail.example.com.` |
| **TXT** | Freitext — Verifizierung, SPF, DKIM, DMARC | `"v=spf1 -all"` |
| **SRV** | Standort eines Dienstes | `10 5 5060 sip.example.com.` |
| **NS** | Delegierung an andere Nameserver | `ns1.other.com.` |
| **CAA** | Autorisierung von Zertifizierungsstellen | `0 issue "letsencrypt.org"` |
| **PTR** | Reverse-DNS-Zeiger (für Floating-IPs) | Siehe [Floating-IPs](/docs/api/floating-ips) |

Nicht unterstützt werden: `ALIAS` / `ANAME` (CNAME-Flattening am Apex) — verwenden Sie stattdessen den CNAME auf einer Subdomain oder am Apex einen A-Eintrag, der auf eine Floating-IP zeigt.

## Einträge mit mehreren Werten {#multi-value}

Sie können mehrere Werte in ein Record-Set aufnehmen:

```text
www.example.com → A → 203.0.113.5
                  → 203.0.113.6
                  → 203.0.113.7
```

Die Nameserver liefern bei jeder Abfrage alle drei Werte, und Resolver verteilen die Requests darauf — einfaches Round-Robin-Load-Balancing ohne LB. Für echtes Load-Balancing richten Sie den Eintrag stattdessen auf die VIP eines [Load Balancers](/docs/api/load-balancers); mehrere Werte sind für Fälle gedacht, in denen Client + Resolver das Failover selbst übernehmen können (die meisten modernen HTTP-Clients können das).

## TTLs {#ttl}

Jedes Record-Set hat eine TTL in Sekunden — wie lange Resolver die Antwort zwischenspeichern, bevor sie erneut abfragen. Standardwerte:

- **A / AAAA / CNAME:** 300 Sekunden (5 Minuten) — gut für schnelle Updates / Failover
- **MX / NS:** 3600 (1 Stunde) — diese ändern sich selten
- **TXT für Verifizierung:** 60 — kurz, damit erneute Verifizierungsprüfungen schnell gehen

Wählen Sie niedrigere TTLs, solange Sie noch aktiv ändern; erhöhen Sie sie, sobald die Einträge stabil sind, um Abfragevolumen + Kosten zu senken.

## Nächste Schritte {#next-steps}

- [DNS-Zonen](/docs/api/dns-zones) — der Container, in dem Einträge liegen.
- [Floating-IPs](/docs/api/floating-ips) — häufiges Ziel von A/AAAA-Einträgen.
- [Load Balancer](/docs/api/load-balancers) — VIP-Ziel für Dienste mit mehr Traffic.
