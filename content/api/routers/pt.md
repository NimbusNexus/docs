---
title: "Roteadores"
description: "Conecte as sub-redes de tenant ao gateway externo do projeto."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Roteadores

Um roteador é o que dá acesso à internet a uma **rede de tenant** (e às sub-redes dela). VMs anexadas a uma sub-rede de tenant não conseguem chegar à internet pública sozinhas — elas estão em um segmento L2 privado. Um roteador faz a ponte entre esse segmento e a rede externa da região, fazendo NAT para o tráfego de saída e (opcionalmente) hospedando IPs flutuantes para o tráfego de entrada.

## Quando você precisa de um roteador {#when-needed}

- **VMs voltadas para o público em uma rede de tenant.** Anexe um roteador e depois aloque + anexe um [IP flutuante](/docs/api/floating-ips). O tráfego de saída passa por NAT no roteador; o de entrada no IP flutuante é roteado de volta para a VM.
- **Camadas de app privadas e públicas misturadas.** A camada web fica atrás de um roteador com um IP flutuante; as camadas de app + banco de dados continuam privadas e acessam a internet (para coisas como atualizações de pacotes) pelo NAT de origem do roteador.
- **Roteamento entre várias sub-redes.** Um roteador pode atender várias sub-redes ao mesmo tempo. O tráfego entre duas sub-redes no mesmo roteador é interno à VPC, nunca sai da NimbusNexus e não é cobrado como egress.

Se você está anexando VMs diretamente à rede externa, não precisa de roteador — a rede externa É o gateway.

## SNAT, DNAT e IPs flutuantes {#nat}

Um roteador tem uma conexão de gateway externo (com a rede externa da região) e zero ou mais conexões internas (com sub-redes de tenant).

- **Saída de uma VM privada** → o roteador faz NAT de origem para o IP externo do roteador. Várias VMs privadas compartilham esse único IP externo para o tráfego de saída.
- **Entrada em um IP flutuante** → o roteador faz NAT de destino para a VM privada à qual o IP flutuante está anexado. A VM privada vê o IP de origem original (preservamos o IP do cliente no NAT do tráfego de entrada; só o tráfego de saída passa por SNAT).

Você não configura o NAT diretamente; o roteador cuida disso com base em quais sub-redes estão anexadas e quais IPs flutuantes você criou.

## Rotas estáticas {#static-routes}

Um roteador tem uma tabela de rotas estáticas que você pode preencher para destinos que não são o padrão — por exemplo, rotear o tráfego de uma sub-rede para um CIDR específico através de outra VM (um appliance de VPN, um proxy transparente). A maioria dos usuários nunca mexe nisso; ela existe para os layouts avançados de VPC que precisam dela.

## Próximos passos {#next-steps}

- [Redes](/docs/api/networks) e [Sub-redes](/docs/api/subnets) — o que os roteadores conectam.
- [IPs flutuantes](/docs/api/floating-ips) — endereços públicos de entrada que passam por um roteador.
- [Grupos de segurança](/docs/api/security-groups) — a camada de firewall aplicada na interface da VM (o roteador em si não filtra).
