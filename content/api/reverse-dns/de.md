---
title: "Reverse DNS (PTR-Einträge)"
description: "PTR-Einträge für Floating-IPs — der Hostname, den die Rückwärtsauflösung Ihrer IP ergibt."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: reverse-dns
---

# Reverse DNS (PTR-Einträge)

Reverse DNS ist der Hostname, den jemand erhält, der fragt: „Welcher Name steckt hinter dieser IP?“ — die Umkehrung der normalen DNS-Auflösung. Die Einträge liegen in einem eigenen Baum (`in-addr.arpa.` für IPv4, `ip6.arpa.` für IPv6) und sind für den IP-Block autoritativ, den sie abdecken.

Für die meisten VMs reicht das Standard-Reverse-DNS (`unused.nimbusnexus.net` oder ähnlich). Setzen Sie einen eigenen PTR, wenn:

- **Sie einen Mailserver betreiben.** Die meisten großen E-Mail-Anbieter lehnen Mail von IPs ab, deren PTR nicht zum Forward-DNS des sendenden Hostnamens passt. Ohne passenden PTR sinkt Ihre Zustellrate auf null.
- **Ein Partner Sie anhand des PTR identifiziert und auf seine Allow-List gesetzt hat.** Manche Firewalls prüfen eingehendes TCP mit einem Reverse-Lookup und anschließendem Forward-Lookup.

PTR-Einträge gibt es nur für von NimbusNexus zugeteilte [Floating-IPs](/docs/api/floating-ips) — für eine IP, die nicht uns gehört, können Sie keine PTRs setzen.

## Nächste Schritte {#next-steps}

- [Floating-IPs](/docs/api/floating-ips) — die zugeteilten IPs, für die PTRs gesetzt werden.
- [DNS-Zonen](/docs/api/dns-zones) und [DNS-Einträge](/docs/api/dns-records) — die Seite des Forward-DNS.
