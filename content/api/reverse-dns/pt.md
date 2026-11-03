---
title: "DNS reverso (registros PTR)"
description: "Registros PTR para IPs flutuantes — o hostname que a resolução reversa do seu IP retorna."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: reverse-dns
---

# DNS reverso (registros PTR)

O DNS reverso é o hostname que alguém obtém ao perguntar "qual é o nome por trás deste IP?" — o inverso da resolução de DNS normal. Os registros ficam em uma árvore separada (`in-addr.arpa.` para IPv4, `ip6.arpa.` para IPv6) e são autoritativos para o bloco de IPs que cobrem.

Para a maioria das VMs, o DNS reverso padrão basta. Defina um PTR personalizado quando:

- **Você roda um servidor de e-mail.** A maioria dos grandes provedores de e-mail rejeita e-mails de IPs cujo PTR não corresponde ao DNS direto do hostname de envio. Sem um PTR correspondente, sua taxa de entrega cai para zero.
- **Você está na allow-list de um parceiro que usa identificação baseada em PTR.** Alguns firewalls fazem uma verificação com consulta reversa seguida de consulta direta para o TCP de entrada.

Há duas formas de definir um:

- **Em um [IP flutuante](/docs/api/floating-ips).** `PUT /api/v1/ptr/records/set/{floatingip_id}` define ou substitui o PTR dele, com o hostname de destino em `ptrdname`; `PUT /api/v1/ptr/records/unset/{floatingip_id}` o remove. O ID tem o formato `<region>:<floating-ip-id>`.
- **Em uma zona reversa que pertence ao seu projeto.** `POST /api/v1/zones/{zone_id}/ptr/` adiciona um conjunto de registros PTR para um `ip`, com o hostname de destino em `records`.

## Próximos passos {#next-steps}

- [IPs flutuantes](/docs/api/floating-ips) — as alocações de IP em que os PTRs são definidos.
- [Zonas DNS](/docs/api/dns-zones) e [Registros DNS](/docs/api/dns-records) — o lado do DNS direto.
