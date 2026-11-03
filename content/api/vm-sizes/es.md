---
title: "Tamaños de VM"
description: "Flavors de cómputo — vCPUs, RAM y swap — y cómo obtiene uno una VM."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Tamaños de VM

Un tamaño de VM es un flavor: un número de vCPUs (`vcpus`), la RAM en MB (`ram`) y el swap en MB (`swap`). No eliges un flavor al crear una VM: fijas `spec.cpu` y `spec.ram`, y la API usa un flavor con exactamente esos números, y crea uno si no existe ninguno. El disco de arranque no forma parte del flavor; es un volumen aparte.

## Arquitectura y clase de VM {#families}

Además de `cpu` y `ram`, el `spec` de una VM indica una `architecture` y una `vm_class`. Juntas determinan el producto con el que se factura la VM. Las que se ofrecen en la región de tu sesión están en `vm_options` de `GET /api/v1/instance/artifacts`.

## Convención de nombres {#naming}

Lee la configuración de un flavor en `vcpus`, `ram` y `swap`, no en su nombre. Un flavor que la API crea para una VM lleva como nombre su `id`, un UUID, y lo mismo ocurre con uno creado con `POST /api/v1/flavor/` sin `name`. `GET /api/v1/flavor/` filtra por la configuración con `min_vcpus`, `max_vcpus`, `min_ram`, `max_ram`, `min_swap` y `max_swap`.

Los precios dependen de la `architecture`, la `vm_class`, la `cpu` y la `ram`; consulta [Datos de precios](/docs/api/pricing-data).

## Redimensionado {#resizing}

Una VM puede cambiar de tamaño sin volver a provisionarse. Envía `POST /api/v1/instance/{instance_id}/resize` con un `spec` nuevo (`architecture`, `vm_class`, `cpu`, `ram`). La VM se reinicia en el flavor nuevo y espera en `VERIFY_RESIZE`: `POST /api/v1/instance/{instance_id}/confirm_resize` conserva el tamaño nuevo, y `POST /api/v1/instance/{instance_id}/revert_resize` vuelve al anterior. Ambas responden `400` si la VM no está en `VERIFY_RESIZE`.

## Próximos pasos {#next-steps}

- [Máquinas virtuales](/docs/api/vms) — los endpoints que provisionan de verdad una VM con uno de estos tamaños.
- [Imágenes de VM](/docs/api/vm-images) — las plantillas de SO con las que arrancas la VM.
- [Claves SSH](/docs/api/ssh-keys) — claves públicas inyectadas en las VMs al arrancar.
