---
title: "Convenciones"
description: "Los patrones que la API sigue en todas partes — ids de recursos, paginación, errores, idempotencia y operaciones de larga duración."
publishedAt: 2026-05-19
updatedAt: 2026-10-15
kind: concept
---

# Convenciones

La API tiene una única forma, que se repite en todos los recursos. Cuando conoces esa forma, conoces todos los endpoints — lo único que cambia de un recurso a otro es el conjunto de campos del propio recurso.

## Ids de recursos {#resource-ids}

Cada recurso tiene un id opaco y estable, con la forma `<prefix>_<26-char-base32>`:

| Recurso                  | Prefijo | Ejemplo                           |
| ------------------------ | ------- | --------------------------------- |
| Máquina virtual          | `vm_`   | `vm_01H8FZQ4XW9KMP4XQNR3VT7DC2`   |
| Base de datos gestionada | `db_`   | `db_01H8FZQ4XW9KMP4XQNR3VT7DC2`   |
| Volumen de bloques       | `vol_`  | `vol_01H8FZQ4XW9KMP4XQNR3VT7DC2`  |
| Snapshot                 | `snap_` | `snap_01H8FZQ4XW9KMP4XQNR3VT7DC2` |
| Clave de API             | `key_`  | `key_01H8FZQ4XW9KMP4XQNR3VT7DC2`  |

Los ids son estables durante toda la vida del recurso — nunca se reutilizan ni se reescriben al renombrarlo. Úsalos en URLs, claves foráneas y registros de auditoría; usa los campos `name`, legibles por humanos, solo para mostrarlos.

## Paginación {#pagination}

Los endpoints de listado aceptan dos parámetros de query:

