---
title: "Tamaños de VM"
description: "Catálogo de configuraciones de cómputo de las familias gp, co, mo y gx."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Tamaños de VM

Un tamaño de VM es una configuración de cómputo con nombre — número de vCPU, RAM, tamaño del disco raíz y familia. Cada VM se crea con un código de tamaño (p. ej. `gp-4-16`); redimensionar una VM cambia el código en tiempo de ejecución.

## Las cuatro familias {#families}

| Familia                     | Prefijo del código | Para qué está optimizada                                                                                                          |
| --------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **Uso general**             | `gp-*`             | CPU + RAM equilibradas. La opción por defecto para la mayoría de las cargas de trabajo.                                           |
| **Optimizada para cómputo** | `co-*`             | 2× la CPU por dólar de `gp`, la mitad de RAM por dólar. Adecuada para servicios limitados por CPU, jobs por lotes, codificación de vídeo. |
| **Optimizada para memoria** | `mo-*`             | El compromiso inverso. Adecuada para cachés en memoria, heaps de la JVM, espacio temporal de analítica.                           |
| **GPU**                     | `gx-*`             | Aceleradores NVIDIA L4 / H100. Inferencia y entrenamiento de ML, transcodificación.                                               |

## Convención de nombres {#naming}

Los códigos de tamaño siguen el formato `<family>-<vCPU>-<RAM_GB>`. Así:

- `gp-1-2` — 1 vCPU, 2 GB de RAM, uso general (el tamaño útil más pequeño, ~\$0.0145/vCPU-hora)
- `gp-4-16` — 4 vCPU, 16 GB de RAM, uso general
- `co-16-32` — 16 vCPU, 32 GB de RAM, optimizada para cómputo
- `mo-8-64` — 8 vCPU, 64 GB de RAM, optimizada para memoria
- `gx-4-32-l4` — 4 vCPU, 32 GB de RAM, 1× GPU L4 (los tamaños con GPU añaden al final el código del acelerador)

El endpoint del catálogo devuelve la lista completa con el precio actual de cada tamaño. Los precios varían ligeramente entre regiones; la respuesta incluye una tabla de precios por región.

## Redimensionado {#resizing}

Una VM puede cambiar de tamaño sin volver a provisionarse. Redimensionar dentro de la misma familia se hace en caliente (sin downtime). Redimensionar a otra familia requiere un ciclo de detener / arrancar. Redimensionar entre arquitecturas (p. ej. de `gp` a `gx`) implica destruir / volver a crear — la API rechaza la llamada directa de redimensionado para que la pérdida de datos implícita sea explícita.

## Próximos pasos {#next-steps}

- [Máquinas virtuales](/docs/api/vms) — los endpoints que provisionan de verdad una VM con uno de estos tamaños.
- [Imágenes de VM](/docs/api/vm-images) — las plantillas de SO con las que arrancas la VM.
- [Claves SSH](/docs/api/ssh-keys) — claves públicas inyectadas en las VMs al arrancar.
