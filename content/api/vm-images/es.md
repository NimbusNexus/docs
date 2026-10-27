---
title: "Imágenes de VM"
description: "Imágenes de arranque del SO — plantillas públicas e imágenes personalizadas del proyecto."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Imágenes de VM

Una imagen de VM es la plantilla de SO con la que se arranca el disco raíz de una VM nueva. NimbusNexus ofrece **imágenes públicas** de las principales distribuciones de Linux y de Windows Server; también puedes subir tus propias **imágenes personalizadas**, creadas con herramientas como Packer o haciendo un snapshot de una VM ya configurada.

## Imágenes públicas {#public-images}

El catálogo público se actualiza cada mes con parches de seguridad. Los slugs se mantienen estables entre parches; descargar `ubuntu-24.04` hoy y otra vez dentro de 6 meses te da 6 meses de parches aplicados sobre la misma base. Fija un slug con fecha (p. ej. `ubuntu-24.04-20260301`) si necesitas arranques reproducibles byte a byte.

Slugs publicados actualmente:

- `ubuntu-24.04`, `ubuntu-22.04`, `ubuntu-20.04`
- `debian-12`, `debian-11`
- `fedora-40`, `fedora-39`
- `rocky-9`, `rocky-8`
- `almalinux-9`, `almalinux-8`
- `windows-2022`, `windows-2019`

Todas las imágenes públicas incluyen nuestra configuración mínima de cloud-init: las claves SSH inyectadas a partir de las claves registradas en el proyecto (consulta [Claves SSH](/docs/api/ssh-keys)), `apt-get update` o equivalente en el primer arranque y el servicio de metadatos fijado en `169.254.169.254`.

## Imágenes personalizadas {#custom-images}

Se aceptan imágenes propias en archivos **raw**, **qcow2** o **vmdk** de hasta **128 GB** sin comprimir. Al subirla, la imagen se convierte a nuestro formato interno (~1–3 minutos por GB) y después pasa a ser una imagen arrancable normal para cualquier VM de la misma región.

Las imágenes personalizadas se facturan a \$0.013/GB·mes (la tarifa de la clase Standard del almacenamiento de objetos) por el almacenamiento. No hay un tier aparte de "almacenamiento de imágenes".

## Regiones {#regions}

Las imágenes públicas están disponibles en todas las regiones activas. Las imágenes personalizadas son de alcance regional — subirlas a `us-east-1` no hace que la imagen sea arrancable en `eu-central-1` si no se copia. Usa `POST /v1/vm-images/{id}/copy` (no aparece en la referencia de abajo — próximamente) para replicarla.

## Próximos pasos {#next-steps}

- [Máquinas virtuales](/docs/api/vms) — provisiona una VM con una de estas imágenes.
- [Tamaños de VM](/docs/api/vm-sizes) — la configuración de cómputo en la que arranca la imagen.
- [Snapshots](/docs/api/snapshots) — captura una VM existente como snapshot y conviértelo después en una imagen personalizada.
