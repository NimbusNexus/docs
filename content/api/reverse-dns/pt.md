---
title: "DNS reverso (registros PTR)"
description: "Registros PTR para IPs flutuantes — o hostname que a resolução reversa do seu IP retorna."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: reverse-dns
---

# DNS reverso (registros PTR)

O DNS reverso é o hostname que alguém obtém ao perguntar "qual é o nome por trás deste IP?" — o inverso da resolução de DNS normal. Os registros ficam em uma árvore separada (`in-addr.arpa.` para IPv4, `ip6.arpa.` para IPv6) e são autoritativos para o bloco de IPs que cobrem.

Para a maioria das VMs, o DNS reverso padrão (`unused.nimbusnexus.net` ou similar) basta. Defina um PTR personalizado quando:

- **Você roda um servidor de e-mail.** A maioria dos grandes provedores de e-mail rejeita e-mails de IPs cujo PTR não corresponde ao DNS direto do hostname de envio. Sem um PTR correspondente, sua taxa de entrega cai para zero.
- **Você está na allow-list de um parceiro que usa identificação baseada em PTR.** Alguns firewalls fazem uma verificação com consulta reversa seguida de consulta direta para o TCP de entrada.

Os registros PTR são restritos a [IPs flutuantes](/docs/api/floating-ips) alocados pela NimbusNexus — não é possível definir PTRs em um IP que não seja nosso.

## Próximos passos {#next-steps}

- [IPs flutuantes](/docs/api/floating-ips) — as alocações de IP em que os PTRs são definidos.
- [Zonas DNS](/docs/api/dns-zones) e [Registros DNS](/docs/api/dns-records) — o lado do DNS direto.
