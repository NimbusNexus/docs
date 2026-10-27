---
title: "Paginación"
description: "Paginación por cursor en todos los endpoints de listado. Estable ante inserciones y sin desfases por offset."
publishedAt: 2026-05-20
updatedAt: 2026-10-15
kind: concept
---

# Paginación

Los endpoints de listado (`GET /v1/vms`, `GET /v1/snapshots`, etc.) paginan con cursores opacos, no con offsets numéricos. La paginación por cursor es la opción por defecto adecuada para listas de recursos que cambian mientras paginas — devuelve cada elemento exactamente una vez, aunque se inserten o se borren filas entre una página y otra.

## El formato {#shape}

Dos parámetros de query en todos los endpoints de listado:

- `limit` — tamaño de página. Por defecto 50, máximo 200. Por encima de 200, la petición no supera la validación: `422` `validation_error` ([Errores](/docs/errors#codes-validation)).
- `cursor` — puntero opaco a la página siguiente. Omítelo en la primera petición.

Todas las respuestas de listado incluyen:

```json
{
  "items": [ /* ... */ ],
  "pagination": {
    "next_cursor": "eyJpZCI6InZtXzAxSEc3Li4uIn0=",
    "total_count": null
  }
}
```

Cuando `next_cursor` es `null`, has llegado a la última página.

## Recorrer las páginas {#walking}

```ts
async function listAllVms(): Promise<VM[]> {
  const all: VM[] = []
  let cursor: string | undefined

  do {
    const url = new URL('{{API_BASE_URL}}/v1/vms')
    url.searchParams.set('limit', '200')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url, { headers: auth })
    const { items, pagination } = await res.json()

    all.push(...items)
    cursor = pagination.next_cursor ?? undefined
  } while (cursor)

  return all
}
```

Tres reglas:

1. **Los cursores son opacos.** No intentes analizarlos ni construirlos. Codifican el estado de ordenación + filtros de tu petición original, así que un cursor de una query no funciona en otra.
2. **No cambies los filtros a mitad de la paginación.** Si empiezas con `?status=running` y luego añades `?region=us-east-1` para la página 2, el comportamiento queda indefinido. Empieza de cero (sin cursor) cuando cambien los filtros.
3. **Detente cuando `next_cursor` sea null.** No sigas paginando "por si acaso" — el cursor es la única señal fiable de fin de lista.

## Por qué cursores y no `?page=2&per_page=50` {#why-cursors}

La paginación por offset falla en dos escenarios reales:

**Inserciones durante la paginación.** Si pides la página 1 (elementos 1–50), luego alguien crea una VM nueva y después pides la página 2 (elementos 51–100), verás el elemento 50 dos veces (ahora está en la posición 51) y nunca verás el elemento nuevo. Los cursores capturan "dónde estabas" — la página siguiente empieza justo después de donde estabas realmente, no en un offset absoluto.

**Borrados durante la paginación.** El mismo problema a la inversa: si se borra una VM entre una página y otra, un cliente que pagina por offset se salta un elemento. Los clientes que paginan por cursor, no.

Estos casos límite importan a cualquier escala que no sea trivial. Usamos la paginación por cursor por defecto para que no te pillen.

## `total_count` {#total-count}

El campo `total_count` de `pagination` es **null en la mayoría de los endpoints**, por diseño. Contar todos los elementos de una lista paginada es una consulta costosa que pierde utilidad a medida que crece N ("tienes 14.328 VMs en todos tus proyectos" — ¿qué haces con eso?). Cuando `total_count` está presente, la página de referencia del endpoint lo documenta; cuando no está, no dependas de él.

Si de verdad necesitas un recuento exacto, pagina hasta el final y cuenta lo que hayas obtenido.

## Ordenación {#sort}

Los endpoints de listado tienen una ordenación por defecto (normalmente `created_at desc`, los más recientes primero), documentada en cada endpoint. Algunos endpoints aceptan `?sort=` para cambiarla; la página de referencia indica qué valores se aceptan.

El cursor codifica la ordenación, así que cambiar `?sort=` entre una página y otra es uno de los casos de "comportamiento indefinido" — empieza de cero cuando lo cambies.

## Filtros {#filters}

Todos los endpoints de listado aceptan algunos parámetros de filtro estándar:

- `created_after` / `created_before` — timestamps RFC 3339
- `updated_after` / `updated_before` — timestamps RFC 3339
- Filtros propios de cada recurso (p. ej. `?region=us-east-1&state=running` en las VMs)

Los filtros se combinan; la respuesta es el AND de todos ellos. La página de referencia del recurso documenta qué filtros acepta.

## Cuando de verdad quieres todos los elementos {#listing}

Llamar al listado paginado en un bucle cerrado para enumerar todos los recursos está bien para trabajo puntual, pero sale caro en daemons que se ejecutan una y otra vez. Dos patrones mejores:

1. **Webhooks.** Suscríbete a los eventos `resource.created` / `resource.deleted` y mantén tu propio índice. Consulta [Webhooks de la plataforma](/docs/webhooks).
2. **Endpoints de exportación masiva.** Para algunos recursos (snapshots, backups, registros de auditoría) hay un endpoint de exportación dedicado que transmite en streaming el conjunto completo en una sola respuesta. La página de referencia del recurso los documenta donde existen.

El patrón de paginación es para uso interactivo (una tabla en un panel, un comando de listado en la CLI). Para la sincronización continua, el coste de la paginación es lo que más pesa y los webhooks son la respuesta adecuada.

## Próximos pasos {#next-steps}

- [Convenciones](/docs/conventions) — el resto del formato de las peticiones (códigos de estado, errores, idempotencia).
- [Webhooks de la plataforma](/docs/webhooks) — la alternativa basada en push para la sincronización continua.
- La página de referencia de cualquier endpoint de listado — los filtros y las opciones de ordenación propios de cada endpoint.
