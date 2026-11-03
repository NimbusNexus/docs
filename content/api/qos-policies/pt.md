---
title: "Políticas de QoS"
description: "Limites de banda, marcação DSCP e regras de banda mínima para portas, redes, gateways de roteadores e VIPs de balanceadores de carga."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: qos-policies
---

# Políticas de QoS

Uma política de QoS reúne um conjunto de regras de qualidade de rede — tetos de banda, marcação DSCP de pacotes e regras de banda mínima — e as aplica a [portas de rede](/docs/api/network-ports), redes inteiras, gateways de roteadores ou VIPs de balanceadores de carga, por meio do `qos_policy_id` deles (o de um balanceador de carga é `vip_qos_policy_id`). A regra mais comum é um **limite de banda** (limitar a vazão de uma porta a 100 Mbps, por exemplo, para impedir que uma carga de trabalho descontrolada sature os uplinks compartilhados).

A marcação DSCP adiciona dicas de prioridade aos pacotes que saem de uma porta — útil quando as redes a jusante (seu escritório, a rede de um parceiro) respeitam o DSCP para modelagem de tráfego. Uma regra de banda mínima pede pelo menos `min_kbps` em uma `direction`.

Para cargas de trabalho típicas, você não precisa de uma política própria. A NimbusNexus já anexa uma política de limite de banda quando você cria uma VM na rede externa ou dá um gateway externo a um roteador, dimensionada pelo `bandwidth_mbps` que você escolheu. `POST /api/v1/bandwidth/resize` altera o limite em uma porta, um IP flutuante ou um gateway de roteador, e a cobrança junto com ele. Aplique políticas quando tiver um requisito específico de modelagem de tráfego — normalmente conformidade, cargas de trabalho sensíveis à latência ou mitigação de vizinhos barulhentos.

## Próximos passos {#next-steps}

- [Portas de rede](/docs/api/network-ports) — uma das coisas a que as políticas de QoS são anexadas.
- [Redes](/docs/api/networks) e [Sub-redes](/docs/api/subnets) — o modelo de rede mais amplo.
