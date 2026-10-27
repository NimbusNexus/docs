---
title: "Registros DNS"
description: "Registros A, AAAA, CNAME, MX, TXT, SRV e NS dentro de uma zona."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Registros DNS

Um conjunto de registros é uma tupla `(name, type)` dentro de uma [zona](/docs/api/dns-zones), com um ou mais valores. `www.example.com → A → 203.0.113.5` é um conjunto de registros A com um único valor; conjuntos com vários valores (DNS round-robin) guardam N valores sob um mesmo id de conjunto.

## Tipos de registro suportados {#types}

| Tipo      | Finalidade                                   | Exemplo de valor                              |
| --------- | ------------------------------------------ | ------------------------------------------ |
| **A**     | Endereço IPv4                                | `203.0.113.5`                                 |
| **AAAA**  | Endereço IPv6                                | `2001:db8::1`                                 |
| **CNAME** | Alias para outro nome                        | `other.example.com.`                          |
| **MX**    | Servidor de e-mail                           | `10 mail.example.com.`                        |
| **TXT**   | Texto livre — verificação, SPF, DKIM, DMARC  | `"v=spf1 -all"`                               |
| **SRV**   | Localização de serviço                       | `10 5 5060 sip.example.com.`                  |
| **NS**    | Delegação para outros servidores de nomes    | `ns1.other.com.`                              |
| **CAA**   | Autorização de autoridade certificadora      | `0 issue "letsencrypt.org"`                   |
| **PTR**   | Ponteiro de DNS reverso (para IPs flutuantes) | Veja [IPs flutuantes](/docs/api/floating-ips) |

Não suportamos: `ALIAS` / `ANAME` (CNAME flattening no apex) — em vez disso, use o CNAME em um subdomínio ou, no apex, um registro A apontando para um IP flutuante.

## Registros com vários valores {#multi-value}

Você pode colocar vários valores em um conjunto de registros:

```text
www.example.com → A → 203.0.113.5
                  → 203.0.113.6
                  → 203.0.113.7
```

Os servidores de nomes retornam os três valores a cada consulta, e os resolvedores distribuem as requisições entre eles — um balanceamento de carga round-robin básico, sem LB. Para um balanceamento de carga de verdade, aponte o registro para o VIP de um [balanceador de carga](/docs/api/load-balancers); vários valores servem para os casos em que o cliente + resolvedor conseguem lidar sozinhos com o failover (a maioria dos clientes HTTP modernos consegue).

## TTLs {#ttl}

Cada conjunto de registros tem um TTL em segundos — por quanto tempo os resolvedores guardam a resposta em cache antes de consultar de novo. Padrões:

- **A / AAAA / CNAME:** 300 segundos (5 minutos) — bom para atualizações rápidas / failover
- **MX / NS:** 3600 (1 hora) — estes mudam raramente
- **TXT para verificação:** 60 — curto para que as novas verificações sejam rápidas

Use TTLs mais baixos enquanto estiver iterando ativamente; aumente-os quando os registros se estabilizarem, para reduzir o volume de consultas + o custo.

## Próximos passos {#next-steps}

- [Zonas DNS](/docs/api/dns-zones) — o contêiner em que os registros ficam.
- [IPs flutuantes](/docs/api/floating-ips) — destino comum de registros A/AAAA.
- [Balanceadores de carga](/docs/api/load-balancers) — destino VIP para serviços com mais tráfego.
