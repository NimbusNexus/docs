---
title: "DNS-Zonen"
description: "Autoritative DNS-Zonen auf den Nameservern von NimbusNexus."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# DNS-Zonen

Eine DNS-Zone ist eine autoritative Domain auf den Nameservern von NimbusNexus. Erstellen Sie eine Zone für `example.com`, richten Sie Ihren Domain-Registrar auf unsere Nameserver und fügen Sie dann [Einträge](/docs/api/dns-records) hinzu, um Adressen, Mail-Routing und Verifizierungs-Tokens für diese Domain zu veröffentlichen.

## Delegierung {#delegation}

Nachdem Sie eine Zone erstellt haben, enthält die Antwort die vier Nameserver, die Sie bei Ihrem Registrar konfigurieren müssen:

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

## DNSSEC {#dnssec}

DNSSEC ist für jede Zone, die wir hosten, standardmäßig aktiviert. Die DS-Einträge, die Sie bei Ihrem Registrar veröffentlichen müssen, sind im Zonendatensatz enthalten und lassen sich jederzeit erneut abrufen. Wir rotieren ZSK + KSK alle 90 Tage; nach einem KSK-Rollover müssen Sie den DS-Eintrag beim Registrar aktualisieren.

## Preise {#pricing}

- **Zonen:** \$0,50 pro Zone und Monat.
- **Abfragen:** Die erste 1 Million Abfragen/Monat pro Zone ist kostenlos, danach \$0,40 pro Million.

Zum Vergleich: Das autoritative DNS von Cloudflare ist im Basis-Tarif kostenlos, Route 53 kostet \$0,50/Zone + pro Abfrage, AWS Cloud Map ist teurer. Mit unseren Preisen liegen wir zwischen Cloudflare und Route 53.

## Nächste Schritte {#next-steps}

- [DNS-Einträge](/docs/api/dns-records) — die Einträge innerhalb einer Zone.
- [Floating-IPs](/docs/api/floating-ips) — typisches Ziel eines A- oder AAAA-Eintrags.
- [Load Balancer](/docs/api/load-balancers) — ein weiteres typisches Ziel von Einträgen.
