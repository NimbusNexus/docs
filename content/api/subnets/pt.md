---
title: "Sub-redes"
description: "Blocos de endereços IP recortados de uma rede. Cada sub-rede tem seu próprio CIDR, gateway e política de DHCP."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Sub-redes

Uma sub-rede é um bloco de endereços IP dentro de uma [rede](/docs/api/networks). VMs e balanceadores de carga se conectam a sub-redes, não diretamente a redes — uma rede é só um contêiner dentro do qual ficam uma ou mais sub-redes.

## Tamanho do CIDR {#cidr}

Você escolhe o CIDR na criação. Tamanhos típicos:

| Caso de uso               | CIDR  | Endereços utilizáveis |
| ---------------------- | ----- | ---------------- |
| Testes com uma única VM   | `/29` | 5                     |
| App pequeno (≤ 20 VMs)    | `/27` | 27                    |
| App médio (≤ 100 VMs)     | `/25` | 123                   |
| App grande                | `/24` | 251                   |
| VPC do projeto inteiro    | `/16` | 65.531                |

Toda sub-rede reserva: o endereço de rede (o primeiro), o de broadcast (o último), o gateway (normalmente `.1`) e o nosso servidor DHCP (normalmente `.2`). Então uma sub-rede `/24` tem 256 endereços brutos, mas só 251 utilizáveis para VMs.

Você pode redimensionar uma sub-rede para **maior** (`/27` → `/25`) online, sem interrupção. Você **não** pode reduzir uma sub-rede sem recriá-la; os IPs das VMs existentes teriam de ser renumerados.

## DHCP, SLAAC e comportamento do gateway {#dhcp}

- **Sub-redes IPv4** usam DHCP por padrão. Cada VM recebe um endereço fixo do intervalo disponível da sub-rede. Você pode pré-alocar IPs específicos pelo endpoint de portas quando precisar de um endereço estável (por exemplo, para um backend de LB no DNS).
- **Sub-redes IPv6** usam SLAAC por padrão. Cada VM gera automaticamente um endereço a partir do prefixo `/64` da sub-rede + o endereço MAC dela. O DHCPv6 está disponível como opção, para ambientes que exigem endereçamento determinístico.
- O **gateway** é definido por sub-rede. Nas sub-redes de tenant que precisam de acesso à internet, o gateway aponta para o [roteador](/docs/api/routers) anexado à sub-rede; na sub-rede criada automaticamente da rede externa, o gateway aponta para o nosso edge.

## Várias sub-redes por rede {#multiple}

Você pode anexar várias sub-redes a uma rede. Uma VM conectada a essa rede pode ser acessada de todas as sub-redes dentro dela (sujeito aos grupos de segurança). Isso é útil para dual-stack IPv4 + IPv6 — uma sub-rede v4 + uma sub-rede v6 na mesma rede dão as duas pilhas a todas as VMs.

## Próximos passos {#next-steps}

- [Redes](/docs/api/networks) — o recurso pai das sub-redes.
- [Roteadores](/docs/api/routers) — onde anexar uma sub-rede de tenant para que ela alcance a internet.
- [Máquinas virtuais](/docs/api/vms) — as VMs se conectam às sub-redes por meio de portas.
