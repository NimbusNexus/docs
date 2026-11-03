---
title: "Imágenes de VM"
description: "Imágenes de arranque del SO — plantillas públicas e imágenes personalizadas del proyecto."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Imágenes de VM

Una imagen de VM es la plantilla de SO con la que se arranca el disco raíz de una VM nueva. NimbusNexus ofrece **imágenes públicas**, y puedes subir tus propias **imágenes personalizadas**, creadas con herramientas como Packer.

## Imágenes públicas {#public-images}

`GET /api/v1/image/` lista las imágenes que puedes usar; `visibility=public` acota la lista a las públicas. Una imagen se identifica por su `id`, un UUID, y eso es lo que pasas como `image` al crear una VM. Los nombres son etiquetas, no slugs con versión, así que busca el `id` en lugar de fijar un nombre en el código.

Cuando una VM arranca, recibe la clave SSH que indicaste en `sshs` (consulta [Claves SSH](/docs/api/ssh-keys)) y los `user_data` que hayas pasado; una imagen con cloud-init los aplica en el primer arranque.

## Imágenes personalizadas {#custom-images}

Una imagen personalizada requiere dos llamadas:

1. `POST /api/v1/image/` crea el registro de la imagen a partir de un `name` (de al menos 5 caracteres), un `disk_format` y un `container_format`, y devuelve su `id`. De forma opcional, fija `visibility` (por defecto, `private`: solo tu proyecto) y `subscription`, el plan de facturación (por defecto, `Hourly`).
2. `POST /api/v1/image/file` sube el archivo, con los campos multipart `file` e `image_id`. O bien `POST /api/v1/image/import` con `{"id": "…", "url": "…"}` descarga la imagen desde una URL.

Las extensiones de archivo admitidas son `.img`, `.qcow2`, `.vmdk`, `.vhd`, `.vhdx`, `.raw`, `.iso`, `.ami`, `.ari`, `.aki` y `.vdi`; cualquier otra extensión responde `400`.

Las imágenes personalizadas se facturan por GB, redondeando hacia arriba al GB entero, como un producto propio, con el plan de `subscription`; consulta [Datos de precios](/docs/api/pricing-data).

## Regiones {#regions}

Las llamadas de imágenes funcionan en la región de tu sesión. No hay ninguna llamada para copiar una imagen a otra región.

## Próximos pasos {#next-steps}

- [Máquinas virtuales](/docs/api/vms) — provisiona una VM con una de estas imágenes.
- [Tamaños de VM](/docs/api/vm-sizes) — la configuración de cómputo en la que arranca la imagen.
- [Backups](/docs/api/backups) — snapshots y backups de los volúmenes de una VM.
