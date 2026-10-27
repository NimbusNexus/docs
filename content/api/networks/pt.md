---
title: "Redes"
description: "Domínios de broadcast L2 aos quais VMs e balanceadores de carga se conectam. A primitiva básica da VPC de um projeto."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Redes

Uma rede é um domínio de broadcast L2 virtual dentro de uma região. VMs e balanceadores de carga não se conectam diretamente à internet — eles se conectam a uma **sub-rede**, que fica dentro de uma **rede**, que é o que este recurso descreve.

## Dois tipos {#flavors}

| Tipo         | Criada por                                             | Roteável para a internet                 | Usada para                                              |
| ------------ | ----------------------------------- | ---------------------------- | ---------------------------------------------------- |
| **Externa**  | Provisionada automaticamente por região; compartilhada | Sim (via IPs flutuantes)                 | O uplink padrão para a maioria das cargas de trabalho   |
| **Tenant**   | Você, dentro do projeto                                | Não diretamente — precisa de um roteador | VPC privada, apps multicamadas, serviços só internos    |

A rede externa de cada região (padrão de id: `net_external_us_east_1`) é compartilhada entre todos os projetos dessa região, mas isolada no nível de grupo de segurança / VLAN. As redes de tenant são totalmente privadas e só ficam visíveis dentro do seu projeto.

## Por que criar uma rede de tenant {#why-tenant}

- **Arquitetura multicamadas.** VMs de frontend em uma sub-rede voltada para o público; VMs de backend / banco de dados em uma sub-rede privada. Os dois lados se comunicam pela rede de tenant sem nunca passar pela internet pública.
- **Vários ambientes isolados em uma região.** prod / staging / dev em três redes de tenant separadas; sem comunicação cruzada acidental.
- **Conformidade.** Algumas cargas de trabalho exigem endereçamento privado para tudo, exceto um caminho de egress documentado. Uma rede de tenant + roteador permite construir esse caminho de forma explícita.

Para configurações simples de uma única VM, basta conectar à rede externa e dispensar totalmente as redes de tenant.

## MTU e IPv6 {#mtu-ipv6}

Por padrão, as redes usam MTU 1500 (padrão Ethernet). Você pode solicitar uma rede com jumbo frames (MTU 9000) na criação, para cargas de trabalho de alta vazão entre VMs da mesma rede — cuidado: algumas CDNs / parceiros externos não negociam jumbo frames direito.

Para ativar o IPv6, defina a versão de IP da rede como `dual` ou `ipv6` (o padrão é `ipv4`). As sub-redes recortadas de uma rede com IPv6 ativado podem ser v4 ou v6 (misturar as duas na mesma rede é suportado).

## Próximos passos {#next-steps}

- [Sub-redes](/docs/api/subnets) — blocos de endereços IP recortados de uma rede.
- [Roteadores](/docs/api/routers) — conectam as redes de tenant ao gateway externo.
- [Grupos de segurança](/docs/api/security-groups) — regras de firewall aplicadas às interfaces dentro de uma rede.
- [Balanceadores de carga](/docs/api/load-balancers) — distribuem o tráfego entre as VMs de uma rede.
