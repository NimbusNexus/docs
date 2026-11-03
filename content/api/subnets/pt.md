---
title: "Sub-redes"
description: "Blocos de endereços IP recortados de uma rede. Cada sub-rede tem seu próprio CIDR, gateway e política de DHCP."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Sub-redes

Uma sub-rede é um bloco de endereços IP dentro de uma [rede](/docs/api/networks). Uma VM se conecta à rede por meio de uma porta, e a porta recebe o endereço de uma das sub-redes da rede.

## Tamanho do CIDR {#cidr}

Você escolhe o CIDR na criação. Tamanhos típicos:

| Caso de uso             | CIDR  |
| ----------------------- | ----- |
| Testes com uma única VM | `/29` |
| App pequeno (≤ 20 VMs)  | `/27` |
| App médio (≤ 100 VMs)   | `/25` |
| App grande              | `/24` |
| VPC do projeto inteiro  | `/16` |

Nem todos os endereços do bloco vão para VMs: as portas tiram os seus dos `allocation_pools` da sub-rede.

O CIDR de uma sub-rede fica fixo depois que ela é criada. `PUT /api/v1/subnet/{subnet_id}` altera o `name`, os `dns_nameservers`, os `allocation_pools`, o `gateway_ip` e o `enable_dhcp` dela, não o tamanho; para ter mais endereços, adicione outra sub-rede à rede. Você **não** pode reduzir uma sub-rede sem recriá-la; os IPs das VMs existentes teriam de ser renumerados.

## DHCP, SLAAC e comportamento do gateway {#dhcp}

- **Sub-redes IPv4** usam DHCP por padrão. Cada VM recebe um endereço fixo do intervalo disponível da sub-rede. Você pode pré-alocar IPs específicos pelo endpoint de portas quando precisar de um endereço estável (por exemplo, para um backend de LB no DNS).
- **Sub-redes IPv6** recebem os mesmos campos que as IPv4, com `ip_version: 6`. Não existe um campo para escolher entre SLAAC e DHCPv6.
- O **gateway** é definido por sub-rede. Nas sub-redes de tenant que precisam de acesso à internet, o gateway aponta para o [roteador](/docs/api/routers) anexado à sub-rede.

## Várias sub-redes por rede {#multiple}

Você pode anexar várias sub-redes a uma rede. É assim que você configura o dual-stack IPv4 + IPv6: uma sub-rede v4 e uma sub-rede v6 na mesma rede.

## Próximos passos {#next-steps}

- [Redes](/docs/api/networks) — o recurso pai das sub-redes.
- [Roteadores](/docs/api/routers) — onde anexar uma sub-rede de tenant para que ela alcance a internet.
- [Máquinas virtuais](/docs/api/vms) — as VMs se conectam às redes por meio de portas.
