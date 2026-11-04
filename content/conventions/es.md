---
title: "Convenciones"
description: "Los patrones que siguen las APIs — ids de recursos, paginación, errores, idempotencia y operaciones de larga duración."
publishedAt: 2026-05-19
updatedAt: 2026-11-04
kind: concept
---

# Convenciones

NimbusNexus tiene dos tipos de API, y no comparten todas las convenciones. La **API de infraestructura** en `{{API_HOST}}` (VMs, redes, almacenamiento, DNS y tu cuenta) tiene sus rutas bajo `/api/v1/` y recibe una clave de API en la cabecera `X-API-Key` ([Autenticación](/docs/authentication)). Las **APIs de las apps** (Webhooks, Inboxes, Request Bins y las demás) tienen cada una su propia URL base, con rutas bajo `/v1/`, y reciben una clave como token bearer ([Configura la API REST](/docs/setup/rest)). Esta página indica en qué se diferencian las dos.

## Ids de recursos {#resource-ids}

En la API de infraestructura, la mayoría de los ids de recursos son UUIDs, como `3f0c9e1a-6b7d-4c2e-9a51-7d2b8f4e1c60`; los contenedores y los objetos del almacenamiento de objetos se identifican por su nombre. En las APIs de las apps, los ids llevan un prefijo, como `ep_` para un endpoint de Webhooks o `evt_` para un evento. Trata cualquier id como una cadena opaca.

Los ids son estables durante toda la vida del recurso — nunca se reutilizan ni se reescriben al renombrarlo. Úsalos en URLs, claves foráneas y registros de auditoría; usa los campos `name`, legibles por humanos, solo para mostrarlos.

## Paginación {#pagination}

En Webhooks, Inboxes y Request Bins, los endpoints de listado aceptan dos parámetros de query:

