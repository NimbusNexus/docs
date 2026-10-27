---
title: "Backups programados"
description: "Programaciones de backups recurrentes — diarias, semanales o personalizadas. Independientes de los backups bajo demanda."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: scheduled-backups
---

# Backups programados

Los [backups](/docs/api/backups) bajo demanda cubren el caso de "quiero un snapshot de este volumen ahora mismo". Los backups programados cubren todo lo demás: backups nocturnos de todos los volúmenes de producción, backups completos semanales combinados con incrementales diarios, snapshots mensuales conservados durante un año por cumplimiento normativo.

Una programación es un pequeño documento JSON — elige un objetivo (un volumen, una VM, una base de datos), una frecuencia (estilo cron), una política de retención (conservar los N más recientes o caducar a los X días) y una política de almacenamiento (qué región/clase de almacenamiento de backups). El programador se ejecuta en segundo plano; las ejecuciones fallidas se reintentan con backoff y aparecen en el log de ejecuciones de la programación.

La mayoría de las cuentas de producción usan 2–4 programaciones: diaria conservando 14, semanal conservando 8, mensual conservando 12 y, a veces, un snapshot de fin de año que se conserva 7 años por motivos financieros/legales.

## Próximos pasos {#next-steps}

- [Backups](/docs/api/backups) — la contraparte bajo demanda y el tipo de recurso que generan las programaciones.
- [Almacenamiento en bloques](/docs/api/block-storage) y [Snapshots](/docs/api/snapshots) — los orígenes de los backups.
- [Bases de datos gestionadas](/docs/api/managed-databases) — tiene su propio modelo de retención; no usa las programaciones de este endpoint.
