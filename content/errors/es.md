---
title: "Errores"
description: "El formato de los errores, los códigos de error que envían las APIs de Webhooks, Inboxes y Request Bins, y cómo tratar cada uno."
publishedAt: 2026-05-20
updatedAt: 2026-10-27
kind: concept
---

# Errores

Todas las respuestas de error de las APIs de Webhooks, Inboxes y Request Bins usan el mismo formato JSON. Para tratar cada caso, decide según `error.code`, o según `error.next_code` cuando el error lo lleve. No parsees `message` ni decidas solo por el estado: un mismo estado puede llevar varios códigos, y en todas las APIs el `402` lleva cuatro.

> **Actualizado el 2026-10-16.** En Webhooks, un nombre de cabecera personalizada que es un token HTTP válido con un salto de línea al final ahora se rechaza como cualquier otro nombre que no sea un token HTTP válido: `webhooks.custom_header_name_invalid`, con el `msg` de esa regla y sin `params` ([Validación de peticiones](#codes-validation)). Antes, el salto de línea pasaba la comprobación de token y el nombre se rechazaba como carácter de control, con `params.header`: como `webhooks.custom_header_control_character` desde el 2026-10-15, y como `value_error` antes de esa fecha. La petición sigue siendo un `422` `validation_error`, y no ha cambiado nada más.
>
> **Actualizado el 2026-10-15.** Antes del lanzamiento de la v1, se han completado todos los cambios de nombre que estaban en curso en Inboxes y Webhooks: un error que llevaba un `next_code` ahora lleva ese código, con el estado de ese código, y ninguna de las dos APIs envía ya `next_code`.
>
> - Una petición que no supera la validación es `validation_error` en las dos APIs, y sigue siendo un `422`. En Inboxes era `invalid_request`; en Webhooks, un campo que comprueba la propia API era `unprocessable`. En las dos, `details` es `{"errors": [...]}`; en Webhooks era una lista sin más ([Validación de peticiones](#codes-validation)).
> - Todo `500` es `internal_error` en las dos APIs (en Webhooks era `internal`).
> - En Inboxes, una clave de API o un token que no reconoce o no puede verificar es `invalid_credential`, y sigue siendo un `401` (era `unauthorized`). Una credencial que falta o que se ha revocado, o una sesión que ha terminado, sigue siendo `unauthorized` con un `details.reason`.
> - En Inboxes, un estado sin código propio lleva el código de ese estado, como `bad_request` para un `400` (era `error`).
> - En Webhooks, `plan_violation` ha desaparecido. El límite de endpoints es `quota_exceeded` (`402`, `details.reason` `allocation`), un `max_attempts` por encima del tope del plan es un `422` `validation_error` y una fuente de RabbitMQ en un plan inferior a Pro, o desactivar la verificación de endpoints en un plan que la exige (hoy ninguno lo hace), es `not_entitled` (`402`).
> - En Webhooks, un reenvío en bloque cuyo `from` es posterior a su `to` es un `422` `validation_error` con una entrada en `["body", "to"]`, y ya no un `409` `conflict`.
> - Las reglas propias de Webhooks sobre las cabeceras personalizadas, los retrasos de `retry_schedule`, los campos del broker de una fuente de RabbitMQ y los nombres de plan indican su propio `type` de entrada en lugar de `value_error`; `loc`, `msg` y `params` no cambian ([Validación de peticiones](#codes-validation)).
> - En Inboxes, una credencial limitada a ciertos proyectos se rechaza con `details.reason` `project_confined` (era `project`) ([Qué lleva `details`](#details)).
> - En Inboxes, `details` solo lleva las claves que enumera esta página. `quota_exceeded` ya no envía `max_inboxes`, `max_http_bins` ni `monthly_messages` (lee `metric`, `limit`, `current` y `period`), el `not_entitled` de la API de lectura ya no envía `plan` y el `rate_limited` por inbox ya no envía `inbox_id`.
>
> Ningún `message` ha cambiado, y tampoco ningún estado, salvo los de los dos rechazos de Webhooks que han pasado a ser un `422`. Estos cambios se hicieron antes del lanzamiento de la v1, así que no tuvieron el periodo de 12 meses que describe [Cuando se renombra un código](#renames); esa sección asocia cada grafía antigua con la nueva.
>
> **Actualizado el 2026-10-05.** Los cuerpos de error han ganado campos y no han perdido ninguno: `request_id` (el mismo valor que la cabecera `X-Request-ID`), un `reason` y valores con nombre en `details` en muchos más errores, `params` en las entradas de validación que tienen un límite numérico y `next_code` en un error cuyo código se está renombrando. Ningún estado, `code` ni `message` ha cambiado. En Webhooks, un `conflict` nombra el choque en `details.reason`, el `quota_exceeded` mensual nombra su `metric`, `limit`, `current` y `period`, cada `413` nombra su `limit` y `plan_violation` lleva el `next_code` en el que se convertirá, con los `details` de ese código ([Cuando se renombra un código](#renames)). [El formato](#shape) describe cada campo.
>
> **Corregido el 2026-10-05.** Versiones anteriores de esta página enumeraban códigos, estados y campos que las APIs nunca han enviado, entre ellos `validation_failed` (400), `rate_limit_exceeded`, `quota_exceeded` como 429 y `fields`. El código que compara con esos valores nunca ha coincidido con nada. También prometían un `request_id` en todos los cuerpos antes de que las APIs lo enviaran; ahora los cuerpos de error lo llevan, todos desde el 2026-10-06 ([El id de la petición](#request-id)). [Códigos que esta página enumeraba antes](#earlier-versions) asocia cada uno con lo que la API envía realmente.

## El formato {#shape}

Una clave de solo lectura que intenta crear un inbox en Inboxes, o un endpoint en Webhooks, recibe esta respuesta de las dos (solo cambia el `request_id`):

```json
{
  "error": {
    "code": "forbidden",
    "message": "admin scope required",
    "details": {
      "reason": "scope",
      "required": "admin"
    },
    "request_id": "5f0c2e9a8b7d4c31a6e4f2b1d9c8e7a6"
  }
}
```

Request Bins rechaza la misma clave de solo lectura con el mismo código y el mismo estado, pero sus `details` nombran el rol que necesita la acción en lugar de un alcance: `"reason": "role"` y `"required": "member"`. Una clave tiene ese rol con el alcance `admin`, **Read & write** en la consola de la cuenta ([Qué lleva `details`](#details)).

Hasta cinco campos. `code`, `message` y `request_id` están en todos los cuerpos de error que envían las APIs, y `details` y `next_code` aparecen cuando tienen algo que decir:

| Campo | Siempre presente | Qué es |
|---|---|---|
| `code` | Sí | Cadena estable y legible por máquinas. Decide según este campo, o según `next_code` cuando esté presente. |
| `message` | Sí | Texto en inglés para los logs y los tickets de soporte. No se traduce y no está pensado para la interfaz de un usuario final. |
| `details` | No | Contexto estructurado: un `reason` que precisa el código y los valores que lo acompañan, como el `id` que no se ha encontrado. En un error de validación, los datos de entrada que fallan. Su forma depende del código; en un error de validación es `{"errors": [...]}`, una lista de entradas. Consulta [Qué lleva `details`](#details). |
| `request_id` | Sí | El id de esta petición, el mismo valor que la cabecera de respuesta `X-Request-ID`. Regístralo y cítalo al soporte; nunca decidas nada según él. Consulta [El id de la petición](#request-id). |
| `next_code` | No | Solo se envía mientras se está renombrando un código: el código que llevará este error cuando se complete el cambio de nombre. Dale preferencia frente a `code`. Hoy no se está renombrando ningún código, así que ninguna API lo envía. Consulta [Cuando se renombra un código](#renames). |

Al miembro `error` se le pueden añadir campos nuevos, como a cualquier respuesta; ignora los que no uses ([Política de versionado](/docs/versioning#forward-compat)).

### Qué lleva `details` {#details}

Trata todas las claves de `details` como opcionales: lee las que necesites e ignora el resto. Cuando tiene un `reason`, es una cadena estable, pensada para máquinas, que precisa el código: por qué se ha rechazado una petición con `forbidden`, o qué tipo de cosa no ha encontrado un `not_found`. A su lado están los valores que necesita ese motivo, con nombres fijos. Algunos códigos llevan valores sin motivo, y muchos errores no llevan ningún `details`. Igual que `code`, `details.reason` es una cadena abierta, no un enum: los motivos nuevos y los códigos nuevos son [cambios aditivos](/docs/versioning#additive), así que mantén una rama por defecto para ambos. La tabla enumera lo que te puedes encontrar hoy al llamar a las APIs. En su columna **API**, **Ambas** significa Webhooks e Inboxes; Request Bins tiene filas propias.

| `code` | API | `details.reason` | Otras claves en `details` |
|---|---|---|---|
| `unauthorized` | Ambas | `missing`: no se ha enviado ninguna credencial. `revoked`: la clave o la sesión se ha revocado. `invalid`: en Inboxes, una sesión que no se ha podido verificar, normalmente porque ha caducado; en Webhooks, un evento entrante a `POST /v1/ingest/{source_id}` cuya firma no supera la verificación. `no_workspace`, solo en Inboxes: la credencial no está vinculada a ningún workspace. | — |
| `unauthorized` | Request Bins | `missing`: no se ha enviado ninguna credencial. `revoked`: la clave o la sesión se ha revocado. `invalid`: una sesión que no se ha podido verificar, normalmente porque ha caducado. `no_workspace`: la sesión no está vinculada a ningún workspace. | — |
| `forbidden` | Ambas | `scope`: el alcance de la credencial no lo permite. `project_confined`: una credencial limitada a ciertos proyectos, usada en una ruta que responde por todo el workspace; Inboxes todavía no acepta credenciales limitadas a proyectos, así que envía este motivo en todas las rutas. `csrf`: una sesión del navegador ha enviado una escritura sin la cabecera `X-CSRF`. `operator`: la ruta, o un campo de la petición, es solo para los operadores de la plataforma. | `required`, en la mayoría de los rechazos por `scope`: el alcance que lo habría permitido (`admin` en Inboxes; `admin`, `read` o `publish` en Webhooks) |
| `forbidden` | Webhooks | `role`: tu rol, en el workspace o en el proyecto del recurso sobre el que actúas, es demasiado bajo. `project`: la credencial, o la persona que la usa, no tiene acceso al proyecto que indica la petición. `product_not_enabled`: tu acceso no incluye Webhooks. `not_provisioned`: el workspace todavía no está configurado para Webhooks. | `required`, en `role`: el rol mínimo permitido (`admin`) |
| `forbidden` | Request Bins | `role`: tu rol, o el alcance de tu clave, no lo permite. `project_confined`: un puesto de invitado, o una clave limitada a un proyecto; Request Bins sirve a workspaces enteros, así que envía este motivo en todas las rutas. `product_not_enabled`: tu workspace no ha añadido Request Bins, o tu sesión no lo incluye. `csrf`: una sesión del navegador ha enviado una escritura sin la cabecera `X-CSRF`. `no_workspace`: la credencial no está vinculada a ningún workspace, como en el caso de un token de servicio. | `required`, en `role`: `member` para crear o cambiar un bin, `admin` para borrarlo o vaciarlo. Para una clave, los dos significan el alcance `admin` (**Read & write**). |
| `not_found` | Ambas | El tipo de recurso. Inboxes: `inbox`, `message`, `workspace`. Webhooks: `endpoint`, `source`, `event`, `delivery`, `capture`, `event_type`, `operational_endpoint`, `project`, `workspace`, `user` y `default_project` (una escritura que no indica ningún proyecto, en un workspace que todavía no tiene ninguno). | `id`: el id que has pedido. No aparece en `user` ni en `default_project`, donde no has indicado ninguno, ni en una ruta que no existe en absoluto. |
| `not_found` | Request Bins | El tipo de recurso: `bin` o `request`. Un bin que se ha borrado o que ha caducado es `bin`. | `id`: el id que has pedido. No aparece en una ruta que no existe en absoluto. |
| `bad_request` | Webhooks | `project_required`: una escritura que no indica ningún proyecto, desde una credencial que tiene acceso a varios. | `projects`: los proyectos a los que tiene acceso la credencial |
| `conflict` | Webhooks | Qué choque, como `event_type_exists` o `idempotency_key_reuse`. [Conflictos](#codes-state) enumera cada motivo y cuándo se envía. | Los valores que necesita ese motivo, como el `id` del endpoint, la entrega o el proyecto al que se refiere el choque; [Conflictos](#codes-state) los enumera por motivo |
| `quota_exceeded` | Ambas | `allocation`: el tope que fija un plan para una cantidad (Inboxes: direcciones; Webhooks: endpoints). `period`: el tope mensual (Inboxes: mensajes; Webhooks: entregas). | `metric` (`inboxes` o `messages` en Inboxes; `endpoints` o `deliveries` en Webhooks) y su `limit`; `current` en `allocation`, y en un `period` de Webhooks (las entregas usadas antes de la publicación rechazada) cuando se ha podido leer el recuento; `period` en `period`: el mes en Inboxes (`YYYY-MM`), el primer día del ciclo de facturación en Webhooks (`YYYY-MM-DD`). Una publicación se rechaza cuando sus entregas llevarían el recuento por encima de `limit`, así que en Webhooks `current` puede estar por debajo de `limit`. |
| `quota_exceeded` | Request Bins | `allocation`: el tope de bins del plan, en `POST /v1/bins`. Nunca `period`: una vez superadas las peticiones del mes, los bins responden a sus emisores y no registran nada, y no se rechaza ninguna llamada a la API. | `metric` (`bins`), su `limit` y `current` |
| `not_entitled` | Ambas | — | `feature`: `read_api` u `optional_phrase_gate` en Inboxes; `rabbitmq_sources` u `optional_endpoint_verification` en Webhooks. Webhooks envía `optional_endpoint_verification` al desactivar la verificación de endpoints en un plan que la exige; hoy ningún plan lo hace. |
| `not_entitled` | Request Bins | — | `feature`: `read_api`, leer peticiones capturadas con una clave de API en el plan Free |
| `payload_too_large` | Ambas | — | `limit` en bytes, en todos los `413`. Inboxes también envía `size` cuando la API ha medido el cuerpo. |
| `payload_too_large` | Request Bins | — | `limit` en bytes, en todos los `413` |
| `unknown_event_type` | Webhooks | — | `event_type`: el nombre que no está registrado |
| `invalid_payload` | Webhooks | `payload`: el payload no cumple el esquema de su tipo de evento. `schema_invalid`: un esquema que estás registrando no es JSON Schema válido. | En `payload`: `errors`, hasta 20 entradas de `{path, keyword, params}` (más abajo), y `total`, cuántas entradas había antes de ese recorte (la longitud de la lista cuando no se ha recortado nada). En `schema_invalid`: `path`, un JSON Pointer dentro del esquema, donde ha fallado. |
| `schema_too_large` | Webhooks | `bytes`, `depth`, `members`, `enum_values` o `patterns`: el límite que ha superado el esquema | `limit`; y también `size` en `bytes` (ambos en bytes) |
| `schema_pattern_unsafe` | Webhooks | `too_long`, `does_not_compile`, `empty_repeat`, `nested_quantifier`, `ambiguous_alternation` o `too_complex`: la regla que ha incumplido el patrón | `pattern`: el patrón completo, aunque `message` acorta los largos; `limit` (en caracteres) en `too_long` |
| `schema_ref_unsupported` | Webhooks | — | `ref`: el `$ref` remoto que la API no resuelve |
| `provider_secret_required` | Webhooks | — | `provider`: `stripe`, `github` o `rabbitmq` |
| `broker_not_allowed` | Webhooks | Ninguno para tu broker, sea cual sea la regla que lo ha rechazado (`not_system_broker` solo se envía al workspace propio de la plataforma) | `host`: el broker, como `host:port` |
| `rate_limited` | Ambas | `inbox_rate` (Inboxes): el límite por minuto de un inbox. Webhooks no envía ningún motivo. | `retry_after` en segundos, el mismo número que la cabecera `Retry-After` (las dos APIs). En el `inbox_rate` de Inboxes, también `rate_per_min`. |
| `unavailable` | Inboxes | `ingest_disabled`: la aceptación de mensajes está desactivada | — |

En `invalid_payload`, cada entrada de `details.errors` dice qué ha fallado y dónde. `path` es un JSON Pointer al valor que ha fallado: `""` es el propio payload, y para un miembro que falta o uno inesperado apunta al objeto que debería o no debería contenerlo. `keyword` es la palabra clave de JSON Schema que ha fallado (`required`, `type`, `enum`, `const`, `minimum`, `maximum`, `minLength`, `maxLength`, `minItems`, `maxItems`, `pattern`, `format` o `additionalProperties`), u `other` para cualquier otra palabra clave. `params` contiene `property` (el miembro que falta o el inesperado, una entrada por cada uno), `count` (un límite de longitud o de número de elementos), `limit` (el límite de un `minimum` o de un `maximum`) o `type` (el único tipo que debería haber tenido el valor), y está vacío cuando no se aplica ninguno de ellos, como en `enum` o `pattern`, o en un `type` que admite varios. Las entradas nunca llevan la expresión regular, los valores permitidos ni el valor que ha fallado; `message` sigue describiendo un fallo en inglés.

Los errores de validación de la petición (`validation_error`) no están en la tabla: en todas las APIs, su `details` es `{"errors": [...]}`, una lista de entradas de validación, cada una con `loc`, `type` y `msg`, un formato distinto del de `invalid_payload`. Consulta [Validación de peticiones](#codes-validation).

### El id de la petición {#request-id}

`error.request_id` es el mismo valor que la cabecera `X-Request-ID` de cada respuesta que envía una API, así que cualquiera de los dos identifica la petición. Si tu petición envía una cabecera `X-Request-ID` (hasta 128 letras, dígitos, `.`, `_` o `-`), la API usa ese valor como id de la petición; si no, genera uno. Si la defines tú, haz que sea única por petición, para que el id apunte a una sola llamada. Algunas respuestas vienen del edge que hay delante de las APIs y no de una API: un `502` o un `504`, por ejemplo, o un `413` por un cuerpo demasiado grande para llegar a la API. Esas respuestas no llevan ni el cuerpo de error de la API ni `X-Request-ID`. Lee primero el cuerpo y, si no está, recurre a la cabecera, como hace el [patrón de tratamiento](#pattern), y cuenta con que en esas respuestas falten los dos. Qué hacer con el id se explica en [Cómo notificar bugs](#bugs).

## Familias de códigos de estado {#families}

| Familia de códigos de estado | Significado de la familia |
|---|---|
| `200`/`201`/`202`/`204` | Éxito |
| `400` | No se ha podido leer la petición tal como se envió |
| `401` | Ninguna credencial utilizable: no se ha enviado ninguna o se ha revocado. Inboxes y Request Bins también responden `401`, como `invalid_credential`, a una clave que no reconocen o no pueden verificar, y Webhooks responde `401`, como `unauthorized`, a un evento entrante cuya firma no supera la verificación |
| `402` | Tu plan o tu estado de facturación impiden la petición: una cuota, una función que tu plan no incluye o un workspace congelado o suspendido |
| `403` | No permitido. Webhooks también responde `403`, como `invalid_credential`, a una credencial que no reconoce |
| `404` | El recurso no existe *o* quien llama no puede verlo (indistinguibles a propósito) |
| `405` | La ruta existe, pero no para este método |
| `409` | Conflicto con el estado existente, incluida una `Idempotency-Key` reutilizada con otro cuerpo |
| `413` | El cuerpo es demasiado grande |
| `422` | La petición se ha podido parsear, pero no ha superado la validación |
| `429` | Limitado por tasa |
| `5xx` | Problema en el servidor |

`429` y `5xx` son las únicas familias en las que volver a enviar la misma petición puede funcionar. Para cualquier otro `4xx`, el código te dice qué cambiar.

## Códigos de error {#codes}

Las dos APIs comparten la mayoría de los códigos y, desde la actualización que se indica al principio de esta página, usan el mismo código para casi todas las situaciones que comparten. Hay dos diferencias: `invalid_credential` es un `401` en Inboxes y un `403` en Webhooks, y una sesión que ha caducado es `unauthorized` (`details.reason` `invalid`) en Inboxes, pero `invalid_credential` en Webhooks. La columna **API** indica qué API envía cada código.

Request Bins envía los mismos códigos que Inboxes en las mismas situaciones, incluidas esas dos. En la columna **API**, **Todas** significa las tres APIs y **Ambas**, Webhooks e Inboxes; una fila marcada como **Request Bins** se refiere solo a esa API.

### Autenticación y autorización {#codes-auth}

| `code` | Estado | API | Qué es |
|---|---|---|---|
| `unauthorized` | 401 | Todas | No se ha enviado ninguna credencial o se ha revocado. En Inboxes y Request Bins, también una sesión que ha terminado o que no se ha podido verificar; todos los `unauthorized` que envían llevan un `details.reason`. En Webhooks, también un evento entrante a `POST /v1/ingest/{source_id}` cuya firma no supera la verificación (`details.reason` `invalid`); todos los `401` de Webhooks llevan un `details.reason` ([Qué lleva `details`](#details)). |
| `invalid_credential` | 401 en Inboxes y Request Bins, 403 en Webhooks | Todas | Una clave de API o un token que la API no reconoce o no puede verificar. Sustituye la credencial; volver a enviar la misma no funcionará. En Webhooks, esto incluye una sesión que ha caducado: vuelve a iniciar sesión. |
| `forbidden` | 403 | Todas | La credencial es válida, pero no puede hacer esto: un alcance o un rol que falta, una clave limitada a ciertos proyectos usada fuera de ellos o un producto que no está habilitado para tu workspace. `details.reason` dice cuál. |

`invalid_credential` es un `403` en la API de Webhooks y un `401` en Inboxes y Request Bins, y así seguirá en cada una: decide según el código, no según el estado. Consulta [Autenticación](/docs/authentication) para ver el formato de la petición.

### Validación de peticiones {#codes-validation}

| `code` | Estado | API | Qué es |
|---|---|---|---|
| `validation_error` | 422 | Todas | El cuerpo, la query o la ruta no han superado la validación o, en Webhooks, una regla que comprueba la propia API ha rechazado un campo. `details` es `{"errors": [...]}`, una lista de entradas. |
| `bad_request` | 400 | Todas | No se puede actuar sobre la petición tal como se envió. `message` dice por qué. En Inboxes y Request Bins, un cuerpo que la API no ha podido leer, como uno que no es UTF-8 válido. |
| `payload_too_large` | 413 | Todas | El cuerpo supera el límite de tamaño. |
| `method_not_allowed` | 405 | Todas | La ruta existe, pero no para este método. |

Cada entrada de validación describe un dato de entrada que falla: `loc` dice dónde (`["body", "event_type"]`), `type` dice qué está mal en un formato legible por máquinas (`missing`, `string_too_long`, `json_invalid`, …) y `msg` lo dice en inglés. Cuando la regla tiene un número, la entrada también lo lleva en `params`: `count` para una longitud (`string_too_short`, `string_too_long`, `too_short`, `too_long`) y `limit` para un límite (`greater_than`, `greater_than_equal`, `less_than`, `less_than_equal`). Un cuerpo que no es JSON válido también es un error de validación, con el tipo `json_invalid`; en Inboxes y Request Bins, en cambio, un cuerpo que no es UTF-8 válido es un `400` `bad_request`.

Webhooks también envía tipos de entrada propios, para reglas que comprueba la propia API:

- `webhooks.max_attempts_above_plan`: un `max_attempts` por encima del tope del plan, en `POST /v1/endpoints` o `PATCH /v1/endpoints/{id}`; `loc` `["body", "max_attempts"]`, con `params.count`, el tope.
- `webhooks.url_not_https`: una `url` de endpoint que no es https, en `POST /v1/endpoints`, `PATCH /v1/endpoints/{id}` o `POST /v1/operational-endpoints`; `loc` `["body", "url"]`.
- `webhooks.end_before_start`: un reenvío en bloque cuyo `to` es anterior a su `from`; `loc` `["body", "to"]`. Se permiten límites iguales.
- `webhooks.end_not_after_start`: en una ruta para los operadores de la plataforma, una ventana de consumo que no termina después de empezar; `loc` `["query", "end"]`.
- `webhooks.unknown_delivery_status`: un filtro `status` desconocido en `GET /v1/deliveries`; `loc` `["query", "status"]`, con `params.status`, el valor enviado.
- `webhooks.unknown_operational_event_type`: un valor de `event_types` que no es un tipo de evento operativo, en `POST /v1/operational-endpoints`; `loc` `["body", "event_types", <index>]`, una entrada por cada valor distinto, en su primer índice, con `params.event_type`, el valor, y `params.choices`, los tipos de evento operativos que acepta la API.

En esa misma ruta para los operadores de la plataforma, una fecha de la ventana de consumo que no se puede parsear es una entrada `date_parsing` en `["query", "start"]` o `["query", "end"]`, una por cada fecha así. Un rechazo de una regla que comprueba la propia API lleva como máximo 20 entradas.

Las reglas propias de Webhooks sobre las cabeceras personalizadas, los retrasos de `retry_schedule` y los campos del broker de una fuente de RabbitMQ envían entradas con su propio `type`, con el `loc` y el `msg` que han tenido siempre (salvo el nombre de cabecera que describe la nota del 2026-10-16), y `params` con los valores que nombra la regla:

- Más de 20 cabeceras personalizadas: `too_long`, con `params.count`, `20`.
- Un nombre de cabecera personalizada que no es un token HTTP válido: `webhooks.custom_header_name_invalid`, sin `params`.
- Un salto de línea u otro carácter de control en el valor de una cabecera personalizada: `webhooks.custom_header_control_character`, con `params.header`, el nombre de la cabecera.
- Un valor de cabecera personalizada de más de 1024 caracteres: `webhooks.custom_header_value_too_long`, con `params.header` y `params.count`, `1024`.
- Un nombre que la API reserva para sus propias cabeceras de entrega (`Content-Type`, `User-Agent` o cualquier nombre que empiece por `X-Webhook-`): `webhooks.custom_header_managed`, con `params.header`.
- Un nombre hop-by-hop o de control de la conexión, como `Host` o `Connection`: `webhooks.custom_header_forbidden`, con `params.header`.
- Un valor de cabecera personalizada con un carácter que no es ASCII: `webhooks.custom_header_not_ascii`, con `params.header`.
- Nombres y valores de cabeceras personalizadas que juntos ocupan más de 8192 bytes: `webhooks.custom_headers_too_large`, con `params.limit`, `8192`.
- Un retraso de `retry_schedule` por debajo de 0 o por encima de 604800 segundos: `webhooks.retry_delay_out_of_range`, con `params.limit`, `604800`.
- Una fuente de RabbitMQ creada sin todos sus campos del broker: `webhooks.broker_fields_required`, con `params.missing`, una lista de los campos (de entre `broker_identifier`, `broker_host`, `broker_user`, `broker_exchange` y `broker_topic`) que faltaban o estaban vacíos. Su `loc` es `["body"]`.

El `loc` de las reglas de cabeceras personalizadas es `["body", "custom_headers"]`, y `params.header` es el nombre tal como lo enviaste; el valor de una cabecera nunca se devuelve. Un nombre de plan que la API no conoce, en una ruta para los operadores de la plataforma, es una entrada `enum` sin `params`. Hasta la actualización que se indica al principio de esta página, todas estas entradas tenían el tipo `value_error`.

Inboxes envía un tipo de entrada propio: `inboxes.search_conflict`, para una búsqueda de mensajes en `GET /v1/inboxes/{id}/messages` o `GET /v1/messages` que indica un `header` con `in` igual a `subject`, `from` o `body`. Su `loc` es `["query", "in"]`, y no lleva `params` ([Búsqueda de mensajes](/docs/product-inboxes#search)).

Request Bins envía tres:

- `bins.nul_character`: un carácter NUL en la ruta, la query o un cuerpo JSON, que no puede almacenar. Su `loc` es `["path"]`, `["query", <name>]` o `["body"]`, y no lleva `params`.
- `bins.forward_target`: una URL de reenvío a la que un bin no reenvía. Su `loc` es `["body", "forward_url"]`, y `params.reason` dice por qué ([Reenvío](/docs/product-bins/reference#forwarding)).
- `bins.search_conflict`: una búsqueda en `GET /v1/bins/{id}/requests` o `GET /v1/requests` cuyo `header` o `field` no es compatible con su `in`, con el `loc` `["query", "in"]`, o que indica a la vez un `header` y un `field`, con el `loc` `["query", "field"]`. No lleva `params` ([Peticiones capturadas](/docs/product-bins/reference#requests)).

Una etiqueta de Inboxes que supera su límite en un carácter:

```json
{
  "error": {
    "code": "validation_error",
    "message": "request validation failed",
    "details": {
      "errors": [
        {
          "loc": ["body", "label"],
          "msg": "String should have at most 200 characters",
          "type": "string_too_long",
          "params": {"count": 200}
        }
      ]
    },
    "request_id": "a3e81f0c5b9d4e2f8c7a6b5d4e3f2a1b"
  }
}
```

En Webhooks, la misma entrada está en la misma lista `details.errors`, con el mismo código, y Request Bins la envía para un `label` de bin de más de 200 caracteres.

### Códigos de la API de Webhooks {#codes-webhooks}

Estos códigos pertenecen a los objetos propios de la API de Webhooks (tipos de evento, esquemas, fuentes, endpoints, entregas) y todos son `422`:

| `code` | Qué es |
|---|---|
| `unknown_event_type` | El tipo de evento no está en el catálogo de tu workspace, y el catálogo solo acepta tipos registrados. |
| `invalid_payload` | El payload no cumple el esquema registrado para su tipo de evento (`details.reason` `payload`, con `details.errors`), o un esquema que estás registrando no es JSON Schema válido (`schema_invalid`). |
| `schema_too_large` | Un JSON Schema que has registrado es demasiado grande o tiene demasiados niveles de anidamiento. |
| `schema_pattern_unsafe` | Un `pattern` de tu esquema es demasiado largo, no compila o podría tardar demasiado en ejecutarse. |
| `schema_ref_unsupported` | Tu esquema usa un `$ref` que la API no resuelve. |
| `provider_secret_required` | Rotar una fuente de Stripe o GitHub requiere el nuevo secreto de ese proveedor, y rotar una fuente de RabbitMQ requiere la nueva contraseña del broker. `details.provider` dice cuál: `stripe`, `github` o `rabbitmq`. |
| `broker_not_allowed` | Una fuente de RabbitMQ indica un broker al que la API no se conecta. |

### Plan y facturación {#codes-plan}

Todos estos códigos son `402`. Reintentar la misma petición nunca sirve: alguien tiene que cambiar el plan, saldar un pago, esperar al siguiente periodo de facturación o liberar una asignación, por ejemplo liberando una dirección o borrando un endpoint.

| `code` | API | Qué es |
|---|---|---|
| `quota_exceeded` | Ambas | Se ha superado un límite del plan: una asignación (Inboxes: direcciones; Webhooks: endpoints) o un tope mensual (Inboxes: mensajes; Webhooks: entregas), en cuyo caso esperas al siguiente periodo o subes de plan. En las dos APIs, `details.reason` dice cuál, y `details` indica `metric`, su `limit` y, para una asignación, el recuento `current`. |
| `quota_exceeded` | Request Bins | Se ha superado el límite de bins del plan, al crear uno. `details.reason` es `allocation`, y `details` indica `metric` (`bins`), su `limit` y el recuento `current`. El límite mensual de peticiones nunca rechaza una llamada a la API: una vez superado, los bins responden a sus emisores y no registran nada hasta el mes siguiente. |
| `not_entitled` | Todas | La función no está en tu plan, como la API de lectura en el plan gratuito de Inboxes, leer peticiones capturadas con una clave de API en el plan Free de Request Bins o una fuente de RabbitMQ en un plan inferior a Pro en Webhooks. `details.feature` la nombra. |
| `workspace_frozen` | Todas | Hay un cargo sin saldar, así que se rechazan los cambios. Sáldalo en la consola de tu cuenta; subir de plan también se rechaza hasta que lo hagas. |
| `workspace_suspended` | Todas | El periodo de gracia tras un cargo sin saldar ha terminado y el servicio se ha detenido para este workspace. |

`quota_exceeded` es un `402`, no un `429`. Un límite de tasa se despeja solo en segundos; una cuota, no.

En Webhooks, el límite de endpoints es `quota_exceeded` en `POST /v1/endpoints`, con `details.reason` `allocation`, `metric` `endpoints`, `limit` (el tope del plan) y `current` (los endpoints que tiene el workspace). Una fuente de RabbitMQ en un plan inferior a Pro es `not_entitled` con `details.feature` `rabbitmq_sources`: en `POST /v1/sources`, y en un `PATCH /v1/sources/{id}` de una fuente de RabbitMQ cuyo cuerpo pone `status` a `enabled` o define cualquiera de `broker_identifier`, `broker_host`, `broker_port`, `broker_vhost`, `broker_user`, `broker_exchange`, `broker_topic` o `broker_queues`, aunque sea con el valor que ya tiene. Los demás cambios, como renombrar o desactivar la fuente, siguen permitidos. Un `max_attempts` por encima del tope del plan no es un `402`: es un `422` `validation_error` ([Validación de peticiones](#codes-validation)).

En Request Bins, el límite de bins es `quota_exceeded` en `POST /v1/bins`. Leer peticiones capturadas con una clave de API en Free es `not_entitled`, con `details.feature` `read_api`, en `GET /v1/bins/{id}/requests`, `GET /v1/requests` y `GET /v1/requests/{id}`; la consola las lee en todos los planes. Mientras un workspace está congelado o suspendido, toda escritura salvo un borrado se rechaza con `workspace_frozen` o `workspace_suspended`, y las lecturas siguen permitidas. Los bins siguen registrando mientras el workspace está congelado y dejan de hacerlo mientras está suspendido ([Planes y límites](/docs/product-bins/reference#limits)).

### Recursos {#codes-resources}

| `code` | Estado | API | Qué es |
|---|---|---|---|
| `not_found` | 404 | Todas | El recurso no existe o no puedes verlo. Los dos casos son indistinguibles a propósito. `details.reason` nombra el tipo de recurso y `details.id`, el id que has pedido, cuando lo hay; una ruta que no existe no lleva `details` ([Qué lleva `details`](#details)). |

### Conflictos {#codes-state}

| `code` | Estado | API | Qué es |
|---|---|---|---|
| `conflict` | 409 | Webhooks | La petición choca con el estado existente: un nombre ya en uso o una `Idempotency-Key` reutilizada con otro cuerpo ([Idempotencia](/docs/idempotency#conflicts)). `details.reason` dice cuál, de entre los de la tabla siguiente. |

Cada `details.reason` que puede llevar un `conflict`, cuándo se envía y las demás claves de `details`:

| `details.reason` | Cuándo | Otras claves en `details` |
|---|---|---|
| `event_type_exists` | Ya hay un tipo de evento registrado con ese nombre en el mismo alcance: en todo el workspace o en el proyecto que has indicado. | `event_type`: el nombre |
| `project_not_empty` | Borrar un proyecto que todavía contiene endpoints o fuentes. Bórralos primero. | `id`: el proyecto. `endpoints` y `sources`: cuántos contiene |
| `idempotency_key_reuse` | Una `Idempotency-Key` reutilizada con otro cuerpo ([Idempotencia](/docs/idempotency#webhooks)). El evento original se mantiene. | `idempotency_key`: la clave |
| `delivery_not_redeliverable` | Volver a entregar una entrega que todavía está en cola o enviándose. Solo se puede volver a entregar una entrega `sent`, `failed` o `dead`. | `id`: la entrega. `state`: `queued`, `sending`, `sent`, `failed` o `dead`, o `missing` si la entrega se ha borrado entretanto |
| `delivery_exists` | Reenviar un evento a un endpoint que ya tiene una entrega de ese evento. Vuelve a entregar esa entrega en su lugar. | `event_id` y `endpoint_id` |
| `endpoint_not_enabled` | Reenviar un evento a un endpoint que está desactivado, por ti o automáticamente tras fallos repetidos. | `id`: el endpoint. `state`: `disabled` (por ti) o `auto_disabled` (automáticamente) |
| `endpoint_suspended` | Reenviar un evento a un endpoint que hemos suspendido. | `id`: el endpoint. `cause`: `abuse`, `non_payment` o `plan_downgrade`; el más grave cuando se aplican varios, y ausente cuando no se aplica ninguno |
| `endpoint_has_pending_deliveries` | Borrar un endpoint que todavía tiene entregas en cola, enviándose o esperando un reintento. El endpoint queda desactivado aunque se haya rechazado el borrado, así que no le llegan entregas nuevas; vuelve a intentar el borrado cuando se resuelvan. | `id`: el endpoint. `count`: sus entregas pendientes |
| `replay_across_projects` | Reenviar un evento a un endpoint de otro proyecto. | `event_id` y `endpoint_id` |

Un reenvío en bloque cuyo `from` es posterior a su `to` no es un conflicto: es un `422` `validation_error` ([Validación de peticiones](#codes-validation)).

### Límites de tasa {#codes-rate}

| `code` | Estado | API | Qué es |
|---|---|---|---|
| `rate_limited` | 429 | Ambas | Demasiadas peticiones. Si `Retry-After` está presente, espera esos segundos y reintenta; si no, aplica backoff. `details.retry_after` lleva el mismo número en las dos APIs, y en Inboxes un límite por inbox también pone `details.reason` a `inbox_rate`, con `details.rate_per_min`. |

La API de Request Bins no envía `rate_limited`. Las URLs de sus bins limitan la velocidad a la que pueden enviar los emisores, y responden a un emisor que supera el límite con un `429` y `Retry-After`, no con este formato JSON ([Qué responde la URL de un bin](/docs/product-bins/reference#edge-answers)).

### Servidor {#codes-server}

| `code` | Estado | API | Qué es |
|---|---|---|---|
| `internal_error` | 500 | Todas | Algo ha fallado por nuestra parte. Es seguro reintentar las peticiones idempotentes. |
| `unavailable` | 503 | Inboxes | No se puede atender la petición temporalmente: la aceptación de mensajes está desactivada y `details.reason` es `ingest_disabled`. Reintenta con backoff. |

Un `502` o un `504` del edge que hay delante de las APIs puede llegar sin ningún cuerpo JSON. Trata como reintentable un `5xx` que no puedas parsear.

### Resultados de las pruebas y verificaciones {#failure-reason}

Probar o verificar un endpoint de Webhooks (`POST /v1/endpoints/{id}/test`, `POST /v1/endpoints/{id}/verify`) le envía una petición y responde `200` con el resultado, tanto si esa petición ha tenido éxito como si no, así que un fallo ahí no es una respuesta de error. `delivered` en una prueba, o `verified` en una verificación, dice si ha funcionado. En caso de fallo, `error` lo describe en inglés y `failure_reason` lo nombra con una cadena estable pensada para máquinas:

| `failure_reason` | Qué ha pasado |
|---|---|
| `http_status` | El endpoint ha respondido con un estado fuera de `2xx`; `status_code` dice cuál. |
| `timeout` | No ha habido respuesta dentro del timeout del endpoint. |
| `tls_failed` | El handshake TLS ha fallado, en la mayoría de los casos porque el certificado no supera la verificación. |
| `dns_failed` | El host no se resuelve. |
| `connection_failed` | Cualquier otro fallo de conexión, como una conexión rechazada, reiniciada o inalcanzable. |
| `blocked_address` | El host se resuelve a una dirección privada o no pública por algún otro motivo, a la que Webhooks nunca envía nada. |
| `challenge_not_echoed` | Solo en verificación: el endpoint ha respondido `2xx` sin el token del desafío en su cuerpo. |
| `url_changed` | Solo en verificación: la URL del endpoint ha cambiado mientras el desafío estaba en curso. Vuelve a verificar. |

`failure_reason` es `null` en caso de éxito, y en un fallo que no describe ninguno de estos valores, en el que `error` es la única descripción. Igual que `code`, es una cadena abierta, no un enum: mantén un caso por defecto para un valor que no conozcas, y decide según `failure_reason` en lugar de parsear `error`.

## Cuando se renombra un código {#renames}

Inboxes y Webhooks terminaron sus cambios de nombre el 2026-10-15, antes del lanzamiento de la v1, en lugar de al cabo de 12 meses. En Inboxes, `invalid_request` ahora es `validation_error`, una clave de API o un token que no reconoce o no puede verificar es `invalid_credential` (sigue siendo un `401`) y un estado sin código propio lleva el código de ese estado, como `bad_request` para un `400`. En Webhooks, `internal` ahora es `internal_error`, `unprocessable` ahora es `validation_error` y `plan_violation` ha desaparecido: cada uno de sus rechazos envía el código que indicaba su `next_code`, con el estado de ese código. Hoy ninguna de las dos APIs envía `next_code`. Después del lanzamiento de la v1, cada cambio de nombre se anuncia en el [changelog](/changelog), y la grafía antigua se sigue enviando en `error.code` durante al menos 12 meses a partir de entonces, el mismo periodo que la [política de obsolescencia](/docs/versioning#deprecation) da a un campo.

Mientras un cambio de nombre está en curso, el error también lleva `next_code`: la grafía que tendrá `code` cuando se complete el cambio. Ese campo, y no una cabecera de respuesta `Deprecation`, es la forma en que un error te indica que su código se está renombrando.

Decide según `next_code` cuando esté presente y según `code` en caso contrario (`error.next_code ?? error.code`). Un handler escrito así no necesita ningún cambio cuando se completa un cambio de nombre: a partir de entonces, `code` lleva la grafía nueva y `next_code` deja de enviarse para ese código. Si solo puedes leer `code`, por ejemplo a través de un SDK que solo pasa `code`, contempla las dos grafías hasta que se complete el cambio.

Los cambios de nombre que se aplicaron el 2026-10-15, con los rechazos que cambiaron con ellos:

| API | Situación | Antes | Ahora |
|---|---|---|---|
| Inboxes | Una petición que no supera la validación | `422` `invalid_request`, `next_code` `validation_error` | `422` `validation_error` |
| Inboxes | Una clave de API o un token que no reconoce, o uno que no supera la verificación | `401` `unauthorized`, `next_code` `invalid_credential` | `401` `invalid_credential` |
| Inboxes | Un estado sin código propio, como un cuerpo que no es UTF-8 válido | `error`, `next_code` el código que ese estado tiene en otros casos | el código de ese estado, como `400` `bad_request` |
| Inboxes | Una credencial limitada a ciertos proyectos | `403` `forbidden`, `details.reason` `project` | `403` `forbidden`, `details.reason` `project_confined` |
| Inboxes | `quota_exceeded`, el `not_entitled` de la API de lectura y el `rate_limited` por inbox | `details` también llevaba `max_inboxes`, `max_http_bins`, `monthly_messages`, `plan` o `inbox_id` | `details` solo lleva las claves que enumera [Qué lleva `details`](#details) |
| Webhooks | Todo `500` | `internal`, `next_code` `internal_error` | `internal_error` |
| Webhooks | Un campo que comprueba la propia API (una `url` de endpoint que no es https, un filtro `status` o un tipo de evento operativo desconocidos, una ventana de consumo que no se puede parsear o que no termina después de empezar) | `422` `unprocessable`, `next_code` `validation_error` | `422` `validation_error` |
| Webhooks | El límite de endpoints (`POST /v1/endpoints`) | `402` `plan_violation`, `next_code` `quota_exceeded` | `402` `quota_exceeded`, `details.reason` `allocation` |
| Webhooks | Un `max_attempts` por encima del tope del plan (`POST /v1/endpoints`, `PATCH /v1/endpoints/{id}`) | `402` `plan_violation`, `next_code` `validation_error` | `422` `validation_error`, tipo de entrada `webhooks.max_attempts_above_plan` |
| Webhooks | Una fuente de RabbitMQ en un plan inferior a Pro | `402` `plan_violation`, `next_code` `not_entitled` | `402` `not_entitled`, `details.feature` `rabbitmq_sources` |
| Webhooks | Desactivar la verificación de endpoints en un plan que la exige (`PATCH /v1/workspace`); hoy ningún plan lo hace | `402` `plan_violation`, `next_code` `not_entitled` | `402` `not_entitled`, `details.feature` `optional_endpoint_verification` |
| Webhooks | Un reenvío en bloque cuyo `from` es posterior a su `to` (`POST /v1/deliveries/replay`) | `409` `conflict`, `details.reason` `replay_window_inverted` | `422` `validation_error`, tipo de entrada `webhooks.end_before_start` en `["body", "to"]` |
| Webhooks | Las reglas propias de Webhooks sobre cabeceras personalizadas, `retry_schedule`, campos del broker y nombres de plan | tipo de entrada `value_error` | el tipo de entrada propio de la regla ([Validación de peticiones](#codes-validation)); `loc`, `msg` y `params` sin cambios |
| Webhooks | Cualquier error de validación | `details`: una lista de entradas | `details`: `{"errors": [...]}`, como en Inboxes |

Un handler que decidía según `error.next_code ?? error.code` obtiene el mismo código que antes en todas las situaciones anteriores salvo en el reenvío en bloque. Uno que leía `error.details` como una lista en un error de validación de Webhooks ahora lee `error.details.errors`; uno que leía las claves eliminadas del `quota_exceeded` de Inboxes lee `metric`, `limit`, `current` y `period`; uno que comparaba con el motivo `project` del `forbidden` de Inboxes compara con `project_confined`; y uno que comparaba con el `type` de entrada `value_error` de Webhooks compara con el tipo propio de la regla.

`unauthorized` no se ha retirado: sigue siendo el código para una credencial que falta o que se ha revocado en las dos APIs, para una sesión que ha terminado en Inboxes y para un evento entrante cuya firma no supera la verificación en Webhooks.

## Códigos que esta página enumeraba antes {#earlier-versions}

Versiones anteriores de esta página enumeraban los códigos y campos de la izquierda. Las APIs no los enviaban; envían lo que aparece a la derecha. Dos de ellos se han hecho realidad desde entonces, `request_id` en los cuerpos de error e `internal_error` en todas las APIs, y sus filas explican cómo.

| Versiones anteriores enumeraban | Las APIs envían |
|---|---|
| `validation_failed` (400) | `validation_error` (422) |
| `fields` | `details`: `{"errors": [...]}` en las dos APIs |
| `request_id` en todos los cuerpos | No se enviaba mientras esas versiones estaban vigentes: el id solo estaba en la cabecera de respuesta `X-Request-ID`. Desde las actualizaciones que se indican al principio de esta página, todos los cuerpos de error que envían las APIs también lo llevan, como `error.request_id`, con el mismo valor que la cabecera ([El id de la petición](#request-id)). |
| `malformed_json` (400), `unsupported_content_type` (415) | `validation_error` (422) |
| `request_too_large` | `payload_too_large` (413) |
| `no_credentials` (401) | `unauthorized` (401) |
| `invalid_credentials`, `expired_credentials` (401) | `invalid_credential`: un `403` en Webhooks, un `401` en Inboxes. Una sesión que ha caducado es `unauthorized` (401) en Inboxes |
| `scope_required`, `wrong_project` (403) | `forbidden` (403); `details.reason` dice por qué (`scope`, `project`, `project_confined`, …) y `details.required` nombra un alcance que falta |
| `already_exists`, `state_conflict`, `not_empty`, `idempotency_key_reused` (409) | `conflict` (409); `details.reason` dice cuál (`event_type_exists`, `project_not_empty`, `idempotency_key_reuse`, …) |
| `rate_limit_exceeded` | `rate_limited` (429) |
| `quota_exceeded` como 429 | `quota_exceeded` como 402 |
| `internal_error` en todas las APIs | `internal_error` en las dos APIs desde el 2026-10-15; antes, Webhooks enviaba `internal` |
| `service_unavailable` (503), `gateway_timeout` (504) | `unavailable` (503) en Inboxes, cuando la aceptación de mensajes está desactivada; un `502`/`504` del gateway puede no tener cuerpo JSON |

## Patrón de tratamiento {#pattern}

```ts
async function call(): Promise<Event> {
  const res = await fetch(url, opts)
  if (res.ok) return await res.json()

  // A gateway 502/504 can arrive without a JSON body
  const body = await res.json().catch(() => null)
  const error = body?.error ?? { code: 'error', message: res.statusText }
  // Log this with every error; the header carries it when the body doesn't
  const requestId = error.request_id ?? res.headers.get('X-Request-ID')
  // While a code is being renamed, next_code is what it will become: prefer it
  const code = error.next_code ?? error.code

  // Switch on the code, not the status: one status can carry several codes
  switch (code) {
    case 'rate_limited': {
      const wait = Number(res.headers.get('Retry-After') ?? '1')
      await sleep(wait * 1000)
      return call() // retry
    }
    case 'invalid_credential': // All: a key the API can't accept (403 on Webhooks, 401 on Inboxes and Request Bins)
    case 'unauthorized': // All: no usable credential
      // The credential is missing or bad: replace it rather than retry with it
      throw new CredentialError(error, requestId)
    case 'forbidden': {
      // Optional refinement: why it was refused, and what would have been allowed
      const reason = error.details?.reason // 'scope', 'role', 'project', 'project_confined', 'csrf', …
      const required = error.details?.required // 'admin', 'member', 'read' or 'publish', when sent
      throw new PermissionError(error, requestId, reason, required)
    }
    case 'validation_error': { // All
      const entries = error.details?.errors ?? []
      throw new ValidationError(entries, requestId)
    }
    case 'quota_exceeded':
    case 'not_entitled':
      // Retrying won't help; the plan has to change, or the period has to roll over
      throw new PlanError(error, requestId)
    default:
      // Unknown code, but the family tells us the rough shape
      if (res.status >= 500) {
        // Server-side; safe to retry idempotent ops
        throw new RetryableError(error, requestId)
      }
      throw new TerminalError(error, requestId)
  }
}
```

La regla general: **decide según `error.next_code ?? error.code` y, por defecto, trata el error según la familia del código de estado**. Los códigos nuevos que se añadan a estados existentes no te romperán nada; tu caso por defecto los trata. `details.reason` precisa un caso y nunca lo sustituye: un motivo que no reconoces recibe el tratamiento del código. No parsees `message`; cuando un valor está pensado para que lo use el código, como el id que no se ha encontrado o el límite que se ha alcanzado, está en `details`. La misma regla vale para un panel o un SDK construido sobre estas APIs: los [SDKs](/docs/product-webhooks/sdks) publicados pasan `error.code` sin cambios, así que decide según el código que lleva la excepción, y contempla las dos grafías de un código que se está renombrando.

## Cómo notificar bugs {#bugs}

Cada respuesta que envía una API lleva una cabecera `X-Request-ID`, también las de error, y las APIs permiten que el JavaScript del navegador la lea. Sus cuerpos de error llevan el mismo id como `error.request_id`. Cuando algo va mal por nuestra parte (5xx, comportamiento inesperado), el id de la petición es lo que nos permite encontrar la llamada en nuestros logs. Regístralo junto a cada error e inclúyelo en los tickets de soporte.

No compartas los ids de petición en público (no son secretos, pero permiten a cualquiera que los tenga preguntarnos por el tráfico de tu cuenta). Úsalos en canales privados (soporte, tickets desde la consola).

## Próximos pasos {#next-steps}

- [Convenciones](/docs/conventions) — el resto del formato de petición/respuesta.
- [Autenticación](/docs/authentication) — los códigos de error de autenticación en contexto.
- [Límites de tasa](/docs/rate-limiting) — el funcionamiento de `Retry-After` en detalle.
- [Idempotencia](/docs/idempotency) — el patrón de reintento seguro para los casos 5xx + 429.
- [Política de versionado](/docs/versioning) — qué cuenta como cambio incompatible, y el periodo de obsolescencia de 12 meses que también se aplica al cambio de nombre de un código.
