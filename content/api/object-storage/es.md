---
title: "Almacenamiento de objetos"
description: "Contenedores y objetos de tu proyecto, con opciones de lectura pública y credenciales de corta duración."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Almacenamiento de objetos

El almacenamiento de objetos de NimbusNexus guarda archivos como objetos en contenedores que pertenecen a tu proyecto. Gestionas ambos a través de `/api/v1/object_storage/`, con las mismas credenciales que el resto de la API.

## Contenedores {#containers}

`POST /api/v1/object_storage/` crea un contenedor. Pon `public_read: true` para que cualquiera pueda leer los objetos individuales cuya URL conozca, y añade `public_listing: true` para que cualquiera pueda listar también el contenido del contenedor; `public_listing` sin `public_read` responde `400`. Un nombre que ya existe responde `409`.

`GET /api/v1/object_storage/` lista tus contenedores con sus `bytes` y su `count`. `PATCH /api/v1/object_storage/{container_name}` actualiza los metadatos de un contenedor, y `DELETE /api/v1/object_storage/{container_name}` borra uno vacío; un contenedor que todavía tiene objetos responde `409`.

## Nombres de los contenedores {#naming}

El nombre de un contenedor tiene 3–63 caracteres entre letras minúsculas, dígitos y guiones, y empieza y termina con una letra o un dígito. No se permiten guiones bajos, puntos ni espacios, ni tampoco un nombre con formato de dirección IP.

## Objetos {#objects}

- `POST /api/v1/object_storage/{container_name}/objects` sube un objeto nuevo como `file` en multipart, con el nombre `object_name` o, si no lo indicas, con el nombre del archivo. Un nombre que ya existe responde `409`.
- `PUT /api/v1/object_storage/{container_name}/objects/{object_name}/content` sustituye el contenido de un objeto.
- `GET /api/v1/object_storage/{container_name}/objects/{object_name}/content` lo descarga: el texto como UTF-8 y el contenido binario codificado en base64.
- `GET` y `PATCH /api/v1/object_storage/{container_name}/objects/{object_name}` leen y actualizan sus metadatos, y `DELETE` en la misma ruta lo borra.
- `POST /api/v1/object_storage/{container_name}/objects/{object_name}/copy` y `/move` lo copian o lo mueven a un nombre nuevo o a otro contenedor.

El nombre de un objeto puede contener `/`, que se interpreta como una ruta de carpetas.

## Listado y paginación {#listing}

`GET /api/v1/object_storage/{container_name}/objects` lista los objetos de un contenedor. Pagina con `limit` y `marker` (el último nombre que has visto), o pon `full_listing=true` para obtenerlos todos en una sola respuesta. `prefix` deja solo los nombres que empiezan por él.

Pasa `delimiter=/` para obtener un listado tipo carpeta: los objetos de este nivel vuelven en `objects`, y los prefijos del nivel inferior, en `subdirs`.

## Credenciales de corta duración {#credentials}

`POST /api/v1/object_storage/credentials` genera una credencial de corta duración con el alcance del proyecto de tu sesión, y devuelve su `trust_id` y su `expires_at`. Puedes pedir una duración con `ttl_seconds`; el servidor le pone un tope. Un editor independiente envía el `trust_id` en una cabecera `X-Trust-Id` en las llamadas posteriores al almacenamiento de objetos, y así llega al almacenamiento del proyecto sin tener tu token completo ni ningún secreto duradero; cada llamada se sigue autenticando como siempre. `DELETE /api/v1/object_storage/credentials/{trust_id}` la revoca.

## Próximos pasos {#next-steps}

- [Autenticación](/docs/authentication) — las claves de API van en la cabecera `X-API-Key`.
- [Almacenamiento en bloques](/docs/api/block-storage) — cuando quieres un sistema de archivos en lugar de un almacén clave-valor, o necesitas semántica POSIX.
- [Editor Mosaic]({{BASE_URL}}/products/mosaic) — editor en el navegador para archivos YAML/JSON/Markdown dentro de tus contenedores.
