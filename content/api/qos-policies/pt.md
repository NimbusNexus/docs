---
title: "Políticas de QoS"
description: "Limites de banda, marcação DSCP e garantias de banda mínima aplicados a portas de rede."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: qos-policies
---

# Políticas de QoS

Uma política de QoS reúne um conjunto de regras de qualidade de rede — tetos de banda, marcação DSCP de pacotes e reservas de banda mínima — e as aplica a uma ou mais [portas de rede](/docs/api/network-ports). A regra mais comum é um **limite de banda** (limitar a vazão de uma porta a 100 Mbps, por exemplo, para impedir que uma carga de trabalho descontrolada sature os uplinks compartilhados).

A marcação DSCP adiciona dicas de prioridade aos pacotes que saem de uma porta — útil quando as redes a jusante (seu escritório, a rede de um parceiro) respeitam o DSCP para modelagem de tráfego. As reservas de banda mínima garantem que uma porta receba pelo menos N Mbps mesmo sob contenção — útil para telefonia e cargas de trabalho em tempo real.

Para cargas de trabalho típicas, o padrão (sem política de QoS) basta. Aplique políticas quando tiver um requisito específico de modelagem de tráfego — normalmente conformidade, cargas de trabalho sensíveis à latência ou mitigação de vizinhos barulhentos.

## Próximos passos {#next-steps}

- [Portas de rede](/docs/api/network-ports) — onde as políticas de QoS são anexadas.
- [Redes](/docs/api/networks) e [Sub-redes](/docs/api/subnets) — o modelo de rede mais amplo.
