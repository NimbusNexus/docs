---
title: "Portas de rede"
description: "Portas L2/L3 em uma rede. A primitiva de nível mais baixo à qual as interfaces de VM e os balanceadores de carga se vinculam."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: network-ports
---

# Portas de rede

Uma porta de rede é o ponto de conexão entre uma rede e algo que a usa — uma VM, um balanceador de carga, um roteador. A maioria dos usuários não gerencia portas diretamente; eles criam uma VM anexada a uma rede e a porta é criada nos bastidores. Esta parte da API serve para os casos em que você realmente precisa de controle direto: pré-alocar uma porta + IP antes de subir uma VM, anexar um balanceador de carga a um IP específico já conhecido ou migrar o IP de um serviço entre hosts.

As portas têm um endereço MAC, um ou mais endereços IP na sub-rede-mãe e, opcionalmente, [grupos de segurança](/docs/api/security-groups) aplicados para filtrar o tráfego de entrada e de saída. Elas são stateful — uma porta continua existindo se você excluir a VM a que ela estava anexada, pronta para ser anexada de novo a uma VM substituta.

## Próximos passos {#next-steps}

- [Interfaces de VM](/docs/api/vm-interfaces) — a camada de nível mais alto, do tipo "anexe isto a uma VM", que cria portas por baixo dos panos.
- [Redes](/docs/api/networks) e [Sub-redes](/docs/api/subnets) — onde as portas ficam.
- [Grupos de segurança](/docs/api/security-groups) — o que filtra o tráfego das portas.
