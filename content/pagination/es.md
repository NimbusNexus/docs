---
title: "Paginación"
description: "Cómo pagina sus listas cada API, con limit y offset o marker, y cómo saber que has llegado al final."
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: concept
---

# Paginación

NimbusNexus tiene dos tipos de API, y paginan las listas de forma distinta. Las APIs de las apps paginan con `limit` y `offset`. En la API de infraestructura, la mayoría de las listas responden con todo de una vez, y unas pocas reciben `limit` con `marker` o `offset`.

## Las APIs de las apps {#shape}

La mayoría de las listas de Webhooks, Inboxes y Request Bins aceptan dos parámetros de query:

- `limit` — tamaño de página. Por defecto 50, máximo 200. Por encima de 200, la petición no supera la validación: `422` `validation_error` ([Errores](/docs/errors#codes-validation)).
- `offset` — cuántos elementos saltar. Por defecto 0, máximo 10.000.

Cada lista responde con sus elementos y el offset siguiente:

```json
{
  "items": [],
  "next_offset": 50
}
```

Pasa `next_offset` de vuelta como `offset` para pedir la página siguiente. Cuando es `null`, estás en la última página.

Un offset cuenta posiciones, así que un elemento creado o borrado mientras recorres una lista puede hacer que veas otro elemento dos veces, o que te saltes uno. Si eso importa, compara los ids. Mantén los mismos filtros durante todo el recorrido y vuelve a empezar desde el offset 0 cuando los cambies.

Dos casos funcionan de otra forma:

- **Las búsquedas** de Inboxes y Request Bins paginan con `next_until` en su lugar: consulta [Búsqueda de mensajes](/docs/product-inboxes#search) y [Peticiones capturadas](/docs/product-bins/reference#requests).
- **En códigos QR**, la mayoría de las listas se devuelven en una sola respuesta. Los escaneos de un código (`GET /v1/qr-tracked/codes/{code_id}/scans`) solo aceptan `limit`, y las entregas de un webhook (`GET /v1/qr-tracked/webhooks/{webhook_id}/deliveries`) paginan con `limit` y `cursor`, con el cursor siguiente en `nextCursor`.

## La API de infraestructura {#infrastructure}

La mayoría de las listas, como `GET /api/v1/instance/`, responden con la lista completa y no reciben parámetros de paginación. Las que paginan lo hacen de una de estas dos formas.

### `limit` y `marker` {#marker}

`marker` es el último elemento que has visto: su id o, en el almacenamiento de objetos, su nombre. La respuesta empieza después de él.

- Imágenes de VM: `GET /api/v1/image/`.
- DNS: `GET /api/v1/zones/`, `GET /api/v1/recordsets/`, `GET /api/v1/zones/{zone_id}/recordsets/`, `GET /api/v1/zones/{zone_id}/ptr/` y `GET /api/v1/zones/{zone_id}/shares/`.
- Almacenamiento de objetos: `GET /api/v1/object_storage/` para los contenedores y `GET /api/v1/object_storage/{container_name}/objects` para los objetos. En los objetos, `full_listing=true` los devuelve todos en una sola respuesta.

Estas respuestas solo contienen `data`, sin nada que indique si quedan más. Sigue hasta que una página vuelva con menos elementos que tu `limit`.

### `limit` y `offset` {#offset}

`offset` es cuántos elementos saltar.

- Backups de volúmenes: `GET /api/v1/backup_restore/volume_backups/`, con un `limit` por defecto de 10.
- Programaciones de backups: `GET /api/v1/backup_restore/backup_scheduler/list` y `GET /api/v1/backup_restore/volume_scheduler/list`.
- Conexiones de almacenamiento externo: `GET /api/v1/external/connections/`.
- Notificaciones: `GET /api/v1/notifications/list`, con un `limit` por defecto de 50 y un máximo de 200.

Estas respuestas también llevan `total`, el número de elementos de todas las páginas, así que has llegado al final cuando has leído esa cantidad.

## Recorrer las páginas {#walking}

En una API de las apps, sigue `next_offset`:

```ts
async function listAllEndpoints() {
  const all = []
  let offset = 0

  while (offset !== null) {
    const url = new URL('{{WEBHOOKS_BASE_URL}}/v1/endpoints')
    url.searchParams.set('limit', '200')
    url.searchParams.set('offset', String(offset))

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.WEBHOOKS_API_KEY}` },
    })
    const page = await res.json()

    all.push(...page.items)
    offset = page.next_offset
  }

  return all
}
```

En la API de infraestructura, sigue el último id hasta que llegue una página incompleta:

```ts
async function listAllZones() {
  const all = []
  const limit = 100
  let marker

  while (true) {
    const url = new URL('{{API_BASE_URL}}/api/v1/zones/')
    url.searchParams.set('limit', String(limit))
    if (marker) url.searchParams.set('marker', marker)

    const res = await fetch(url, {
      headers: { 'X-API-Key': process.env.NIMBUS_KEY },
    })
    const { data } = await res.json()

    all.push(...data)
    if (data.length < limit) return all
    marker = data.at(-1).id
  }
}
```

Cada página es una petición y cuenta para el [límite de tasa](/docs/rate-limiting).

## Ordenación {#sort}

Las listas que se pueden ordenar indican sus parámetros en sus páginas de referencia. En la API de infraestructura, son `sort_by` y `sort_desc` en las listas con `offset` que se pueden ordenar, y `sort_key` y `sort_dir` en las imágenes de VM y los conjuntos de registros DNS. Mantén la misma ordenación durante todo el recorrido.

## Próximos pasos {#next-steps}

- [Convenciones](/docs/conventions) — el resto del formato de las peticiones: ids, códigos de estado, errores.
- [Límites de tasa](/docs/rate-limiting) — cuántas peticiones puede hacer un recorrido.
- [Errores](/docs/errors) — qué responde una petición rechazada.
