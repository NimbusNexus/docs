---
title: "Redes compartidas"
description: "Comparte una red, una política de QoS, un grupo de seguridad, un pool de subredes, un ámbito de direcciones o un grupo de direcciones con otro proyecto en el que tengas un rol."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: network-sharing
---

# Redes compartidas

Normalmente las redes están aisladas por proyecto — una red del proyecto `acme-prod` es invisible para `acme-staging`. Compartir redes abre un hueco controlado en ese aislamiento: compartes un objeto que pertenece a tu proyecto con otro proyecto en el que tienes un rol, y el proyecto que lo recibe puede usarlo como si fuera suyo — por ejemplo, conectar VMs a una red compartida.

`POST /api/v1/rbac_policy/` es el que comparte. Recibe el `object_type` (`network`, `qos_policy`, `security_group`, `subnetpool`, `address_scope` o `address_group`), el `object_id` del objeto, una `action` como `access_as_shared` y el proyecto que lo recibe en `target_tenant`.

Casos de uso: una red de servicios compartidos (bases de datos, cachés, APIs internas) a la que necesitan llegar varios proyectos de aplicación. La alternativa es exponer los servicios en IPs públicas y volver a protegerlos en L7 — es posible, pero más complejo que compartir el segmento L2 dentro del límite de confianza de un workspace.

## Próximos pasos {#next-steps}

- [Redes](/docs/api/networks) — el recurso que se comparte.
- [Proyectos](/docs/api/projects) — los propietarios y los receptores de los objetos compartidos.
- [Grupos de seguridad](/docs/api/security-groups) — lo que filtra el tráfico en una red compartida.
