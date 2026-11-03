---
title: "DNS-Zonen"
description: "Autoritative DNS-Zonen auf den Nameservern von NimbusNexus."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# DNS-Zonen

Eine DNS-Zone ist eine autoritative Domain auf den Nameservern von NimbusNexus. Erstellen Sie eine mit `POST /api/v1/zones/` und geben Sie dabei ihren `name` mit abschließendem Punkt (`example.com.`) und eine Administrator-`email` an; die Zone gehört dem aufrufenden Projekt. Richten Sie dann Ihren Domain-Registrar auf unsere Nameserver und fügen Sie [Einträge](/docs/api/dns-records) hinzu, um Adressen, Mail-Routing und Verifizierungs-Tokens für diese Domain zu veröffentlichen.

## Delegierung {#delegation}

Diese Nameserver konfigurieren Sie bei Ihrem Registrar:

```text
{{DNS_NS1}}
{{DNS_NS2}}
{{DNS_NS3}}
{{DNS_NS4}}
```

Tragen Sie diese bei Ihrem Registrar (GoDaddy, Cloudflare Registrar, Porkbun usw.) als NS-Einträge Ihrer Domain ein. Sobald die Propagation abgeschlossen ist (typischerweise Minuten bis wenige Stunden, je nach den TTLs des Registrars), sind unsere Nameserver für die Domain autoritativ.

Während einer Migration können Sie Ihren bisherigen DNS-Anbieter parallel weiter nutzen — die NS-Einträge beider Anbieter können für kurze Zeit nebeneinander bestehen, wenn Sie den Registrar so einstellen, dass er beide Sätze verwendet. Entfernen Sie den alten Satz, sobald Sie alle Einträge umgezogen haben.

## Zone vs. Subdomain {#zone-vs-subdomain}

Eine Zone = eine Domain. `example.com` ist eine Zone; `api.example.com` ist eine Subdomain, die über einen A- oder CNAME-Eintrag in der Zone `example.com` abgebildet wird, keine eigene Zone — es sei denn, Sie wollen `api.example.com` gezielt an einen anderen DNS-Anbieter delegieren. Dann erstellen Sie `example.com` (mit NS-Einträgen, die für die Subdomain auf den anderen Anbieter zeigen) und die Zone der Subdomain getrennt voneinander.

Für die typische Nutzung ist eine Zone pro registrierter Domain der richtige Aufbau.

## Nächste Schritte {#next-steps}

- [DNS-Einträge](/docs/api/dns-records) — die Einträge innerhalb einer Zone.
- [Floating-IPs](/docs/api/floating-ips) — typisches Ziel eines A- oder AAAA-Eintrags.
- [Load Balancer](/docs/api/load-balancers) — ein weiteres typisches Ziel von Einträgen.
