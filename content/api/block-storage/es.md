---
title: "Almacenamiento en bloques"
description: "Volúmenes NVMe persistentes conectados a VMs. Tres tiers, redimensionado en caliente y snapshots."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Almacenamiento en bloques

Los volúmenes de bloques son discos NVMe persistentes que conectas a VMs. Cada volumen vive en una sola región; sobrevive a la VM a la que está conectado (puedes desconectarlo + volver a conectarlo a una VM nueva); se puede redimensionar sin downtime; y se le pueden hacer snapshots en el almacenamiento de objetos bajo demanda.

## Tiers {#tiers}

| Tier          | Por GB·mes | Throughput | IOPS (pico) | Cuándo usarlo                                                                                                       |
| ------------- | ---------- | ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `standard`    | \$0.11     | 250 MB/s   | 3.000       | Discos raíz, bases de datos de desarrollo, cualquier cosa que quieras mantener barata.                              |
| `performance` | \$0.18     | 1.000 MB/s | 16.000      | Discos de bases de datos de producción, cachés de compilación, datos calientes. **Por defecto en las bases de datos gestionadas.** |
| `extreme`     | \$0.30     | 4.000 MB/s | 64.000      | Cargas de trabajo sensibles a la latencia — servir anuncios, espacio temporal de analítica, cualquier cosa cuyo cuello de botella sea el disco. |

Los tres tiers usan el mismo hardware NVMe; las diferencias están en la QoS de planificación, no en el soporte físico. Puedes redimensionar **y** cambiar de tier sin downtime — empieza en Standard, sube a Performance cuando superes el presupuesto de IOPS y vuelve a bajar si el consumo se estabiliza.

## Ciclo de vida {#lifecycle}

Los volúmenes pasan por cuatro estados:

- `available` — creado pero no conectado. Se factura igual que si estuviera conectado (al almacenamiento le da igual).
- `attached` — vinculado a una VM. Visible dentro de la VM como dispositivo de bloques (`/dev/sdb`, `/dev/sdc`, …).
- `detaching` → `available` — desconectándose de una VM. El desmontaje se hace en el servidor; asegúrate antes de que el sistema de archivos haya volcado sus datos a disco.
- `deleted` — destruido. **No se puede recuperar.** Haz antes un snapshot si quieres un backup recuperable.

Desconectar es una llamada distinta de borrar. A propósito, no borramos automáticamente un volumen cuando se destruye la VM a la que está conectado — perder el disco de una base de datos porque un compañero ha destruido la VM equivocada es justo el tipo de desastre que la API debería hacer difícil de cometer por accidente.

## Redimensionado {#resize}

`POST /v1/volumes/{id}/resize` con `{ "size_gb": 500 }` amplía un volumen. El disco crece en caliente; el sistema de archivos de dentro de la VM necesita una llamada aparte a `resize2fs` / `xfs_growfs` para ocupar el espacio nuevo. Documentamos ese paso en las [guías de VM](/docs/api/vms) de cada SO.

No se puede reducir en caliente. Para hacerlo más pequeño: haz un snapshot, crea un volumen nuevo más pequeño a partir del snapshot, conecta el nuevo, copia los datos y desconecta el antiguo. Es fácil de automatizar con un script; no lo ofrecemos integrado porque es demasiado fácil perder datos por error.

## Snapshots {#snapshots}

Los snapshots son copias en un momento dado que se guardan en el almacenamiento de objetos (la clase `cold` — barata; se recupera bajo demanda cuando restauras).

- Se lanzan con `POST /v1/volumes/{id}/snapshots`.
- Tardan ~10 segundos en alcanzar el punto de consistencia y después siguen copiándose en segundo plano.
- Se almacenan a \$0.04/GB·mes.
- Se pueden restaurar en un volumen nuevo del **mismo tamaño o mayor**, en cualquier región (restaurar en otra región cuenta como egress entre regiones, a \$0.005/GB).

El snapshot es consistente en la capa de bloques, no en la capa de aplicación. Para bases de datos, usa preferentemente la API de snapshots de la propia base de datos (consulta [Bases de datos gestionadas](/docs/api/managed-databases)) — esos snapshots detienen las escrituras a nivel de motor. Los snapshots de la capa de bloques son adecuados para volúmenes con sistemas de archivos que no ejecutan un motor transaccional.

## Semántica de conexión {#attach}

Un volumen se puede conectar a **una sola VM a la vez**. No se admite la conexión múltiple (semántica de disco compartido) — coordinar a nivel de aplicación el acceso a un volumen NVMe compartido es más difícil de lo que la API haría parecer, y preferimos no construir esa trampa.

La conexión es de alcance regional: un volumen en `us-east-1` no se puede conectar a una VM en `eu-central-1`. Snapshot + restauración es el patrón adecuado para mover datos entre regiones.

## Notas sobre precios {#pricing}

- Almacenamiento: por GB·mes, facturado por segundos. La clase de almacenamiento (Standard/Performance/Extreme) determina la tarifa; el tamaño determina el multiplicador.
- Snapshots: \$0.04/GB·mes, facturado según el tamaño del contenido del snapshot (deduplicado entre los snapshots del mismo volumen).
- Replicación entre regiones: \$0.005/GB·mes por la copia replicada, más el egress entre regiones estándar de la sincronización inicial.
- Sin precios por IOPS. Sin cargo por conexión. Sin recargo por throughput.

## Próximos pasos {#next-steps}

- [Máquinas virtuales](/docs/api/vms) — a lo que conectas los volúmenes.
- [Almacenamiento de objetos](/docs/api/object-storage) — para datos no estructurados que no necesitan acceso a nivel de bloque (logs, backups, archivos que suben los usuarios). Más barato a gran escala.
- [Convenciones](/docs/conventions) para el polling de operaciones, la idempotencia y los formatos de error.
