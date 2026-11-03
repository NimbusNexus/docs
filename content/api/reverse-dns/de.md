---
title: "Reverse DNS (PTR-Einträge)"
description: "PTR-Einträge für Floating-IPs — der Hostname, den die Rückwärtsauflösung Ihrer IP ergibt."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: reverse-dns
---

# Reverse DNS (PTR-Einträge)

Reverse DNS ist der Hostname, den jemand erhält, der fragt: „Welcher Name steckt hinter dieser IP?“ — die Umkehrung der normalen DNS-Auflösung. Die Einträge liegen in einem eigenen Baum (`in-addr.arpa.` für IPv4, `ip6.arpa.` für IPv6) und sind für den IP-Block autoritativ, den sie abdecken.

Für die meisten VMs reicht das Standard-Reverse-DNS. Setzen Sie einen eigenen PTR, wenn:

- **Sie einen Mailserver betreiben.** Die meisten großen E-Mail-Anbieter lehnen Mail von IPs ab, deren PTR nicht zum Forward-DNS des sendenden Hostnamens passt. Ohne passenden PTR sinkt Ihre Zustellrate auf null.
- **Ein Partner Sie anhand des PTR identifiziert und auf seine Allow-List gesetzt hat.** Manche Firewalls prüfen eingehendes TCP mit einem Reverse-Lookup und anschließendem Forward-Lookup.

Es gibt zwei Wege, einen zu setzen:

- **An einer [Floating-IP](/docs/api/floating-ips).** `PUT /api/v1/ptr/records/set/{floatingip_id}` setzt oder ersetzt ihren PTR, mit dem Ziel-Hostnamen in `ptrdname`; `PUT /api/v1/ptr/records/unset/{floatingip_id}` entfernt ihn. Die ID hat die Form `<region>:<floating-ip-id>`.
- **In einer Reverse-Zone, die Ihrem Projekt gehört.** `POST /api/v1/zones/{zone_id}/ptr/` fügt ein PTR-Record-Set für eine `ip` hinzu, mit dem Ziel-Hostnamen in `records`.

## Nächste Schritte {#next-steps}

- [Floating-IPs](/docs/api/floating-ips) — die zugeteilten IPs, für die PTRs gesetzt werden.
- [DNS-Zonen](/docs/api/dns-zones) und [DNS-Einträge](/docs/api/dns-records) — die Seite des Forward-DNS.
