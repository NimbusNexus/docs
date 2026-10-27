---
title: "Snapshots"
description: "Copias en un momento dado de VMs, volúmenes de bloques y bases de datos gestionadas."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Snapshots

Un snapshot es una copia en un momento dado de un recurso de origen — una VM, un volumen de bloques o una base de datos gestionada — que se escribe en el almacenamiento de objetos. Los snapshots sobreviven a su origen: borrar una VM no borra sus snapshots. Restaurar un snapshot crea un recurso **nuevo**; el original nunca se modifica.

## Tres tipos de origen {#source-kinds}

| Tipo de origen | Qué se captura                                                                                              | Destino de la restauración                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `vm`           | Disco raíz + estado de los volúmenes conectados en un momento consistente                                   | Una VM nueva del mismo tamaño o mayor, en cualquier región              |
| `volume`       | Contenido del volumen de bloques en un momento consistente                                                  | Un volumen de bloques nuevo del mismo tamaño o mayor, en cualquier región |
| `database`     | Snapshot lógico a nivel de motor (barrera del WAL de Postgres / MySQL, punto del oplog de MongoDB, etc.)    | Una base de datos nueva del mismo motor + versión                       |

El campo `source_kind` del snapshot te dice de cuál se trata; el endpoint de restauración lo envía al backend correcto según este campo.

## Cómo se consigue la consistencia de un snapshot {#consistency}

- **Los snapshots de volúmenes** detienen la cola de E/S, hacen un snapshot en la capa de bloques (~10 segundos) y siguen copiando en segundo plano. La VM sigue en marcha; las escrituras en curso posteriores al punto del snapshot quedan en el estado posterior al snapshot.
- **Los snapshots de VMs** hacen un snapshot del disco raíz + todos los volúmenes conectados de forma atómica. Si has configurado hooks previos/posteriores al snapshot (scripts de cloud-init que vacían los búferes de una aplicación), se ejecutan en línea.
- **Los snapshots de bases de datos** usan el mecanismo de consistencia nativo del motor. Quien llama no tiene que detener la E/S; la barrera del log de commits de la propia base de datos garantiza que puedes restaurar a un punto consistente a nivel transaccional.

Para aplicaciones que necesitan consistencia a nivel de aplicación (p. ej. una base de datos Postgres alojada en una VM, no en las bases de datos gestionadas), usa preferentemente la API de snapshots de la propia base de datos en lugar de un snapshot de volumen.

## Almacenamiento + retención {#storage}

Los snapshots se guardan en el tier frío (\$0.04/GB·mes, deduplicados respecto a los snapshots anteriores del mismo origen). La retención es por defecto de **7 días**; pasa `retention_days` al crearlo para ampliarla hasta 365 días.

La deduplicación significa esto: una serie de snapshots diarios de la misma VM ocupa aproximadamente el tamaño de la VM original más el delta diario — no N× el tamaño de la VM. El coste en régimen estable de una política de snapshots diarios con 30 días de retención sobre una VM de 100 GB suele ser de 130–160 GB en total, según cuánto cambie.

## Semántica de la restauración {#restore}

La restauración crea un **recurso nuevo** a partir del snapshot. El recurso de origen (si sigue existiendo) no se ve afectado. Las VMs restauradas reciben un id nuevo, una IP nueva y una nueva inyección de claves SSH con las claves actuales del proyecto (el conjunto de claves original no se conserva — restaurar una VM antigua después de una rotación de claves te da VMs a las que no pueden acceder las claves antiguas ya eliminadas).

Se admite la restauración entre regiones. La transferencia interna de datos para la copia del snapshot se mide como egress entre regiones (\$0.005/GB) la primera vez; las restauraciones posteriores en la región de destino no repiten la transferencia.

## Próximos pasos {#next-steps}

- [Máquinas virtuales](/docs/api/vms) — el ciclo de vida de las VMs que capturan los snapshots.
- [Almacenamiento en bloques](/docs/api/block-storage) — los snapshots de volúmenes en concreto.
- [Bases de datos gestionadas](/docs/api/managed-databases) — snapshots específicos de bases de datos mediante el endpoint propio de la base de datos.
- [Almacenamiento en frío](/docs/api/cold-storage) — el tier en el que se guardan los snapshots.
