---
title: "Máquinas virtuales"
description: "Provisiona, inspecciona, redimensiona y destruye VMs. Referencia de endpoints en vivo generada automáticamente a partir de la especificación OpenAPI."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Máquinas virtuales

Una máquina virtual de NimbusNexus es una instancia de cómputo medida — un árbol de procesos, una interfaz de red, un disco raíz — que se factura por segundos. Para crear una, eliges un tamaño y una región; todo lo demás (volúmenes de bloques, IPs públicas, snapshots) se le conecta como recursos aparte.

## Cuándo usar una VM {#when-to-use}

Las VMs son la primitiva adecuada cuando necesitas:

- Estado persistente en disco entre peticiones (una base de datos, una caché de compilación, un worker de colas de larga duración).
- Control total del SO — instalar paquetes, ajustar parámetros del kernel, ejecutar cualquier cosa que necesite acceso al sistema.
- Una configuración de instancia concreta — mucha memoria para una carga de trabajo de analítica, GPU para inferencia, optimizada para cómputo para un servicio limitado por CPU.

Si tu carga de trabajo es **sin estado y basada en peticiones**, las plataformas de contenedores (servicios gestionados de Kubernetes, entornos serverless) suelen encajar mejor. La línea es, a grandes rasgos: si te disgustaría que un reinicio del proceso borrara los archivos locales, lo que quieres es una VM.

## Tamaños, familias y nombres {#sizes}

Los tamaños usan el formato `<family>-<vCPU>-<RAM_GB>`. Hoy hay tres familias:

- `gp-*` — uso general. CPU + RAM equilibradas. La mayoría de las cargas de trabajo empiezan aquí.
- `co-*` — optimizada para cómputo. 2× la CPU por dólar de `gp`, la mitad de RAM por dólar.
- `mo-*` — optimizada para memoria. El compromiso inverso. Adecuada para cachés en memoria, heaps de la JVM, espacio temporal de analítica.

Así, `gp-4-16` es 4 vCPU, 16 GB de RAM, uso general. `co-16-32` es 16 vCPU, 32 GB de RAM, optimizada para cómputo. La lista completa está en `GET /v1/vms/sizes` (todavía no se genera automáticamente en esta referencia — próximamente).

## Ciclo de vida {#lifecycle}

Una VM pasa por estos estados:

- `provisioning` — se está preparando el disco y el hipervisor está asignando la instancia. ~5–30 segundos con una imagen en caché, hasta 90 segundos la primera vez que se descarga una imagen.
- `running` — arranque completado, la instancia acepta tráfico. Es el estado estable en el que pasarás la mayor parte del tiempo.
- `stopping` → `stopped` — apagado ordenado. La VM persiste; dejas de pagar el cómputo, pero se te sigue facturando el almacenamiento.
- `terminated` — la VM se ha destruido. Los volúmenes de bloques conectados también se han destruido (el comportamiento por defecto) o se han desconectado y siguen disponibles (si se indicó `preserve_volumes: true` al borrar).

Las transiciones de estado se devuelven en el campo `state` en cada `GET`. Las transiciones de larga duración informan de su progreso en un objeto `operation` incrustado — consulta la página [Convenciones](/docs/conventions) para ver el patrón de polling de operaciones que se usa aquí y en el resto de la API.

## Nombres e ids estables {#ids}

Cada VM tiene dos identificadores:

- `id` — opaco, con el prefijo `vm_` y un sufijo base32 de 26 caracteres. Estable durante toda la vida de la VM. Úsalo en URLs, claves foráneas y registros de auditoría.
- `name` — legible por personas, 1–63 caracteres, alfanumérico + guiones, único dentro de un proyecto. Se puede cambiar con `PUT /v1/vms/{id}`. No lo pongas en ninguna ruta de código que no quieras reescribir el día que alguien cambie el nombre de la VM.

La referencia de endpoints de abajo usa `{id}` en las plantillas de ruta; el valor que pasas es el id opaco.
