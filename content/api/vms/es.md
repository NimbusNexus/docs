---
title: "Máquinas virtuales"
description: "Provisiona, inspecciona, redimensiona y destruye VMs. Referencia de endpoints en vivo generada automáticamente a partir de la especificación OpenAPI."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Máquinas virtuales

Una máquina virtual de NimbusNexus es una instancia de cómputo con un disco de arranque y una interfaz de red por cada red a la que se une. Creas una con `POST /api/v1/instance/` en la región de tu sesión; todo lo demás (volúmenes de bloques, IPs públicas) se le conecta como recursos aparte.

## Cuándo usar una VM {#when-to-use}

Las VMs son la primitiva adecuada cuando necesitas:

- Estado persistente en disco entre peticiones (una base de datos, una caché de compilación, un worker de colas de larga duración).
- Control total del SO — instalar paquetes, ajustar parámetros del kernel, ejecutar cualquier cosa que necesite acceso al sistema.
- Una configuración de instancia concreta — el número de vCPUs y la RAM que necesita tu carga de trabajo.

Si tu carga de trabajo es **sin estado y basada en peticiones**, las plataformas de contenedores (servicios gestionados de Kubernetes, entornos serverless) suelen encajar mejor. La línea es, a grandes rasgos: si te disgustaría que un reinicio del proceso borrara los archivos locales, lo que quieres es una VM.

## Configuración y creación {#sizes}

`POST /api/v1/instance/` recibe un `name` y un `spec` que fija la configuración de la VM: `architecture` y `vm_class`, `cpu` (vCPUs) y `ram` (MB), y el `volume_type` de su disco de arranque (consulta [Almacenamiento en bloques](/docs/api/block-storage#tiers)). También necesita una `image` (o `volumes` de arranque), al menos una `network` y al menos un `security_group`. Entre los campos opcionales están `sshs` (la [clave SSH](/docs/api/ssh-keys) que se instala), `volume_size` (el tamaño del disco de arranque en GB cuando arrancas desde `image`; por defecto, 5), `user_data`, `metadata` y `subscription`. Unirse a una red de proveedor también necesita `bandwidth_mbps` y `subscription.bandwidth`; sin ellos, la llamada responde `400`.

No hay códigos de tamaño. `GET /api/v1/instance/artifacts` lista las opciones de `architecture` y `vm_class` para la región de tu sesión en `vm_options`, junto con las imágenes, redes, grupos de seguridad, claves SSH, grupos de servidores y volúmenes que puedes usar. La VM se ejecuta en un [flavor](/docs/api/vm-sizes) con exactamente tu `cpu` y tu `ram`; la API crea uno si no existe ninguno. Los precios están en [Datos de precios](/docs/api/pricing-data).

## Ciclo de vida {#lifecycle}

Crear una VM es asíncrono: `POST /api/v1/instance/` pone el trabajo en cola y responde `{"success": true}`, sin ningún id. Busca la VM nueva en `GET /api/v1/instance/` y sigue su `status`, el valor propio del servicio de cómputo. Los que verás más a menudo:

- `BUILD` — se está creando la VM.
- `ACTIVE` — en ejecución.
- `SHUTOFF` — detenida.
- `VERIFY_RESIZE` — redimensionada, a la espera de que confirmes o reviertas el cambio (consulta [Tamaños de VM](/docs/api/vm-sizes#resizing)).
- `ERROR` — algo ha fallado; `fault` indica qué.

`POST /api/v1/instance/action` inicia, detiene o borra VMs: indica sus ids en `servers` y pon `cmd` a `start`, `stop` o `delete`. Una VM detenida se sigue facturando: la facturación va desde la creación hasta el borrado, con el plan de `subscription.vm` (por defecto, `Monthly`). Borrar una VM borra el volumen de arranque creado a partir de su imagen; los volúmenes pasados en `volumes`, o conectados más tarde, quedan `available`.

## Nombres e ids estables {#ids}

Cada VM tiene dos identificadores:

- `id` — el UUID de la VM. Estable durante toda la vida de la VM. Úsalo en URLs, claves foráneas y registros de auditoría.
- `name` — legible por personas, cualquier cadena no vacía. Cámbialo, o cambia la `description`, con `PATCH /api/v1/instance/{instance_id}`. No lo pongas en ninguna ruta de código que no quieras reescribir el día que alguien cambie el nombre de la VM.

La referencia de endpoints de abajo usa `{instance_id}` en las plantillas de ruta (`{server_id}` en los endpoints de [Interfaces de VM](/docs/api/vm-interfaces)); el valor que pasas es el `id` de la VM.
