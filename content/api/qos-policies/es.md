---
title: "Políticas de QoS"
description: "Límites de ancho de banda, marcado DSCP y reglas de ancho de banda mínimo para puertos, redes, gateways de routers y VIPs de balanceadores de carga."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: qos-policies
---

# Políticas de QoS

Una política de QoS agrupa un conjunto de reglas de calidad de red — topes de ancho de banda, marcado DSCP de paquetes y reglas de ancho de banda mínimo — y las aplica a [puertos de red](/docs/api/network-ports), redes enteras, gateways de routers o VIPs de balanceadores de carga, mediante su `qos_policy_id` (el de un balanceador de carga es `vip_qos_policy_id`). La regla más habitual es un **límite de ancho de banda** (limitar el throughput de un puerto a 100 Mbps, por ejemplo, para evitar que una carga de trabajo desbocada sature los enlaces ascendentes compartidos).

El marcado DSCP añade indicaciones de prioridad a los paquetes que salen de un puerto — útil cuando las redes posteriores (tu oficina, la red de un socio) respetan DSCP para el control del tráfico. Una regla de ancho de banda mínimo pide al menos `min_kbps` en una `direction`.

Para las cargas de trabajo típicas no necesitas una política propia. NimbusNexus ya asocia una política de límite de ancho de banda cuando creas una VM en la red externa o le das a un router un gateway externo, con el tamaño del `bandwidth_mbps` que elegiste. `POST /api/v1/bandwidth/resize` cambia el límite de un puerto, una IP flotante o el gateway de un router, y con él su facturación. Aplica políticas cuando tengas un requisito concreto de control del tráfico — normalmente cumplimiento normativo, cargas de trabajo sensibles a la latencia o mitigación de vecinos ruidosos.

## Próximos pasos {#next-steps}

- [Puertos de red](/docs/api/network-ports) — una de las cosas a las que se asocian las políticas de QoS.
- [Redes](/docs/api/networks) y [Subredes](/docs/api/subnets) — el modelo de red más amplio.
