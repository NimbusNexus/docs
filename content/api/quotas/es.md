---
title: "Cuotas"
description: "Límites por proyecto de VMs, vCPU, RAM, almacenamiento, IPs flotantes y otros recursos."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Cuotas

Las cuotas son límites por proyecto que acotan cuánto de cada recurso puede tener un proyecto. Evitan que el gasto se dispare por bucles accidentales y garantizan que el consumo de un proyecto no pueda agotar la capacidad de una región.

## Qué tiene cuota {#what}

Los endpoints de cuotas cubren cuatro servicios. Cada uno responde con sus propios nombres de cuota, por ejemplo:

| Servicio   | Qué limita                | Ejemplos de nombres de cuota                                          |
| ---------- | ------------------------- | --------------------------------------------------------------------- |
| `nova`     | VMs                       | `instances`, `cores`, `ram` (en MB)                                   |
| `cinder`   | Almacenamiento en bloques | `volumes`, `gigabytes`, `snapshots`, `backups`                        |
| `neutron`  | Redes                     | `network`, `subnet`, `port`, `router`, `floatingip`, `security_group` |
| `projects` | Proyectos de tu workspace | `max_projects`                                                        |

Lee los valores por defecto con `GET /api/v1/quota/{service}?defaults=true`. `max_projects` es `-1`, que significa sin límite, salvo que se haya fijado un límite para tu workspace.

## Cuota frente a consumo {#quota-vs-usage}

Los endpoints exponen ambas cosas:

- `GET /api/v1/quota/{service}` — los **límites**, como un mapa de nombre de cuota a número.
- `GET /api/v1/quota/{service}/usage` — el **consumo actual**: `used`, `reserved` y `limit` para cada nombre de cuota.

`{service}` es `nova`, `cinder`, `neutron` o `projects`.

Comprueba siempre el consumo antes de crear recursos en bloque; una petición que te haría superar la cuota falla (como la cuota no tiene límite temporal, reintentar no sirve de nada — tienes que borrar algo o aumentar la cuota).

## Aumento de cuota {#raising}

Pide un aumento con `POST /api/v1/quota-request/`: indica el `service_name`, el `quota_name` y el `new_value`, y explica el motivo en `reason`. La solicitud es para tu proyecto actual, o para tu workspace cuando el servicio es `projects`. Necesita el rol `manager` o `admin`, y cada cuota solo puede tener una solicitud abierta a la vez.

Un administrador de NimbusNexus revisa cada solicitud a mano. Al aprobarla se aplica el límite nuevo; una solicitud también se puede rechazar o devolverte para que hagas cambios. En cualquier caso, la respuesta llega como una [notificación](/docs/api/notifications). `GET /api/v1/quota-request/list` lista tus solicitudes, y `PATCH` o `DELETE /api/v1/quota-request/` modifica o retira una que esté abierta.

## Cuotas en varias regiones {#regions}

Las cifras de `nova`, `cinder` y `neutron` son de la región en la que está tu sesión; cambia de región con `GET /api/v1/account/rescope?region=<region_name>`. La cuota de `projects` cuenta los proyectos de todo tu workspace. Las respuestas son mapas simples de nombres de cuota a números, sin campo de región ni de alcance.

## Próximos pasos {#next-steps}

- [Proyectos](/docs/api/projects) — el contenedor al que se aplican las cuotas.
- [Autenticación](/docs/authentication) — cómo llamar a estos endpoints.
- [Notificaciones](/docs/api/notifications) — donde llega la respuesta a una solicitud de cuota.
