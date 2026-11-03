---
title: "Zonas DNS"
description: "Zonas DNS autoritativas hospedadas nos servidores de nomes da NimbusNexus."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Zonas DNS

Uma zona DNS é um domínio autoritativo hospedado nos servidores de nomes da NimbusNexus. Crie uma com `POST /api/v1/zones/`, informando o `name` com o ponto final (`example.com.`) e um `email` de administrador; a zona pertence ao projeto que faz a chamada. Depois aponte o registrador do seu domínio para os nossos servidores de nomes e adicione [registros](/docs/api/dns-records) para publicar endereços, roteamento de e-mail e tokens de verificação desse domínio.

## Delegação {#delegation}

Estes são os servidores de nomes que você precisa configurar no seu registrador:

```text
{{DNS_NS1}}
{{DNS_NS2}}
{{DNS_NS3}}
{{DNS_NS4}}
```

Defina-os como os registros NS do seu domínio no seu registrador (GoDaddy, Cloudflare Registrar, Porkbun, etc.). Quando a propagação terminar (normalmente de minutos a algumas horas, dependendo dos TTLs do registrador), nossos servidores de nomes passam a ser autoritativos para o domínio.

Você pode continuar usando seu provedor de DNS atual em paralelo durante uma migração — os registros NS dos dois provedores podem coexistir por um curto período se você configurar o registrador para usar os dois conjuntos; depois, remova o conjunto antigo quando tiver movido todos os registros.

## Zona vs. subdomínio {#zone-vs-subdomain}

Uma zona = um domínio. `example.com` é uma zona; `api.example.com` é um subdomínio tratado por um registro A ou CNAME dentro da zona `example.com`, não uma zona separada — a menos que você queira especificamente delegar `api.example.com` a outro provedor de DNS. Nesse caso, você criaria separadamente a zona `example.com` (com registros NS apontando para o outro provedor no caso do subdomínio) e a zona do subdomínio.

No uso típico, uma zona por domínio registrado é o formato certo.

## Próximos passos {#next-steps}

- [Registros DNS](/docs/api/dns-records) — os registros dentro de uma zona.
- [IPs flutuantes](/docs/api/floating-ips) — destino típico de um registro A ou AAAA.
- [Balanceadores de carga](/docs/api/load-balancers) — outro destino típico de registros.