- `limit` — tamaño de página. Por defecto 50, máximo 200. Por encima de 200, la petición no supera la validación: `422` `validation_error` ([Errores](/docs/errors#codes-validation)).
- `cursor` — puntero opaco a la página siguiente. El cuerpo de la respuesta lo devuelve como `pagination.next_cursor` cuando hay más páginas; pásalo de vuelta como `cursor` para avanzar.

Los cursores son opacos — no intentes decodificarlos ni construirlos. Incluyen el estado de ordenación + filtros de la petición original, así que cambiar los filtros a mitad de la paginación produce un comportamiento indefinido. Empieza de cero (sin `cursor`) cuando cambien tus filtros.

El patrón en código:

```bash
# Page 1
curl '{{API_BASE_URL}}/v1/vms?limit=50' \
  -H "Authorization: Bearer $NIMBUS_KEY"

# Page 2 (cursor from page 1's response.pagination.next_cursor)
curl '{{API_BASE_URL}}/v1/vms?limit=50&cursor=eyJpZCI6...' \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Cuando `pagination.next_cursor` no está o es null, estás en la última página.

## Errores {#errors}

Todas las respuestas de error usan el mismo formato JSON:

```json
{
  "error": {
    "code": "validation_error",
    "message": "request validation failed",
    "details": {
      "errors": [
        {
          "loc": ["body", "event_type"],
          "msg": "Field required",
          "type": "missing"
        }
      ]
    },
    "request_id": "7e4b1d9c2a6f4e8b9d3c5a1f0e2b4c68"
  }
}
```

- `code` — cadena estable y legible por máquinas. Decide según este campo, no según el código de estado, cuando un mismo estado tiene varios significados (p. ej. `402` puede ser `quota_exceeded`, `not_entitled` o `workspace_frozen`).
- `message` — texto en inglés, legible por humanos, para los logs. No se traduce; si muestras un error a los usuarios finales, asocia cada `code` a tu propio texto.
- `details` — presente en algunos códigos. En un error de validación, `details.errors` enumera los datos de entrada que fallan; en muchos otros errores lleva un `reason` que precisa el código, con los valores que lo acompañan. Su forma depende del código.
- `request_id` — en todos los cuerpos de error que envía la API: el mismo id que la cabecera `X-Request-ID` que lleva cada respuesta de la API. Una respuesta del edge que hay delante de ella (un `502` o un `504`, por ejemplo, o un `413` por un cuerpo demasiado grande para llegar a la API) no lleva ni el cuerpo de error de la API ni la cabecera `X-Request-ID` ([Errores](/docs/errors#request-id)). Regístralo e inclúyelo cuando contactes con el soporte.
- `next_code` — solo se envía mientras se está renombrando un código: el código que llevará este error después. Cuando esté presente, decide según él en lugar de según `code`. Hoy no se está renombrando ningún código, así que la API no lo envía.

[Errores](/docs/errors) enumera todos los códigos y motivos, y cuál de las APIs de Webhooks e Inboxes envía cada uno. (Versiones anteriores de esta página mostraban `validation_failed` como un `400`, con `fields` y `request_id` en el cuerpo. Las APIs nunca han enviado los dos primeros: un fallo de validación es un `422` `validation_error`, con `details`. `request_id` tampoco estaba entonces en el cuerpo; ahora lo llevan los cuerpos de error de la API.)

## Códigos de estado HTTP {#status-codes}

Usamos un conjunto pequeño y predecible:

| Estado    | Cuándo |
| --------- | ------ |
| `200`     | Éxito, con cuerpo. |
| `201`     | Recurso creado. La cabecera `Location` apunta al nuevo recurso. |
| `202`     | Operación aceptada; consulta `operation.status` para seguir su progreso. |
| `204`     | Éxito, sin cuerpo (lo habitual en DELETE). |
| `400`     | No se ha podido leer la petición tal como se envió. `error.message` dice por qué. |
| `401`     | No hay ninguna credencial utilizable. Consulta [Autenticación](/docs/authentication). |
| `402`     | Tu plan o tu estado de facturación impiden la petición (una cuota, una función que tu plan no incluye, un workspace congelado). Reintentar no sirve de nada. |
| `403`     | Autenticado, pero no autorizado (falta un alcance, proyecto equivocado, etc.). En Webhooks, también una credencial que no acepta. |
| `404`     | El recurso no existe, O quien llama no puede verlo. No lo distinguimos a propósito — revelar que existe ya es en sí una fuga de acceso. |
| `409`     | Conflicto de estado (un nombre ya en uso, una `Idempotency-Key` reutilizada con otro cuerpo, etc.). |
| `413`     | El cuerpo supera el límite de tamaño. |
| `422`     | La validación ha fallado. En un error de validación (`validation_error`), `error.details.errors` enumera los datos de entrada que fallan; en los demás códigos `422` de la API de Webhooks, como `invalid_payload` o `unknown_event_type`, es un objeto que nombra el valor o la regla que falla. |
| `429`     | Limitado por tasa. Cuando `Retry-After` está presente, te indica cuándo reintentar. |
| `500–504` | Problema en el servidor. Siempre es seguro reintentar las peticiones idempotentes. |

## Idempotencia {#idempotency}

Los endpoints de escritura (POST, PUT, PATCH, DELETE) aceptan una cabecera `Idempotency-Key` opcional. Pasa cualquier valor único (lo habitual es un UUID); guardamos la respuesta en caché durante 24 horas y devolvemos la misma respuesta si se repite la petición con la misma clave.

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web", "size": "gp-2-4", "region": "us-east-1", "image": "ubuntu-24.04" }'
```

Usa claves de idempotencia cuando tu cliente pueda reintentar una petición tras un fallo de red sin poder saber si la original tuvo éxito. El comportamiento por defecto, sin clave, es "reintento sin garantías"; con una clave, los reintentos son seguros.

Los endpoints GET siempre son idempotentes y no necesitan la cabecera.

## Operaciones de larga duración {#operations}

Algunas acciones no terminan dentro del ciclo de vida de la petición:

- El `POST` de una VM devuelve `202` mientras el hipervisor asigna la instancia.
- El `POST` de una base de datos devuelve `202` mientras se levantan las réplicas.
- El redimensionado de volúmenes y la migración de VMs devuelven `202`.

El cuerpo de la respuesta de cualquier 202 incluye un objeto `operation`:

```json
{
  "id": "vm_01H8FZQ4XW9KMP4XQNR3VT7DC2",
  "state": "provisioning",
  "operation": {
    "id": "op_01H8FZ...",
    "kind": "vm_create",
    "status": "running",
    "progress": 0.4,
    "started_at": "2026-05-19T18:30:00Z"
  }
}
```

Dos formas de seguir el progreso:

1. **Polling** — `GET /v1/operations/{op_id}` una vez por segundo. Es barato; cuenta como una llamada normal a la API para los límites de tasa.
2. **Webhook** — suscribe una URL de callback desde el panel. Enviamos un POST cuando la operación llega a un estado final (`succeeded` o `failed`).

La mayoría de las operaciones terminan en menos de 60 segundos. Las excepciones son la descarga de imágenes de VM en su primer uso (~90 segundos) y la configuración de clusters de Kafka (~180 segundos).

## Timestamps {#timestamps}

Todos los timestamps están en **RFC 3339 / ISO 8601 en UTC**, con el sufijo `Z`:

```text
2026-05-19T18:30:00Z
```

Nunca en hora local, nunca con un desfase horario, nunca como epoch entero (salvo en las cabeceras de firma de los webhooks, que llevan un timestamp Unix porque es la convención que usan los firmantes HMAC). `Date.parse()` en JavaScript y los parsers equivalentes de la librería estándar de otros lenguajes manejan este formato de forma nativa.

## Próximos pasos {#next-steps}

- [Autenticación](/docs/authentication) explica la forma de la cabecera de autenticación y el modelo de alcances.
- Las páginas de referencia — [Máquinas virtuales](/docs/api/vms), [Bases de datos gestionadas](/docs/api/managed-databases), [Almacenamiento en bloques](/docs/api/block-storage), [Almacenamiento de objetos](/docs/api/object-storage), [Regiones](/docs/api/regions) — muestran las convenciones en acción.
