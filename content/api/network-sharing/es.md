---
title: "Redes compartidas"
description: "Comparte una red, una subred o un puerto entre proyectos del mismo workspace."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: network-sharing
---

# Redes compartidas

Normalmente las redes están aisladas por proyecto — una red del proyecto `acme-prod` es invisible para `acme-staging`. Compartir redes abre un hueco controlado en ese aislamiento: el proyecto propietario comparte una red concreta con otro proyecto concreto (del mismo workspace), y el proyecto que la recibe puede conectar VMs a la red compartida como si fuera suya.

Casos de uso: una red de servicios compartidos (bases de datos, cachés, APIs internas) a la que necesitan llegar varios proyectos de aplicación. La alternativa es exponer los servicios en IPs públicas y volver a protegerlos en L7 — es posible, pero más complejo que compartir el segmento L2 dentro del límite de confianza de un workspace.

No se puede compartir entre workspaces — es un límite de aislamiento deliberado.

## Próximos pasos {#next-steps}

- [Redes](/docs/api/networks) — el recurso que se comparte.
- [Workspaces](/docs/api/workspaces) — el límite de lo que se puede compartir.
- [Grupos de seguridad](/docs/api/security-groups) — lo que filtra el tráfico en una red compartida.
