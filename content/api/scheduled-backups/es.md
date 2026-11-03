---
title: "Backups programados"
description: "Programaciones de backups recurrentes — diarias, semanales o mensuales. Independientes de los backups bajo demanda."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: scheduled-backups
---

# Backups programados

Los [backups](/docs/api/backups) bajo demanda cubren el caso de "quiero un snapshot de este volumen ahora mismo". Los backups programados hacen copias de un volumen según un calendario y conservan las más recientes.

Una programación tiene una `frequency` y una `backup_quantity`, el número de copias que se conservan (por defecto, 5). Una programación `daily` se ejecuta cada día; `weekly`, cada 7 días, y `monthly`, cada 30 días, contados desde el día en que se creó la programación. Crea una con `POST /api/v1/backup_restore/backup_scheduler/`; pertenece a tu workspace. Después vincúlala a cada volumen con `POST /api/v1/backup_restore/volume_scheduler/`, indicando el `volume_id`, el `schedule_id` y el `type` de copia, `snapshot` o `backup`. La vinculación responde `409` si las copias no caben en tu cuota de backups.

Para enviar también las copias `backup` a un almacenamiento externo, activa `use_outside_storage` en la vinculación y enlaza el almacenamiento con `POST /api/v1/backup_restore/volume_scheduler/config-storage` (`config_id`, `storage_id`, `priority`). La `outside_backup_quantity` de la programación (por defecto, 1) fija cuántas copias se conservan allí.

El programador se ejecuta en segundo plano. Una ejecución fallida se reintenta, y una que sigue fallando envía una [notificación](/docs/api/notifications). Para conservar una copia más allá de la rotación, como una copia de fin de año, ponle `permanent: true` con `PATCH /api/v1/backup_restore/volume_backups/{volume_backup_id}`.

## Próximos pasos {#next-steps}

- [Backups](/docs/api/backups) — la contraparte bajo demanda y el tipo de recurso que generan las programaciones.
- [Almacenamiento en bloques](/docs/api/block-storage) — los volúmenes que copian las programaciones.
