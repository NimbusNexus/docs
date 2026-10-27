---
title: "Políticas de QoS"
description: "Límites de ancho de banda, marcado DSCP y garantías de ancho de banda mínimo aplicados a los puertos de red."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: qos-policies
---

# Políticas de QoS

Una política de QoS agrupa un conjunto de reglas de calidad de red — topes de ancho de banda, marcado DSCP de paquetes y reservas de ancho de banda mínimo — y las aplica a uno o más [puertos de red](/docs/api/network-ports). La regla más habitual es un **límite de ancho de banda** (limitar el throughput de un puerto a 100 Mbps, por ejemplo, para evitar que una carga de trabajo desbocada sature los enlaces ascendentes compartidos).

El marcado DSCP añade indicaciones de prioridad a los paquetes que salen de un puerto — útil cuando las redes posteriores (tu oficina, la red de un socio) respetan DSCP para el control del tráfico. Las reservas de ancho de banda mínimo garantizan que un puerto reciba al menos N Mbps incluso cuando hay contención — útil para telefonía y cargas de trabajo en tiempo real.

Para las cargas de trabajo típicas, la opción por defecto (sin política de QoS) está bien. Aplica políticas cuando tengas un requisito concreto de control del tráfico — normalmente cumplimiento normativo, cargas de trabajo sensibles a la latencia o mitigación de vecinos ruidosos.

## Próximos pasos {#next-steps}

- [Puertos de red](/docs/api/network-ports) — a lo que se asocian las políticas de QoS.
- [Redes](/docs/api/networks) y [Subredes](/docs/api/subnets) — el modelo de red más amplio.
