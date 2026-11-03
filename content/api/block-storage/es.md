---
title: "Almacenamiento en bloques"
description: "Volúmenes persistentes para VMs — crea, conecta, desconecta, amplía y borra."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Almacenamiento en bloques

Los volúmenes de bloques son discos persistentes que conectas a VMs. Cada volumen vive en la región de tu sesión; un volumen de datos sobrevive a la VM a la que está conectado (puedes desconectarlo + volver a conectarlo a una VM nueva); los volúmenes se pueden ampliar; y puedes hacer un snapshot o un backup de uno a través de [Backups](/docs/api/backups).

## Tipos de volumen {#tiers}

`GET /api/v1/storage/artifacts` lista lo que puedes crear en la región de tu sesión: los tipos de volumen en `types` y las opciones de almacenamiento con precio en `volume_options`. `POST /api/v1/storage/` recibe el `size` en GB y el `volume_type`, una de las etiquetas de `volume_options`, que fija el precio. Los campos opcionales son un `type` de `types`, un `name`, una `description`, una `image` a partir de la que crear el volumen y `subscription`, el plan de facturación (por defecto, `Hourly`).

Un volumen conserva su tipo durante toda su vida: no hay ninguna llamada para cambiarlo. Los precios por `volume_type` están en [Datos de precios](/docs/api/pricing-data).

## Ciclo de vida {#lifecycle}

`POST /api/v1/storage/` pone el trabajo en cola y responde sin ningún id; el volumen nuevo aparece en `GET /api/v1/storage/`. Su `status` viene del servicio de almacenamiento en bloques. Los que verás más a menudo:

- `available` — creado pero no conectado. Se factura igual que si estuviera conectado (al almacenamiento le da igual).
- `in-use` — vinculado a una VM. Visible dentro de la VM como dispositivo de bloques (`/dev/vdb`, `/dev/vdc`, …).
- `detaching` → `available` — desconectándose de una VM. Desmonta el sistema de archivos dentro de la VM antes de desconectarlo.

Desconectar es una llamada distinta de borrar. Borrar una VM borra el volumen de arranque creado a partir de su imagen; los volúmenes que conectaste, o que pasaste en `volumes` al crear la VM, quedan `available`.

`DELETE /api/v1/storage/` destruye los volúmenes cuyos ids indicas en `ids`. Un volumen borrado **no se puede recuperar**, así que haz antes un backup si quieres una copia recuperable. Con `cascade: true`, los snapshots del volumen se borran junto con él.

## Redimensionado {#resize}

`POST /api/v1/storage/resize` con `{"volume_id": "…", "new_size": 500}` amplía un volumen a 500 GB. `new_size` debe ser mayor que el tamaño actual; cualquier otro valor responde `400`. El sistema de archivos de dentro de la VM necesita una llamada aparte a `resize2fs` / `xfs_growfs` para ocupar el espacio nuevo.

No se puede reducir. Para hacerlo más pequeño: crea un volumen nuevo más pequeño, conéctalo, copia los datos y desconecta el antiguo.

## Snapshots {#snapshots}

Los snapshots y los backups de un volumen se hacen a través de [Backups](/docs/api/backups): `POST /api/v1/backup_restore/volume_backups/create_backup` con el `volume_id` y `type: snapshot` (una copia en un momento dado que se guarda con el volumen) o `type: backup` (una copia completa aparte).

El snapshot es consistente en la capa de bloques, no en la capa de aplicación. Para una base de datos, pausa antes las escrituras o usa la herramienta de backup de la propia base de datos. Los snapshots de la capa de bloques son adecuados para volúmenes con sistemas de archivos que no ejecutan un motor transaccional.

Una restauración vuelve a poner la copia en lugar del volumen, con el mismo tamaño; consulta [Backups](/docs/api/backups#restore).

## Semántica de conexión {#attach}

Un volumen se puede conectar a **una sola VM a la vez**. No se admite la conexión múltiple (semántica de disco compartido).

`POST /api/v1/storage/attach` recibe el `volume_id`, el `instance_id` y, de forma opcional, un `mountpoint`; sin él, el volumen recibe el primer dispositivo libre a partir de `/dev/vdb`. `POST /api/v1/storage/detach` recibe el `instance_id`, el `volume_id` y el `attachment_id`, que `GET /api/v1/storage/detach_artifacts` lista para una VM.

Un volumen y la VM a la que se conecta están ambos en la región de tu sesión.

## Notas sobre precios {#pricing}

- Almacenamiento: se factura por GB al precio del `volume_type` del volumen, con el plan de `subscription`. Los precios están en [Datos de precios](/docs/api/pricing-data).
- Sin precios por IOPS. Sin cargo por conexión. Sin recargo por throughput.

## Próximos pasos {#next-steps}

- [Máquinas virtuales](/docs/api/vms) — a lo que conectas los volúmenes.
- [Almacenamiento de objetos](/docs/api/object-storage) — para datos no estructurados que no necesitan acceso a nivel de bloque (logs, backups, archivos que suben los usuarios).
- [Backups](/docs/api/backups) — snapshots y backups de un volumen, y su restauración.
