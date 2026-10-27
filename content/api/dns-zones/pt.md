---
title: "Zonas DNS"
description: "Zonas DNS autoritativas hospedadas nos servidores de nomes da NimbusNexus."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Zonas DNS

Uma zona DNS é um domínio autoritativo hospedado nos servidores de nomes da NimbusNexus. Crie uma zona para `example.com`, aponte o registrador do seu domínio para os nossos servidores de nomes e depois adicione [registros](/docs/api/dns-records) para publicar endereços, roteamento de e-mail e tokens de verificação desse domínio.

## Delegação {#delegation}

Depois que você cria uma zona, a resposta traz os quatro servidores de nomes que você precisa configurar no seu registrador:

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

## DNSSEC {#dnssec}

O DNSSEC vem ativado por padrão em todas as zonas que hospedamos. Os registros DS que você deve publicar no registrador são retornados no objeto da zona e podem ser buscados de novo a qualquer momento. Rotacionamos a ZSK + KSK a cada 90 dias; os rollovers da KSK exigem uma atualização do DS no registrador.

## Preços {#pricing}

- **Zonas:** \$0,50 por zona por mês.
- **Consultas:** primeiro 1 milhão de consultas/mês gratuito por zona, \$0,40 por milhão depois disso.

Para comparação: o DNS autoritativo da Cloudflare é gratuito no tier básico, o Route 53 custa \$0,50/zona + cobrança por consulta e o AWS Cloud Map é mais caro. Nossos preços nos colocam entre a Cloudflare e o Route 53.

## Próximos passos {#next-steps}

- [Registros DNS](/docs/api/dns-records) — os registros dentro de uma zona.
- [IPs flutuantes](/docs/api/floating-ips) — destino típico de um registro A ou AAAA.
- [Balanceadores de carga](/docs/api/load-balancers) — outro destino típico de registros.
