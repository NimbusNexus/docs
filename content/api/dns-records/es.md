---
title: "Registros DNS"
description: "Registros A, AAAA, CNAME, MX, TXT, SRV y NS dentro de una zona."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Registros DNS

Un conjunto de registros es una tupla `(name, type)` dentro de una [zona](/docs/api/dns-zones), con uno o más valores. `www.example.com → A → 203.0.113.5` es un conjunto de registros A de un solo valor; los conjuntos multivalor (DNS round-robin) contienen N valores bajo un mismo id de conjunto.

## Tipos de registro admitidos {#types}

| Tipo      | Para qué                                          | Valor de ejemplo                                  |
| --------- | ------------------------------------------------- | ------------------------------------------------- |
| **A**     | Dirección IPv4                                    | `203.0.113.5`                                     |
| **AAAA**  | Dirección IPv6                                    | `2001:db8::1`                                     |
| **CNAME** | Alias de otro nombre                              | `other.example.com.`                              |
| **MX**    | Servidor de correo                                | `10 mail.example.com.`                            |
| **TXT**   | Texto libre — verificación, SPF, DKIM, DMARC      | `"v=spf1 -all"`                                   |
| **SPF**   | Política SPF, en su propio tipo de registro       | `"v=spf1 -all"`                                   |
| **SRV**   | Ubicación de un servicio                          | `10 5 5060 sip.example.com.`                      |
| **NS**    | Delegación a otros servidores de nombres          | `ns1.other.com.`                                  |
| **CAA**   | Autorización de autoridades de certificación      | `0 issue "letsencrypt.org"`                       |
| **SSHFP** | Huella de la clave de host SSH                    | `4 2 <sha256-fingerprint>`                        |
| **NAPTR** | Regla de reescritura para buscar un servicio      | `100 10 "U" "E2U+sip" "!^.*$!sip:info@example.com!" .` |
| **PTR**   | Puntero de DNS inverso                            | Consulta [DNS inverso](/docs/api/reverse-dns)     |

No admitimos: `ALIAS` / `ANAME` (CNAME flattening en la raíz del dominio) — usa en su lugar el CNAME en un subdominio, o un registro A que apunte a una IP flotante en la raíz del dominio.

## Registros multivalor {#multi-value}

Puedes poner varios valores en un mismo conjunto de registros:

```text
www.example.com → A → 203.0.113.5
                  → 203.0.113.6
                  → 203.0.113.7
```

Los servidores de nombres sirven los tres valores en cada consulta, y los resolutores reparten las peticiones entre ellos — un balanceo de carga round-robin básico sin LB. Para un balanceo de carga de verdad, apuntarías el registro a la VIP de un [balanceador de carga](/docs/api/load-balancers); los registros multivalor son para los casos en los que el cliente + el resolutor pueden gestionar el failover por su cuenta (la mayoría de los clientes HTTP modernos pueden).

## TTLs {#ttl}

Cada conjunto de registros tiene un TTL en segundos — el tiempo que los resolutores guardan la respuesta en caché antes de volver a consultar. Fija `ttl` al crear o actualizar un conjunto de registros. Si no lo indicas, el conjunto de registros usa el TTL de su zona, que es 3600 (1 hora) salvo que fijes otro en la zona.

Elige TTLs más bajos mientras estés iterando activamente; súbelos cuando los registros se estabilicen, para reducir el volumen de consultas.

## Próximos pasos {#next-steps}

- [Zonas DNS](/docs/api/dns-zones) — el contenedor en el que viven los registros.
- [IPs flotantes](/docs/api/floating-ips) — destino habitual de los registros A/AAAA.
- [Balanceadores de carga](/docs/api/load-balancers) — destino VIP para servicios con más tráfico.
