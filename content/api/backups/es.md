---
title: "Backups"
description: "Snapshots y backups de volúmenes de bloques, bajo demanda o programados, restaurados en su sitio."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Backups

Un backup es una copia en un momento dado de un [volumen de bloques](/docs/api/block-storage), de uno de dos tipos: un `snapshot`, que el servicio de almacenamiento en bloques guarda junto al volumen, o un `backup`, una copia completa aparte. Los haces **bajo demanda**, o una [programación](/docs/api/scheduled-backups) los hace por ti.

## Backups frente a snapshots {#backups-vs-snapshots}

Ambos son copias en un momento dado; se diferencian en cómo funcionan en la práctica:

|                 | `type: snapshot`                                              | `type: backup`                                                             |
| --------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Qué es          | Un snapshot que se guarda con el volumen                      | Una copia completa aparte, que también puede ir a tu propio almacenamiento |
| Creado por      | Una llamada directa o una programación                        | Una llamada directa o una programación                                     |
| Se restaura con | `POST /api/v1/backup_restore/volume_backups/snapshot_restore` | `POST /api/v1/backup_restore/volume_backups/backup_restore`                |

Un snapshot pertenece a su volumen: borrar el volumen con `cascade: true` (`DELETE /api/v1/storage/`) borra también sus snapshots.

## Hacer una copia {#create}

`POST /api/v1/backup_restore/volume_backups/create_backup` copia un volumen en ese momento. Indica el `volume_id` y el `type`, `snapshot` o `backup`, y de forma opcional un `name`, una `description` y `permanent`. Para un `backup`, `storage_ids` envía además la copia a las conexiones de almacenamiento externo que hayas configurado con `POST /api/v1/external/connections/`.

La llamada pone el trabajo en cola y responde enseguida, o responde `409` si la copia no cabe en tu cuota de backups. `GET /api/v1/backup_restore/volume_backups/` lista tus copias, filtradas por `backup_types` y `statuses`, con `limit` (por defecto, 10) y `offset`. El `status` de una copia es `pending`, `in_progress`, `completed` o `failed`.

## Copias programadas {#policies}

Una programación hace copias por ti. Crea una con `POST /api/v1/backup_restore/backup_scheduler/`, indicando una `frequency` y una `backup_quantity`, y después vincúlala a cada volumen con `POST /api/v1/backup_restore/volume_scheduler/`, indicando el `volume_id`, el `schedule_id` y el `type`. En [Backups programados](/docs/api/scheduled-backups) están los detalles.

## Retención {#retention}

Una programación conserva las `backup_quantity` copias más recientes (por defecto, 5) de cada volumen vinculado a ella, y borra las más antiguas a medida que llegan copias nuevas; `outside_backup_quantity` (por defecto, 1) hace lo mismo con las copias de cada almacenamiento externo. Las copias que haces bajo demanda se quedan hasta que las borras.

Para dejar una copia fuera de esa rotación, ponle `permanent: true`, al hacerla o más tarde con `PATCH /api/v1/backup_restore/volume_backups/{volume_backup_id}`.

Borra una copia con `DELETE /api/v1/backup_restore/volume_backups/single/{volume_backup_id}`, o varias con `DELETE /api/v1/backup_restore/volume_backups/bulk` y sus ids en el parámetro de consulta `backup_ids`.

## Restauración {#restore}

Restaura un snapshot con `POST /api/v1/backup_restore/volume_backups/snapshot_restore`, y un backup con `POST /api/v1/backup_restore/volume_backups/backup_restore`. Ambos reciben `{"backup_id": "…"}`, ponen el trabajo en cola y responden enseguida. La copia debe estar `completed` y ser del tipo del endpoint; si no, la llamada responde `409`.

Una restauración se hace en su sitio. Crea un volumen nuevo a partir de la copia, del mismo tamaño y en la misma zona de disponibilidad que el original, y lo pone donde estaba el original:

- Un volumen de datos se desconecta de su VM, y el volumen restaurado se conecta en su lugar.
- En el caso del volumen de arranque de una VM, la VM se reconstruye sobre el disco restaurado. La VM nueva asume los puertos y las IPs flotantes de la antigua, y la VM antigua se borra. La VM recibe un `id` nuevo; el disco restaurado conserva las claves SSH que tenía.

Las copias y las vinculaciones a programaciones del volumen original pasan al volumen restaurado.

## Próximos pasos {#next-steps}

- [Backups programados](/docs/api/scheduled-backups) — haz copias según un calendario.
- [Almacenamiento en bloques](/docs/api/block-storage) — los volúmenes de los que salen estas copias.
- [Máquinas virtuales](/docs/api/vms) — lo que reconstruye la restauración de un volumen de arranque.
