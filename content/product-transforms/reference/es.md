---
title: "Referencia de Transforms"
description: "Todas las rutas de la API de Transforms, los objetos pipeline y ejecución, quién puede hacer qué, los límites de cada plan y los errores."
publishedAt: 2026-11-06
updatedAt: 2026-11-06
kind: reference
---

# Referencia de Transforms

La API en `https://transforms.nimbusnexus.net/v1` crea, versiona, prueba y ejecuta pipelines, solo para tu workspace. Las peticiones y las respuestas son JSON. Envía una clave como `Authorization: Bearer <key>` o `X-API-Key: <key>` ([Cómo obtener acceso](/docs/product-transforms#access)). Los timestamps son ISO 8601 en UTC. El [resumen](/docs/product-transforms) explica el producto, y [Pipelines](/docs/product-transforms/pipelines), el documento.

## Rutas {#routes}

| Ruta | Qué hace | Requiere |
| --- | --- | --- |
| `POST /v1/pipelines` | Crea una pipeline y su versión 1; `201` con [la pipeline](#pipeline) | write; con un paso de credencial, admin |
| `GET /v1/pipelines` | Las pipelines del workspace, de la más reciente a la más antigua, cada una sin su documento | read |
| `GET /v1/pipelines/{id}` | Una pipeline, con su documento actual y dónde se ejecuta | read |
| `PATCH /v1/pipelines/{id}` | Cambia su nombre, la activa o la desactiva, o [guarda una versión nueva](#versions) | write; con un paso de credencial nuevo, admin |
| `DELETE /v1/pipelines/{id}` | Borra una pipeline y sus versiones, definitivamente; `204` | admin |
| `GET /v1/pipelines/{id}/versions` | Las versiones guardadas, de la más reciente a la más antigua, cada una sin su documento | read |
| `GET /v1/pipelines/{id}/versions/{version}` | Una versión, con su documento | read |
| `POST /v1/pipelines/{id}/run` | [Ejecuta](#run) una pipeline guardada con una petición | read |
| `POST /v1/pipelines/test` | [Prueba](#test) un documento con una petición, y no guarda ni cuenta nada | write |
| `GET /v1/pipelines/templates` | Las [plantillas](/docs/product-transforms/pipelines#templates) de las que partir | read |
| `POST /v1/slots` | Añade un [slot de credenciales](#slots); `201` con el slot | admin |
| `GET /v1/slots`, `GET /v1/slots/{id}` | Los slots del workspace, del más reciente al más antiguo, o uno de ellos | read |
| `PATCH /v1/slots/{id}` | Cambia el nombre de un slot | admin |
| `DELETE /v1/slots/{id}` | Borra un slot; `204` | admin |
| `GET /v1/plan` | El plan del workspace y sus límites | read |
| `GET /v1/usage` | Las ejecuciones de este mes y lo que tiene el workspace | read |

**read**, **write** y **admin** se explican en [Quién puede hacer qué](#authority).

Las listas se paginan con `limit` (de 1 a 200, 50 por defecto) y `offset` (de 0 a 10,000). La respuesta es `{"items": [...], "next_offset": <offset>}`: devuelve `next_offset` como `offset` para obtener la página siguiente. Es `null` en la última página.

## El objeto pipeline {#pipeline}

| Campo | Qué es |
| --- | --- |
| `id` | `pipe_` y 24 caracteres hexadecimales. Lo usan todas las rutas, y un producto hace referencia a la pipeline por él. |
| `name` | El nombre que le das, hasta 200 caracteres. |
| `status` | `enabled` o `disabled`: tu interruptor. Una pipeline desactivada no se ejecuta, ni aquí ni en ningún producto que haga referencia a ella. |
| `current_version` | La versión que se ejecuta. |
| `pipeline` | El documento de la versión actual; `null` en la lista. |
| `destinations` | Los servicios que la ejecutan por referencia, cada uno una sola vez; `null` en la lista ([Quién ejecuta una pipeline](#destinations)). |
| `consumers` | Qué ejecuta cada uno de ellos: `service`, `version`, `last_seen_at`, su última lectura de esa versión, y `pinned`, `true` cuando una referencia fija esa versión; `null` en la lista. |
| `created_at`, `updated_at` | Cuándo se creó, y cuándo cambió por última vez. |

`POST /v1/pipelines` acepta `name` y `pipeline`. Un documento que nunca podría ejecutarse se rechaza con [`422` `invalid_pipeline`](#invalid-pipeline), y por encima de las pipelines del plan la respuesta es `402` `quota_exceeded`, con `details.metric` `pipelines`, `details.limit` y `details.current`.

## Versiones {#versions}

`PATCH /v1/pipelines/{id}` acepta cualquiera de `name`, `status` y `pipeline`. Una `pipeline` nueva se comprueba igual que al crearla, y se guarda como la versión siguiente.

- Una versión nunca cambia, así que un producto puede conservar su copia por id y versión.
- Guardar el mismo contenido no añade ninguna versión.
- Restaurar una versión anterior es volver a guardar su contenido, lo que la convierte en la más reciente.
- Se conservan las versiones que permite el plan, empezando por las más recientes, y al guardar se eliminan las más antiguas que las superan. Una versión que un producto fija, o que se ha visto ejecutándose en un producto en los últimos 30 días, también se conserva.

Cada versión en `GET /v1/pipelines/{id}/versions` tiene `version`, `created_by` y `created_at`; `GET /v1/pipelines/{id}/versions/{version}` añade su `pipeline`. Una versión que ya no se guarda responde `404` `not_found`, `pipeline_version`.

## Ejecuta una pipeline {#run}

`POST /v1/pipelines/{id}/run` ejecuta la versión actual, o la versión guardada que nombre `version`, con lo que envías:

| Campo | Qué es |
| --- | --- |
| `body` | Cualquier valor JSON, de hasta 256 KiB como JSON compacto y con 32 niveles de anidamiento como máximo. |
| `headers` | Un valor por cada nombre. |
| `meta` | Contexto de solo lectura para `$meta`: cualquier valor JSON, con 32 niveles de anidamiento como máximo. |
| `version` | La versión guardada que se ejecuta. Sin este campo, la actual. |

No se guarda nada de la petición, y la ejecución se cuenta. La respuesta es un `200`, haga lo que haga la pipeline:

| Campo | Qué es |
| --- | --- |
| `status` | `ok`, envía `body` y `headers`; `dropped`, un filtro descartó la petición, así que no envíes nada; `failed`, la pipeline no puede ejecutarse con esta petición. |
| `version` | La versión que se ejecutó; `null` en una [prueba](#test). |
| `body`, `body_changed` | El cuerpo que hay que enviar, y `true` cuando un paso lo reescribió. `null` salvo con `ok`. |
| `headers` | Las cabeceras que hay que enviar, con el valor de una credencial enmascarado como `Bearer ••••`. |
| `query` | Lo que un paso `auth` añade a la URL, enmascarado de la misma forma. |
| `step` | El paso que descartó la petición o la hizo fallar, contado desde 0; si no, `null`. |
| `note` | La nota del paso que descartó la petición. |
| `reason` | `no_match` para un filtro con el que la petición no coincidió, `matched` para un filtro de descarte con el que sí coincidió, o por qué falló, como `set_conflict` o `too_many_nodes`. Trátalo como una cadena abierta. |
| `error` | Lo mismo con palabras, como `step 2: set_conflict: …`. |
| `duration_ms` | Cuánto tardó la ejecución. |

La misma pipeline falla igual con la misma petición, así que no reintentes un `failed`. Una pipeline desactivada responde `409` `conflict`, `pipeline_disabled`, y por encima de la tasa del plan una ejecución responde `429` `rate_limited`, con `details.retry_after`.

## Prueba un documento {#test}

`POST /v1/pipelines/test` acepta `pipeline`, un documento que no hace falta guardar, con `body`, `headers` y `meta`. Se comprueba igual que al guardarlo, se ejecuta una vez y no guarda ni cuenta nada, aunque comparte la tasa del plan. Un descarte o un fallo es un `200` que lo indica.

## Slots de credenciales {#slots}

Un slot es lo que nombra un paso `auth`: un id y una etiqueta, sin ningún valor. Transforms no guarda ninguna credencial, y ninguna ruta acepta una. Un producto que ejecuta la pipeline por referencia asigna el slot a un secreto propio ([Credenciales](/docs/product-transforms#credentials)). `POST /v1/slots` acepta `label`, de hasta 200 caracteres, y responde `201`:

| Campo | Qué es |
| --- | --- |
| `id` | `sec_` seguido de letras y dígitos: lo que nombra un paso `auth`, y nunca cambia. |
| `label` | Para qué es la credencial. Los productos ven esta etiqueta cuando asignan el slot a un secreto. |
| `pipeline_count` | En cuántas pipelines lo nombra la versión actual. |
| `created_at`, `updated_at` | Cuándo se añadió, y cuándo se renombró por última vez. |

`PATCH /v1/slots/{id}` acepta `label`. `DELETE /v1/slots/{id}` responde `204`, o `409` `conflict` con `details.reason` `slot_in_use`, `details.id` y `details.pipelines`, el número de pipelines, mientras lo nombre la versión actual de una pipeline. Por encima de los slots del plan, añadir uno responde `402` `quota_exceeded`, con `details.metric` `slots`.

## Quién ejecuta una pipeline {#destinations}

Un producto hace referencia a una pipeline por su id y la ejecuta en su propio proceso, con sus propios secretos. Webhooks es el primero: [Transformaciones](/docs/product-webhooks/transformations#reference). Cada vez que un producto obtiene la pipeline se anotan el servicio y la versión, así que al leer una pipeline se ven `destinations` y `consumers`.

Guardar una versión nueva con un paso `auth` llega a todos los productos que ejecutan la pipeline, y borrarla también. Cada una de esas llamadas tiene que nombrar en `confirm_destinations` a todos los servicios que tienen una referencia o se han visto en los últimos 30 días, en el cuerpo de un `PATCH` y en la query de un `DELETE`. Si no, la respuesta es un `409` `conflict` con `details.reason` `destinations_unconfirmed` y `details.destinations`, y no cambia nada. Las URLs propias de un servicio nunca aparecen aquí: ese producto pide la misma confirmación para ellas.

## Quién puede hacer qué {#authority}

| | Leer pipelines, versiones, plantillas, slots, plan y consumo; ejecutar | Crear, cambiar y probar pipelines | Borrar una pipeline, guardar un paso de credencial, o añadir, renombrar o borrar un slot |
| --- | --- | --- | --- |
| Propietario o administrador del workspace | sí | sí | sí |
| Miembro | sí | sí | no |
| Lector, o cualquier otro rol | sí | no | no |
| Clave con **Read & write** (alcance `admin`) | sí | sí | sí |
| Clave con **Read** (alcance `read`) | sí | no | no |

Una acción rechazada responde `403` `forbidden` con `details.reason` `role`, y `details.required` indica el rol que necesita. Un miembro sí puede renombrar una pipeline con un paso de credencial, ejecutarla, probarla y quitar ese paso. La consola de la cuenta crea claves **Read** y **Read & write**, y una clave con cualquier otro alcance, como `write`, se trata como **Read**.

Transforms da servicio a workspaces completos. Un puesto de invitado, o una clave limitada a un proyecto, se rechaza con `403` `project_confined`. Un workspace tiene Transforms en cuanto un propietario o administrador ha abierto la consola, o lo ha añadido desde **Add a product**. Hasta entonces, a los demás miembros se les rechaza con `403` `product_not_enabled`.

## Planes y límites {#limits}

`GET /v1/plan` indica qué límites se aplican: `plan`, el plan registrado; `enforced_as`, el plan cuyos límites se aplican, `free` si no hay ninguno; `ceilings`, los límites por nombre; `past_due`, `suspended` y `system`.

| Clave de `ceilings` | Qué es | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- | --- |
| `max_pipelines` | Pipelines que puede tener un workspace | 5 | 25 | 100 | 1,000 |
| `max_secret_slots` | Slots de credenciales que puede tener un workspace | 5 | 25 | 100 | 1,000 |
| `max_versions` | Versiones guardadas por pipeline | 10 | 25 | 50 | 100 |
| `run_rate_per_min` | Ejecuciones y pruebas por minuto, por workspace | 60 | 600 | 3,000 | 12,000 |

Pueden llegar a la vez hasta el equivalente a diez segundos de ejecuciones, y como mínimo 10. `GET /v1/usage` indica cuánto se ha usado: `period`, el mes, expresado como su primer día; `runs`, `failures` y `dropped` de este mes, a través de la API de ejecución; `pipelines`, frente a `max_pipelines`; y `slots`, los slots que tienes, frente a `max_secret_slots`. Las ejecuciones se cuentan, no se facturan, y una ejecución en un producto que hace referencia a la pipeline cuenta en el consumo de ese producto.

Mientras hay un cargo sin saldar, los cambios se rechazan con `402` `workspace_frozen`, y las ejecuciones y las pruebas siguen funcionando. Una vez que ha terminado el periodo de gracia, las ejecuciones y las pruebas también se rechazan, con `402` `workspace_suspended`. Las lecturas y los borrados siguen permitidos.

## Errores {#errors}

Los errores de la API usan el formato descrito en [Errores](/docs/errors).

| Estado | `code` | Cuándo |
| --- | --- | --- |
| `400` | `bad_request` | Un cuerpo JSON que no es UTF-8 válido. |
| `401` | `unauthorized` | Sin credencial, una credencial revocada o una sesión de consola que ha terminado; `details.reason` indica cuál. |
| `401` | `invalid_credential` | Una clave que no se verifica, ha caducado o se creó para otro producto. |
| `402` | `quota_exceeded` | Crear una pipeline o añadir un slot cuando todas las pipelines o todos los slots del plan están en uso; `details.metric` es `pipelines` o `slots`. |
| `402` | `workspace_frozen`, `workspace_suspended` | Un cambio mientras hay un cargo sin saldar, o cualquier cosa que no sea una lectura o un borrado después de que se haya interrumpido el servicio. |
| `403` | `forbidden` | `details.reason` es `role`, `project_confined`, `product_not_enabled`, `csrf` o `no_workspace`. |
| `404` | `not_found` | No existe esa pipeline, esa versión o ese slot en tu workspace; `details.reason` es `pipeline`, `pipeline_version` o `slot`. |
| `405` | `method_not_allowed` | La ruta existe, pero no para este método. |
| `409` | `conflict` | `details.reason` es `pipeline_disabled` ([Ejecuta una pipeline](#run)), `destinations_unconfirmed` ([Quién ejecuta una pipeline](#destinations)) o `slot_in_use` ([Slots de credenciales](#slots)). |
| `413` | `payload_too_large` | Un cuerpo de petición de más de 1 MiB. |
| `422` | `invalid_pipeline` | Una pipeline que nunca podría ejecutarse, al guardarla o al probarla. |
| `422` | `validation_error` | Un parámetro o un campo no ha superado la validación. Un carácter NUL en la ruta, la query o un cuerpo JSON es el tipo de entrada `transforms.nul_character`. |
| `429` | `rate_limited` | Se han superado las ejecuciones por minuto del plan; `details.retry_after` indica cuándo volver a intentarlo. |
| `500` | `internal_error` | Algo ha fallado por nuestra parte. |

### Pipelines no válidas {#invalid-pipeline}

El rechazo nombra el primer problema: `details.reason`, `details.path` (un JSON Pointer hasta él) y `details.step` (contado desde 0), cada uno cuando corresponde.

```json
{ "error": { "code": "invalid_pipeline", "message": "…", "details": { "reason": "credential_header", "path": "/steps/0/headers/set/Authorization", "step": 0 }, "request_id": "…" } }
```

| `reason` | Qué está mal |
| --- | --- |
| `invalid_document` | No es un objeto con una `version` y una lista de `steps`. |
| `unsupported_version` | `version` no es `1`. |
| `no_steps` | No hay pasos. |
| `too_many_steps` | Hay más de 20 pasos. |
| `invalid_step` | Un paso no es un objeto con una sola clave de paso, sin nada más al lado que una `note` y, en un filtro, una `action`. |
| `unknown_step` | Una clave de paso no es `filter`, `drop`, `set`, `map`, `headers` ni `auth`. |
| `invalid_value` | Un ajuste no es de los que acepta su paso, como un `drop` vacío o una nota de más de 200 caracteres. |
| `invalid_path` | Una ruta no se puede leer, o lleva un comodín donde su paso no lo acepta. |
| `invalid_template` | Una expresión no se puede leer, o nombra un filtro que no existe. |
| `invalid_filter` | Un filtro no es válido, por ejemplo porque usa un operador desconocido. |
| `invalid_header` | Un nombre de cabecera no es válido o pertenece a la conexión, o un valor no es ASCII imprimible en una sola línea. |
| `invalid_secret` | El `secret` de un paso `auth` no es el id de un slot. Un valor pegado ahí nunca se repite en un mensaje. |
| `auth_not_last` | Hay un paso después de un paso `auth`. |
| `too_deep` | Algo está anidado a más de 32 niveles. |
| `too_large` | La configuración de un paso supera los 16 KiB, o el documento supera los 64 KiB. |
| `not_json` | Contiene un valor que no es JSON. |
| `forbidden_header` | Un paso pone `Set-Cookie`, una cabecera que ninguna petición lleva. |
| `credential_header` | Un paso de cabeceras pone `Authorization`, `Cookie` o `X-Api-Key`, lo que guardaría la credencial en la pipeline. Añádela con un paso `auth` en su lugar. |
| `unknown_slot` | Un paso `auth` nombra un slot que el workspace no tiene. |

Trata `reason` como una cadena abierta, y ten un caso por defecto para un valor que no conozcas.

## Próximos pasos {#next-steps}

- [Inicio rápido](/docs/product-transforms/quickstart) — prueba una pipeline, guárdala y ejecútala.
- [Pipelines](/docs/product-transforms/pipelines) — todos los pasos, rutas, filtros y plantillas.
- [Errores](/docs/errors) — el formato de error, todas las claves de `details` y un patrón para tratarlos.