- `limit` — tamaño de página. Por defecto 50, máximo 200. Por encima de 200, la petición no supera la validación: `422` `validation_error` ([Errores](/docs/errors#codes-validation)).
- `offset` — cuántos elementos saltar. El cuerpo de la respuesta devuelve el valor siguiente como `next_offset`; pásalo de vuelta como `offset` para avanzar.

El patrón en código:

```bash
# Page 1
curl '{{WEBHOOKS_BASE_URL}}/v1/endpoints?limit=50' \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY"

# Page 2 (offset from page 1's response.next_offset)
curl '{{WEBHOOKS_BASE_URL}}/v1/endpoints?limit=50&offset=50' \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY"
```

Cuando `next_offset` es null, estás en la última página.

En la API de infraestructura, la mayoría de los endpoints de listado, como `GET /api/v1/instance/`, responden con la lista completa y no reciben parámetros de paginación. Los que paginan lo hacen de una de estas dos formas:

- `limit` y `marker` (el último id o nombre que has visto): imágenes de VM, zonas DNS y conjuntos de registros, contenedores y objetos del almacenamiento de objetos.
- `limit` y `offset`: backups de volúmenes, programaciones de backups, conexiones de almacenamiento externo, notificaciones.

```bash
# Page 1
curl '{{API_BASE_URL}}/api/v1/zones/?limit=50' \
  -H "X-API-Key: $NIMBUS_KEY"

# Page 2 (marker: the id of the last zone on page 1)
curl '{{API_BASE_URL}}/api/v1/zones/?limit=50&marker=<zone-id>' \
  -H "X-API-Key: $NIMBUS_KEY"
```

## Errores {#errors}

Los dos tipos de API responden con errores de forma distinta. En la API de infraestructura, un error lleva `success: false` y un `message`:

```json
{
  "success": false,
  "message": "Authentication required"
}
```

Un fallo de validación (`422`) lleva `errors` en su lugar, con los campos que fallan:

```json
{
  "success": false,
  "errors": {
    "field": ["Invalid value"]
  }
}
```

Aquí no hay códigos de error: decide según el estado y no parsees `message`. Todas las respuestas llevan una cabecera `X-Request-ID`; inclúyela cuando contactes con el soporte.

Todas las respuestas de error de Webhooks, Inboxes y Request Bins usan este formato JSON:

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
| `200`     | Éxito, con cuerpo. En la API de infraestructura, también una petición cuyo trabajo queda en cola ([Operaciones de larga duración](#operations)). |
| `201`     | Recurso creado. |
| `202`     | Aceptada: el trabajo termina después de la respuesta ([Operaciones de larga duración](#operations)). |
| `204`     | Éxito, sin cuerpo (lo habitual en DELETE). |
| `400`     | No se ha podido leer la petición tal como se envió. `error.message`, o `message` en la API de infraestructura, dice por qué. |
| `401`     | No hay ninguna credencial utilizable. Consulta [Autenticación](/docs/authentication). |
| `402`     | En las APIs de las apps: tu plan o tu estado de facturación impiden la petición (una cuota, una función que tu plan no incluye, un workspace congelado). Reintentar no sirve de nada. |
| `403`     | Autenticado, pero no autorizado (falta un alcance, proyecto equivocado, etc.). En Webhooks, también una credencial que no acepta. En la API de infraestructura, también una llamada fuera de las reglas de acceso de una clave de API. |
| `404`     | El recurso no existe, O quien llama no puede verlo. No lo distinguimos a propósito — revelar que existe ya es en sí una fuga de acceso. |
| `409`     | Conflicto de estado (un nombre ya en uso, una `Idempotency-Key` reutilizada con otro cuerpo, etc.). |
| `413`     | El cuerpo supera el límite de tamaño. |
| `422`     | La validación ha fallado. En un error de validación (`validation_error`), `error.details.errors` enumera los datos de entrada que fallan; en los demás códigos `422` de la API de Webhooks, como `invalid_payload` o `unknown_event_type`, es un objeto que nombra el valor o la regla que falla. En la API de infraestructura, `errors` contiene los campos que fallan. |
| `429`     | Limitado por tasa. Cuando `Retry-After` está presente, te indica cuándo reintentar. |
| `500–504` | Problema en el servidor. Siempre es seguro reintentar las peticiones idempotentes. |

## Idempotencia {#idempotency}

Unas pocas rutas aceptan una cabecera `Idempotency-Key`, para que un reintento no haga el trabajo dos veces. En Webhooks, es la publicación de un evento. Pasa cualquier valor único (lo habitual es un UUID):

```bash
curl -X POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "event_type": "order.created", "payload": { "order_id": "1234" } }'
```

Todas las demás rutas ignoran la cabecera. En la API de infraestructura, crear una VM dos veces crea dos VMs, con clave o sin ella. [Idempotencia](/docs/idempotency) enumera las rutas que la aceptan y qué hacer en las demás.

Los endpoints GET siempre son idempotentes y no necesitan la cabecera.

## Operaciones de larga duración {#operations}

Algunas acciones no terminan durante la petición. En la API de infraestructura, responden en cuanto el trabajo queda en cola:

- `POST /api/v1/instance/` (crear una VM) responde `200` con `{"success": true}` y sin ningún id.
- `POST /api/v1/storage/` (crear un volumen) responde `201` sin ningún id.
- `POST /api/v1/instance/{instance_id}/resize` responde `200`, y la VM pasa a `VERIFY_RESIZE`.
- `PUT` y `DELETE` en un conjunto de registros DNS responden `202`.

No hay ningún objeto de operación que seguir. Para saber cómo va el trabajo, lee el recurso y vigila su `status`: `GET /api/v1/instance/` muestra una VM nueva en `BUILD` y después en `ACTIVE` o `ERROR`. Cada consulta cuenta como una llamada normal a la API para los límites de tasa.

## Timestamps {#timestamps}

Todos los timestamps están en **RFC 3339 / ISO 8601 en UTC**, con el sufijo `Z`:

```text
2026-05-19T18:30:00Z
```

Nunca en hora local, nunca con un desfase horario, nunca como epoch entero (salvo en las cabeceras de firma de los webhooks, que llevan un timestamp Unix porque es la convención que usan los firmantes HMAC). `Date.parse()` en JavaScript y los parsers equivalentes de la librería estándar de otros lenguajes manejan este formato de forma nativa.

## Próximos pasos {#next-steps}

- [Autenticación](/docs/authentication) explica la cabecera de autenticación, y los roles y las reglas de acceso que limitan una clave.
- Las páginas de referencia — [Máquinas virtuales](/docs/api/vms), [Almacenamiento en bloques](/docs/api/block-storage), [Almacenamiento de objetos](/docs/api/object-storage), [Regiones](/docs/api/regions) — muestran las convenciones en acción.
