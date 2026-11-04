---
title: "Proyectos"
description: "La unidad de aislamiento para recursos y control de acceso, dentro de un workspace."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Proyectos

Un proyecto es la **unidad de aislamiento** en NimbusNexus — para los recursos y el control de acceso. Cada proyecto pertenece a un [workspace](/docs/api/workspaces). Cada recurso (VM, volumen, bucket, red, …) pertenece exactamente a un proyecto, y cada clave de API tiene el alcance de exactamente un proyecto. La facturación es por workspace: una sola factura cubre todos sus proyectos.

## Por qué importan los proyectos {#why}

Dos garantías que te da el límite del proyecto:

1. **Radio de impacto.** Una clave de API comprometida del proyecto `dev` no puede tocar los recursos de `prod`. Literalmente no son visibles desde dentro de `dev`.
2. **Cuota.** Las cuotas son por proyecto. Un proyecto que se desboca creando VMs no agota el margen de otro proyecto.

## Crear un proyecto {#create}

`POST /api/v1/projects/` recibe el ID del workspace como `domain_id`, un `project_name` y, de forma opcional, una `project_description` y `enabled`. El nombre debe ser único en el workspace; si no, la API responde `409`. Un workspace puede tener un límite de proyectos; por encima de él, crear responde `403`.

Los proyectos están unos al lado de otros en su workspace. La API no permite anidar un proyecto dentro de otro.

## Qué vive en un proyecto {#contents}

- VMs, volúmenes, backups
- Buckets
- Redes, subredes, routers, grupos de seguridad, IPs flotantes, balanceadores de carga
- Zonas DNS + registros
- Asignaciones de rol y claves de API (los usuarios a los que pertenecen viven en el workspace)

Los proyectos no se pueden fusionar. Para consolidar dos proyectos, tendrías que exportar y volver a importar los recursos y borrar el original — no hay una operación atómica de fusión, a propósito, porque la atribución resultante de "qué se ha fusionado dónde" sería imposible de auditar.

## Borrado {#deletion}

`DELETE /api/v1/projects/` recibe el `id` del proyecto en el cuerpo de la petición, y es **irreversible**. Elimina la red por defecto del proyecto y después borra el proyecto y sus asignaciones de rol. No borra nada más, así que borra antes las VMs, los volúmenes, los buckets y los demás recursos del proyecto.

## Próximos pasos {#next-steps}

- [Workspaces](/docs/api/workspaces) — el contenedor en el que viven los proyectos.
- [Roles](/docs/api/roles) — lo que necesitan tener los usuarios para hacer cualquier cosa.
- [Cuotas](/docs/api/quotas) — límites de recursos por proyecto.
