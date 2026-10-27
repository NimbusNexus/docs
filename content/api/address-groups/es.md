---
title: "Grupos de direcciones"
description: "Conjuntos de CIDRs con nombre, reutilizables en las reglas de los grupos de seguridad."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: address-groups
---

# Grupos de direcciones

Un grupo de direcciones es un conjunto de bloques CIDR, con nombre y modificable, al que puedes hacer referencia desde las reglas de los [grupos de seguridad](/docs/api/security-groups). En lugar de pegar la misma lista de permitidos en diez grupos de seguridad, creas un grupo de direcciones (`office-cidrs`) y haces referencia a él desde cada regla. Añade o quita un CIDR del grupo y todas las reglas que hacen referencia a él se actualizan al instante.

El caso de uso típico: los CIDRs de la VPN corporativa, que cambian con el tiempo. Mantener la lista directamente en cada grupo de seguridad te obliga a ir buscándola por todas partes cuando cambia un CIDR; mantenerla en un único grupo de direcciones te permite actualizarla en un solo sitio.

## Próximos pasos {#next-steps}

- [Grupos de seguridad](/docs/api/security-groups) — donde se hace referencia a los grupos de direcciones.
- [Redes](/docs/api/networks) y [Subredes](/docs/api/subnets) — la capa de red dentro de la que se aplican los grupos de direcciones.
