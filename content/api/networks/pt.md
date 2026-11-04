---
title: "Redes"
description: "Domínios de broadcast L2 aos quais VMs e balanceadores de carga se conectam. A primitiva básica da VPC de um projeto."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Redes

Uma rede é um domínio de broadcast L2 virtual dentro de uma região. VMs e balanceadores de carga se conectam a uma **rede** por meio de portas, e o endereço de cada porta vem de uma das **sub-redes** da rede.

## Dois tipos {#flavors}

| Tipo         | Criada por                                             | Roteável para a internet                 | Usada para                                              |
| ------------ | ----------------------------------- | ---------------------------- | ---------------------------------------------------- |
| **Externa**  | Provisionada automaticamente por região; compartilhada | Sim — diretamente ou via IPs flutuantes  | O uplink padrão para a maioria das cargas de trabalho   |
| **Tenant**   | Você, dentro do projeto                                | Não diretamente — precisa de um roteador | VPC privada, apps multicamadas, serviços só internos    |

A rede externa de cada região é compartilhada entre todos os projetos dessa região. O id dela é um UUID como qualquer outro; `GET /api/v1/network/` a lista com `router:external: true`. As redes de tenant só ficam visíveis dentro do seu projeto, a menos que você [as compartilhe](/docs/api/network-sharing).

## Por que criar uma rede de tenant {#why-tenant}

- **Arquitetura multicamadas.** VMs de frontend em uma sub-rede voltada para o público; VMs de backend / banco de dados em uma sub-rede privada. Os dois lados se comunicam pela rede de tenant sem nunca passar pela internet pública.
- **Vários ambientes isolados em uma região.** prod / staging / dev em três redes de tenant separadas; sem comunicação cruzada acidental.
- **Conformidade.** Algumas cargas de trabalho exigem endereçamento privado para tudo, exceto um caminho de egress documentado. Uma rede de tenant + roteador permite construir esse caminho de forma explícita.

Para configurações simples de uma única VM, basta conectar à rede externa e dispensar totalmente as redes de tenant. A porta da VM passa, então, a ter um endereço público. Criar uma VM na rede externa exige `bandwidth_mbps` e `subscription.bandwidth`, e a porta e a largura de banda dela são cobradas (veja [Dados de preços](/docs/api/pricing-data)).

## MTU e IPv6 {#mtu-ipv6}

Defina o `mtu` de uma rede ao criá-la ou atualizá-la. O padrão e o maior valor permitido são configurações da plataforma.

Uma rede não tem versão de IP própria; as sub-redes dela é que têm. Cada sub-rede recebe um `ip_version` 4 ou 6, e uma mesma rede pode ter as duas.

## Próximos passos {#next-steps}

- [Sub-redes](/docs/api/subnets) — blocos de endereços IP recortados de uma rede.
- [Roteadores](/docs/api/routers) — conectam as redes de tenant ao gateway externo.
- [Grupos de segurança](/docs/api/security-groups) — regras de firewall aplicadas às interfaces dentro de uma rede.
- [Balanceadores de carga](/docs/api/load-balancers) — distribuem o tráfego entre as VMs de uma rede.
