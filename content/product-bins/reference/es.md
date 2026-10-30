---
title: "Referencia de Request Bins"
description: "Todas las rutas de la API de Request Bins, qué responde y qué registra la URL de un bin, quién puede hacer qué y los límites de cada plan."
publishedAt: 2026-10-22
updatedAt: 2026-10-30
kind: reference
---

# Referencia de Request Bins

Request Bins tiene dos partes. **Las URLs de los bins** en `nnbin.net` aceptan peticiones de cualquiera y las registran. **La API** en `https://bins.nimbusnexus.net/v1` crea y gestiona bins y lee lo que registraron, solo para tu workspace. Esta página cubre ambas, y después quién puede hacer qué y los límites de cada plan. El [resumen](/docs/product-bins) explica el producto, y el [inicio rápido](/docs/product-bins/quickstart) lo recorre paso a paso.

## URLs de los bins {#edge}

| | |
| --- | --- |
| URL | `https://nnbin.net/b/<slug>`, y cualquier ruta bajo ella: `https://nnbin.net/b/<slug>/<anything>` |
| Slug | 12 caracteres: las letras `a`–`z` excepto `l` y `o`, y los dígitos `2`–`9`. No distingue entre mayúsculas y minúsculas. |
| Métodos | Cualquiera: `GET`, `POST` y los demás habituales, `PROPFIND` o `COPY` de WebDAV, o uno propio del emisor. El método se registra en mayúsculas, cortado a 16 caracteres. `TRACE` y `CONNECT` se rechazan antes de llegar al bin y nunca se registran. |
| Ruta registrada | Todo lo que va después del slug, tal como se envió, conservando la codificación por porcentaje: `/b/<slug>/stripe/events` registra `/stripe/events`, y `/b/<slug>` registra `/`. |
| Query registrada | La query tal como se envió, sin el `?`. |

### Qué responde la URL de un bin {#edge-answers}

| Estado | Cuerpo | Cuándo |
| --- | --- | --- |
| `200` | `{"status":"accepted"}` | Toda petición a un slug bien formado, se registre o no, salvo que se aplique una de las filas siguientes. Un bin que no existe, se borró, ha caducado, está desactivado o suspendido o ha superado las peticiones mensuales de su plan responde igual. |
| `429` | `{"status":"rate_limited"}`, con `Retry-After: 30` | La dirección emisora supera las 120 peticiones por minuto a URLs de bins, o el bin supera las 600 por minuto sumando todos sus emisores. Se comprueba antes de leer el cuerpo; no se registra ni se cuenta nada. |
| `503` | `{"status":"unavailable"}`, con `Retry-After: 30` | La petición no se ha podido guardar en ese momento. No se registra nada; vuelve a enviarla. |
| `404` | ninguno | El slug no puede ser uno que haya emitido Request Bins: tiene una longitud incorrecta o contiene un carácter que no pertenece al alfabeto de los slugs. |

El `200` es el mismo para todos los resultados a propósito. Un emisor que recibe un error puede dejar de enviar o desactivar su webhook, y una respuesta distinta para un bin activo permitiría a cualquiera sondear en busca de bins. Si una petición se registró o no es algo que consulta el propietario del bin en la API o en la consola, nunca el emisor.

Un `200` lleva una cabecera `X-Request-ID`, y el `request_id` de la petición capturada contiene el mismo valor, así que una línea del log de un emisor se puede cruzar con lo que registró el bin.

### Qué registra un bin {#edge-records}

- **Cuerpo:** se acepta un cuerpo de cualquier tamaño. Su tamaño completo se cuenta en `size_bytes`, y se guarda su primer MiB, así que un cuerpo de hasta 1 MiB se guarda completo. `truncated` es `true` cuando el cuerpo superaba 1 MiB, y entonces el cuerpo guardado es más corto que `size_bytes`. El cuerpo se guarda con los bytes que llegaron, sin analizarlo ni modificarlo nunca.
- **Cabeceras:** en orden de llegada y conservando los duplicados, hasta 256; un nombre se corta a 256 caracteres y un valor a 8.192. Los valores de `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` y `X-API-Key` se sustituyen por `[redacted]` antes de guardar nada. Las demás cabeceras se guardan tal como se enviaron.
- **Ruta:** se corta a 2.048 caracteres.
- **Tipo de contenido:** la cabecera `Content-Type`, como `content_type`.
- **Dirección de origen:** la dirección que envió la petición, como `source_ip`.

### Cada petición es una fila {#edge-repeats}

Cada petición se guarda como una fila independiente. Una petición enviada de nuevo, aunque tenga el mismo método, ruta, query y cuerpo que otra que el bin ya tiene, es una fila nueva con sus propias cabeceras, dirección de origen, hora y `request_id`, y cuenta para las peticiones del mes como cualquier otra. Así, los reintentos de un proveedor aparecen uno a uno, cada uno con su propia firma y su propio timestamp. `seen_count` es `1` en cada fila nueva. Una petición guardada antes del 25 de octubre de 2026 puede ser distinta hasta que caduque: su cuerpo puede haberse cortado a 64 KiB, y su `seen_count` puede contar todas las veces que llegó la misma petición.

### Cuándo no se registra nada {#edge-refusals}

El emisor recibe `200` en todos los casos siguientes. Lo que muestra el bin:

| El bin | Lo que muestra el bin |
| --- | --- |
| no existe, se borró o ha caducado | — |
| está desactivado (`status` `disabled`) | — |
| está suspendido | — |
| pertenece a un workspace suspendido por un cargo impagado | `refused_count` sube; `last_refused_reason` es `workspace_suspended` |
| ha superado las peticiones del mes, o su propia parte de ellas | `refused_count` sube; `last_refused_reason` es `quota_exceeded` |

`last_refused_summary` muestra la última petición rechazada como `METHOD /path`, y `last_refused_at`, cuándo llegó. Las peticiones rechazadas no cuentan para el mes.

### Suspensión {#suspension}

Dos controles suspenden un bin cuyo tráfico parece una recogida de datos de desconocidos y no el de unos pocos emisores conocidos:

- **Emisores distintos:** un bin ha recibido peticiones de más direcciones distintas de las que permite el plan: 50 en Free, 200 en Starter, 500 en Pro y 2.000 en Custom.
- **Envíos de formulario desde navegador:** una petición con una cabecera de navegador (`Origin`, `Referer`, `Sec-Fetch-Site` o `Sec-Fetch-Mode`) y un tipo de contenido de formulario (`application/x-www-form-urlencoded` o `multipart/form-data`) es un envío de formulario desde navegador. Un bin que recibe más de los que permite el plan (3 en Free, 5 en Starter y Pro, 10 en Custom), desde al menos tres direcciones, se suspende. `browser_post_count`, `last_browser_form_origin` y `last_browser_form_at` muestran lo que ha visto.

La petición que dispara un control se registra, y las posteriores no. Un bin suspendido responde `200` y no registra nada, sea cual sea su `status`. `suspended_code` indica el motivo:

| `suspended_code` | Motivo | Se levanta |
| --- | --- | --- |
| `source_fanout` | El control de emisores distintos | Por NimbusNexus; contacta con soporte |
| `browser_posts` | El control de envíos de formulario desde navegador | Por NimbusNexus; contacta con soporte |
| `abuse` | NimbusNexus lo suspendió tras una denuncia | Por NimbusNexus |
| `non_payment` | El workspace está suspendido por un cargo impagado | Cuando se salda el cargo |
| `plan_downgrade` | El plan permite menos bins de los que tiene el workspace, y este es uno de los más recientes | Cuando el plan vuelve a permitirlo, primero los bins más antiguos |

Trata `suspended_code` como una cadena abierta y ten un caso por defecto para los valores que no conozcas; `suspended_reason` dice lo mismo con palabras. Un bin puede estar suspendido por varias causas a la vez, y cada una se levanta por separado: saldar un cargo nunca levanta una suspensión por abuso, y levantar una nunca recupera un bin que el plan ya no permite.

Para denunciar la URL de un bin que se está usando de forma abusiva, escribe a `abuse@nnbin.net` con la URL completa. La página `https://nnbin.net/` dice lo mismo.

### Navegadores {#edge-browsers}

Las URLs de los bins no envían cabeceras CORS. Una página web puede enviar a un bin una petición simple, como el envío de un formulario, pero no puede leer la respuesta, y una petición que necesita preflight se queda en su `OPTIONS`, que es lo que registra el bin. `robots.txt` pide a los buscadores que no rastreen las URLs de los bins.

## La API {#api}

La URL base es `https://bins.nimbusnexus.net/v1`. Las peticiones y las respuestas son JSON. Envía una clave como `Authorization: Bearer <key>` o `X-API-Key: <key>` ([Cómo obtener acceso](/docs/product-bins#access)). Los timestamps son ISO 8601 en UTC, y uno que envíes sin desfase horario se interpreta como UTC. Los errores usan el formato descrito en [Errores](/docs/errors).

| Ruta | Qué hace | Requiere |
| --- | --- | --- |
| `POST /v1/bins` | Crea un bin; `201` con [el bin](#bin) | write |
| `GET /v1/bins` | Los bins del workspace, del más reciente al más antiguo; `url` o `slug` busca uno | read |
| `GET /v1/bins/{id}` | Un bin | read |
| `PATCH /v1/bins/{id}` | Cambia el nombre de un bin, lo desactiva y lo activa, o fija su [URL de reenvío](#forwarding) | write |
| `POST /v1/bins/{id}/forward-test` | Envía una [prueba](#forward-test) a la URL de reenvío del bin y devuelve lo que respondió | write |
| `DELETE /v1/bins/{id}` | Borra un bin; `204` | admin |
| `GET /v1/bins/{id}/requests` | Las [peticiones capturadas](#requests) de un bin, de la más reciente a la más antigua | read; con una clave, un plan de pago |
| `GET /v1/requests` | Las [peticiones capturadas](#all-requests) de todos los bins en una sola lista, de la más reciente a la más antigua | read; con una clave, un plan de pago |
| `GET /v1/bins/{id}/paths` | Las peticiones de un bin [agrupadas por ruta](#paths) | read; con una clave, un plan de pago |
| `GET /v1/requests/{id}` | Una petición capturada completa, con sus [reenvíos](#forwards) | read; con una clave, un plan de pago |
| `DELETE /v1/bins/{id}/requests` | Vacía un bin; `200` con `{"deleted": <count>}` | admin |
| `GET /v1/plan` | El plan del workspace y sus límites | read |
| `GET /v1/usage` | Las peticiones de este mes y los bins que tienes, frente al plan | read |

**read**, **write** y **admin** se explican en [Quién puede hacer qué](#authority).

### Crea un bin {#create}

`POST /v1/bins` acepta un cuerpo JSON, `{}` si no fijas nada:

| Campo | Qué es |
| --- | --- |
| `label` | El nombre que le das al bin, hasta 200 caracteres. Los emisores nunca lo ven. |
| `expires_in_minutes` | Cuánto vive el bin: de 1 a 525.600 (un año). Sin este campo, se aplica el valor por defecto del plan: 24 horas en Free y hasta que se borre en los planes de pago. Una vida útil más larga de lo que permite el plan se recorta a su máximo, no se rechaza: 24 horas en Free, 7 días en Starter, 30 días en Pro y un año en Custom. `expires_at` en la respuesta muestra el resultado. |

La vida útil de un bin no se puede cambiar después de crearlo. Cuando el workspace ya tiene todos los bins de su plan, la respuesta es `402` `quota_exceeded`, con `details.metric` `bins`, `details.limit` y `details.current`. Los bins retenidos por una bajada de plan no cuentan.

### Busca un bin {#list}

`GET /v1/bins` lista los bins del workspace, del más reciente al más antiguo. Con `url` (la URL de un bin, con o sin una ruta después del slug) o `slug` (en mayúsculas o minúsculas), devuelve ese único bin, o una lista vacía. Los bins borrados y caducados nunca aparecen en la lista, y leer uno responde `404`.

Las listas se paginan con `limit` (de 1 a 200, 50 por defecto) y `offset` (de 0 a 10.000). La respuesta es `{"items": [...], "next_offset": <offset>}`: devuelve `next_offset` como `offset` para obtener la página siguiente. Es `null` en la última página, y más allá del offset 10.000.

### El objeto bin {#bin}

| Campo | Qué es |
| --- | --- |
| `id` | `bin_` y 24 caracteres hexadecimales. Lo usan todas las rutas. |
| `slug` | La parte de la URL después de `/b/`. |
| `url` | La URL que das a los emisores. |
| `label` | El nombre que le das. |
| `status` | `enabled` o `disabled`: tu interruptor. Un bin desactivado responde a los emisores y no registra nada. |
| `expires_at` | Cuándo termina el bin, o `null` si vive hasta que se borre. |
| `created_at` | Cuándo se creó. |
| `suspended` | `true` mientras NimbusNexus tiene el bin apagado ([Suspensión](#suspension)). |
| `suspended_code`, `suspended_reason` | El motivo, como identificador y como texto; vacíos cuando el bin no está suspendido. |
| `refused_count` | Peticiones respondidas y no registradas porque el workspace había superado sus peticiones o estaba suspendido. |
| `last_refused_summary`, `last_refused_reason`, `last_refused_at` | La última de ellas, como `METHOD /path`; `quota_exceeded` o `workspace_suspended`; y cuándo llegó. |
| `browser_post_count` | Envíos de formulario desde navegador que ha recibido el bin. |
| `last_browser_form_origin`, `last_browser_form_at` | La página que envió el último, y cuándo. |
| `request_count` | Peticiones registradas desde que se creó el bin o se vació por última vez. |
| `last_request_at` | Cuándo llegó la última, o `null`. |
| `period_requests` | Las peticiones de este mes contadas para el bin, frente a `bin_request_ceiling` de [`GET /v1/usage`](#plan). |
| `forward_url` | Adónde [reenvía](#forwarding) el bin cada petición que registra, o `null` si no reenvía. |
| `forward_paused_at`, `forward_paused_reason` | Cuándo se [pausó](/docs/product-bins/forwarding#paused) el reenvío tras envíos fallidos, y por qué: `failed_in_a_row` o `failing_for_an_hour`. `null` y vacío mientras no está pausado. |
| `forward_last_error`, `forward_last_error_at` | El último envío que falló: qué salió mal, como `HTTP 503` o un timeout, nunca lo que contenía la petición; y cuándo. |

### Modifica o borra un bin {#change}

`PATCH /v1/bins/{id}` acepta `label`, `status` (`enabled` o `disabled`), `forward_url` ([Reenvío](#forwarding)) o cualquier combinación de ellos, y responde con el bin. Desactivarlo detiene el registro y conserva lo que el bin contiene. Un bin desactivado sigue contando para los bins del plan.

Antes, `status` era `active` donde ahora es `enabled`, y ninguna respuesta dice ya `active`. `PATCH` sigue aceptando `"status": "active"` y el bin se devuelve como `enabled`, pero esa grafía está obsoleta y se rechazará a partir de una fecha que aún está por anunciar, así que envía `enabled`.

En la consola, el menú ⋯ de la página de un bin contiene **Rename…**, **Disable** o **Enable**, **Empty bin…** y **Delete bin…**, y el reenvío se configura en su tarjeta **Forwarding**. La página de un bin desactivado lo indica, con un botón **Enable**.

`DELETE /v1/bins/{id}` borra un bin definitivamente. Su URL deja de registrar al instante, aunque los emisores siguen recibiendo `200`; su slug nunca se vuelve a emitir, ni para ti ni para nadie; y lo que registró se borra poco después. Su hueco entre los bins del plan queda libre al instante.

`DELETE /v1/bins/{id}/requests` vacía un bin: se borran todas las peticiones que contiene y `request_count` vuelve a `0`. El bin conserva su URL y sigue registrando.

### Peticiones capturadas {#requests}

`GET /v1/bins/{id}/requests` lista las peticiones de un bin, de la más reciente a la más antigua, y `GET /v1/requests` reúne las [de todos los bins](#all-requests) en una sola lista. Las dos aceptan estos parámetros:

| Parámetro | Qué es |
| --- | --- |
| `since` | Solo las peticiones recibidas después de este instante. Pasa el `received_at` más reciente que hayas visto para hacer polling de las nuevas. |
| `until` | Solo las peticiones recibidas en este instante o antes: la forma de retroceder por las más antiguas. |
| `method` | Solo las peticiones enviadas con este método, en mayúsculas o minúsculas. Repítelo para aceptar cualquiera de varios: `?method=PUT&method=DELETE`. |
| `path` | Solo las peticiones enviadas exactamente a esta ruta: lo que iba después del slug, desde su `/`, sin la query, tal como la muestra la lista. Distingue entre mayúsculas y minúsculas. [Peticiones por ruta](#paths) lista las rutas de un bin. |
| `q` | Solo las peticiones que contienen este texto, de hasta 200 caracteres, sin distinguir mayúsculas de minúsculas: en la ruta y la query tal como se enviaron (`/orders?id=42`), en una cabecera como `name: value`, o en el cuerpo guardado. En un cuerpo que no es texto UTF-8, la búsqueda se hace con cada byte por encima de 127 (y NUL) escrito como `\` y tres dígitos octales, y cada barra invertida duplicada. |
| `in` | Dónde busca `q`: `all`, el valor por defecto, o solo `path` (la ruta y la query), `headers` (cada una como `name: value`) o `body`. |
| `header` | Solo los valores de esta cabecera, con su nombre en mayúsculas o minúsculas, y cualquiera de ellos cuando se envió más de una vez. Sin `q`, todas las peticiones que llevan la cabecera. Se combina con `in` `all` o `headers`. |
| `field` | Solo este campo de un cuerpo JSON, indicado como `data.object.id` o `items[0].sku`: una cadena se busca tal cual, un número tal como lo escribe JSON, y un objeto o un array como texto JSON. Sin `q`, todas las peticiones cuyo cuerpo tiene el campo. Un cuerpo que no es JSON, o que se cortó a 1 MiB, no tiene campos. Se combina con `in` `all` o `body`, y no con `header`. |
| `limit`, `offset` | Paginación, igual que para los bins. Más allá del offset 10.000, acota la ventana con `until` en su lugar. |

Un `header` o un `field` con otro `in`, o un `header` y un `field` a la vez, se rechaza con un `422` `validation_error` cuya entrada tiene el tipo `bins.search_conflict`.

Una búsqueda (`q`, `header` o `field`) se pagina de forma distinta al resto. Lee las peticiones de la lista de la más reciente a la más antigua y se detiene cuando tiene `limit` coincidencias o ha leído 16 MiB de peticiones (o 5.000 peticiones), lo que ocurra primero, así que una página puede tener menos coincidencias que `limit`, o ninguna, aunque queden peticiones más antiguas sin leer. La página de una búsqueda tiene `next_offset` `null` y, hasta que la búsqueda haya leído la petición más antigua de la lista, un `next_until`: devuélvelo como `until`, con la misma búsqueda y los mismos `method`, `path` y `since`, para seguir buscando desde donde se detuvo. Con una búsqueda, `offset` se salta ese número de peticiones antes de que la búsqueda empiece a leer.

```json
{
  "items": [],
  "next_offset": null,
  "next_until": "2026-10-23T14:02:11.408211+00:00"
}
```

Cada elemento:

| Campo | Qué es |
| --- | --- |
| `id` | `req_` y 24 caracteres hexadecimales. |
| `bin_id` | El bin al que llegó. |
| `method` | El método HTTP. |
| `path` | Lo que iba después del slug, tal como se envió; `/` para la URL del bin sin nada más. |
| `query` | La query tal como se envió, sin el `?`; vacía si no había ninguna. |
| `source_ip` | La dirección de origen. |
| `content_type` | Su cabecera `Content-Type`, o vacío. |
| `size_bytes` | El tamaño completo del cuerpo, tal como se envió. |
| `truncated` | `true` cuando el cuerpo superaba 1 MiB, así que solo se guarda su primer MiB. |
| `seen_count` | `1`: cada petición es una [fila independiente](#edge-repeats). |
| `received_at` | Cuándo llegó. |
| `expires_at` | Cuándo se borrará: la retención del plan contada desde `received_at`, o el propio `expires_at` del bin si llega antes. |

`GET /v1/requests/{id}` devuelve una petición con todos los campos anteriores, y además:

| Campo | Qué es |
| --- | --- |
| `headers` | Objetos con un `name` y un `value`, en orden de llegada, con los duplicados conservados y las credenciales como `[redacted]`. |
| `body_base64` | El cuerpo guardado, codificado en base64 porque no tiene por qué ser texto: como máximo 1 MiB. |
| `request_id` | El id que la URL del bin dio a esta petición, que es el `X-Request-ID` que recibió su emisor. |
| `forwards` | Qué ha sido de sus [reenvíos](#forwards), del más reciente al más antiguo; vacío si su bin no estaba reenviando cuando llegó. |

Con una clave de API, `GET /v1/bins/{id}/requests`, `GET /v1/requests` y `GET /v1/requests/{id}` requieren un plan de pago: en Free responden `402` `not_entitled`, con `details.feature` `read_api`. La consola lee las peticiones en todos los planes. Una petición cuyo `expires_at` ya ha pasado, o de un bin que se ha vaciado, se ha borrado o ha caducado, responde `404`.

### Peticiones de todos los bins {#all-requests}

`GET /v1/requests` reúne en una sola lista las peticiones de todos los bins del workspace, de la más reciente a la más antigua. Acepta los parámetros de la lista de un bin descritos arriba y se pagina igual, por `next_offset`, o por `next_until` en una búsqueda. Sus elementos son los de la lista de un bin, cada uno con el `bin_id` al que llegó; para mostrar junto a cada uno la etiqueta o la URL de su bin, cruza `bin_id` con `GET /v1/bins`.

Esta lista contiene las peticiones de los bins que todavía existen. Las peticiones de un bin borrado o caducado salen de ella al instante, y las de un bin desactivado o suspendido se quedan, igual que se quedan en la propia lista de ese bin. La página **All bins** de la consola muestra esta lista, con la misma búsqueda y los mismos filtros de método que la página de un bin, y sin **By path**.

### Peticiones por ruta {#paths}

`GET /v1/bins/{id}/paths` agrupa por ruta las 10.000 peticiones más recientes de un bin, empezando por la ruta usada más recientemente. La query se deja fuera, así que `/orders?id=1` y `/orders?id=2` son una sola ruta, mientras que las rutas se comparan tal como se enviaron, así que `/users/1` y `/users/2` son dos. `method` se queda solo con esos métodos, como en la lista de peticiones, y `limit` y `offset` paginan igual que para los bins.

```json
{
  "items": [
    {
      "path": "/stripe/events",
      "requests": 42,
      "methods": ["POST", "GET"],
      "last_received_at": "2026-10-26T09:12:04Z"
    }
  ],
  "next_offset": null,
  "counted": 57,
  "capped": false
}
```

| Campo | Qué es |
| --- | --- |
| `path` | Lo que iba después del slug, sin la query. |
| `requests` | Cuántas de las peticiones contadas se enviaron a ella. |
| `methods` | Los métodos con los que se enviaron, empezando por el más usado. |
| `last_received_at` | Cuándo llegó la última de ellas. |

`counted` indica cuántas peticiones se agruparon, y `capped` es `true` cuando el bin tiene más de esa cifra, así que faltan rutas y recuentos más antiguos. Contar solo las 10.000 más recientes hace que una llamada sea igual de rápida en un bin de millones que en uno de diez. Para listar las peticiones de una ruta, pásala como `path` a `GET /v1/bins/{id}/requests`. Con una clave de API, esta ruta requiere un plan de pago, igual que las rutas de peticiones.

En la consola, **By path**, encima de la lista de un bin, muestra los mismos grupos, actualizados cada 10 segundos, con los chips de método aplicados. Al elegir una ruta se listan sus peticiones, con la ruta mostrada como chip encima de la lista; al quitar el chip se vuelven a listar todas las peticiones.

### Reenvío {#forwarding}

Un bin en Starter, Pro o Custom puede reenviar cada petición que registra a una sola URL https tuya. [Reenvío](/docs/product-bins/forwarding) cubre qué se envía, los reintentos, los límites y cuándo se pausa el reenvío; esta sección cubre la API.

`PATCH /v1/bins/{id}` con `forward_url` fija la URL, y `null` o `""` detiene el reenvío. Volver a fijar una URL, aunque sea la misma, reanuda un bin cuyo reenvío se [pausó](/docs/product-bins/forwarding#paused), y reinicia su recuento de envíos fallidos. En Free la respuesta es `402` `not_entitled`, con `details.feature` `forwarding`. Una URL a la que un bin no reenvía es un `422` `validation_error` cuya entrada tiene el tipo `bins.forward_target`, el `loc` `["body", "forward_url"]` y un `params.reason`:

| `reason` | Por qué |
| --- | --- |
| `scheme` | No es `https`. |
| `credentials` | Lleva un nombre de usuario o una contraseña. |
| `host` | No tiene host, o su host no es un nombre válido. |
| `port` | Su puerto no está entre 1 y 65535. |
| `length` | Supera los 2.048 caracteres. |
| `own_domain` | Su host es `nnbin.net`, `nimbusnexus.net` o un nombre bajo ellos, o resuelve a una de nuestras propias direcciones. |
| `not_public` | Su host no resuelve, o resuelve a una dirección que no es pública, como una privada, de loopback o link-local. |
| `missing` | Un envío de prueba a un bin sin URL de reenvío. |

Trata `reason`, `forward_paused_reason` y el `reason` de un reenvío como cadenas abiertas, y ten un caso por defecto para un valor que no conozcas.

Cuando el reenvío se pausa, se avisa al workspace una vez, por email y con un webhook con el tipo de evento `bind.forwarding.paused`; [Cuando el reenvío se pausa](/docs/product-bins/forwarding#paused) muestra el cuerpo del webhook.

### Prueba una URL de reenvío {#forward-test}

`POST /v1/bins/{id}/forward-test` no acepta cuerpo. Envía al instante un evento de prueba a la URL de reenvío del bin y responde `200` con lo que recibió de vuelta ([Cómo comprobar antes la URL](/docs/product-bins/forwarding#test) muestra el evento):

| Campo | Qué es |
| --- | --- |
| `ok` | `true` cuando tu servidor respondió `2xx` o `3xx`. |
| `answer` | Lo que respondió: `status`; `headers`, objetos con un `name` y un `value`, en el orden en que se enviaron; los primeros 8 KiB del cuerpo como `body_base64`; y `truncated`, `true` cuando el cuerpo pasaba de ese tamaño. `null` cuando no llegó ninguna respuesta. |
| `duration_ms` | Cuánto tardó el envío. |
| `error` | Por qué no llegó ninguna respuesta, como un timeout o una conexión rechazada; vacío cuando llegó una. |

La llamada espera la respuesta hasta 13 segundos, y un servidor más lento da `ok` `false` con un `error` que lo indica. Un bin puede enviar 10 pruebas por minuto: a partir de ahí, la respuesta es `429` `rate_limited`, y `details.retry_after` indica cuántos segundos faltan para que se permita la siguiente. `503` `unavailable`, con `details.reason` `forwarder_unavailable`, significa que la prueba no se recogió para enviarla en un plazo de 3 segundos, así que no se envió nada: vuelve a intentarlo en breve. Una URL que en el momento del envío resulta no ser pública se rechaza con el `422` anterior.

### Los reenvíos de una petición {#forwards}

`GET /v1/requests/{id}` incluye `forwards`: qué ha sido de los reenvíos de la petición, del más reciente al más antiguo, y vacío si su bin no estaba reenviando cuando llegó. [Cómo ver lo que ha pasado](/docs/product-bins/forwarding#forwards) muestra uno completo. Cada elemento:

| Campo | Qué es |
| --- | --- |
| `id` | `fwd_` y 24 caracteres hexadecimales. |
| `state` | En qué punto está, según la tabla siguiente. |
| `reason` | Por qué no se reenvió, cuando `state` es `not_forwarded`; vacío en otro caso. |
| `url` | Adónde va: la URL de reenvío tal como era cuando llegó la petición, con la ruta y la query de la petición añadidas. |
| `attempts`, `max_attempts` | Los intentos hechos hasta ahora, y el máximo que permitía el plan cuando se puso en cola. |
| `next_attempt_at` | Cuándo toca el siguiente intento, mientras `state` es `retrying`; si no, `null`. |
| `last_error` | Qué salió mal en el último intento, como `HTTP 503` o un timeout, o por qué está esperando; vacío una vez enviado. |
| `answer` | Lo que respondió tu servidor en el último intento, con la misma forma que en una [prueba](#forward-test). `null` cuando ese intento no obtuvo respuesta. |
| `duration_ms` | Cuánto tardó el último intento; `null` antes del primero. |
| `created_at` | Cuándo se puso en cola. |
| `sent_at` | Cuándo se envió; `null` hasta entonces. |

| `state` | Qué significa |
| --- | --- |
| `queued` | Esperando su primer intento. |
| `sending` | Hay un intento en curso. |
| `sent` | Tu servidor respondió `2xx` o `3xx`. |
| `retrying` | Un intento falló, y hay otro previsto para `next_attempt_at`. |
| `failed` | Abandonado: se han agotado los intentos del plan, o un intento terminó de una forma que no se reintenta, como un `404`. |
| `not_forwarded` | Se registró y nunca se envió; `reason` indica por qué. |

| `reason` | Por qué no se reenvió |
| --- | --- |
| `paused` | El reenvío estaba pausado cuando llegó la petición, o cuando le llegó su turno. |
| `body_too_large` | El cuerpo es mayor de lo que reenvía el plan, o superaba 1 MiB. |
| `url_too_long` | La URL de reenvío, con la ruta y la query de la petición añadidas, supera los 8.192 caracteres. |
| `queue_full` | 1.000 reenvíos del bin no habían terminado todavía. |
| `forwarding_off` | El reenvío se detuvo antes de su turno. |
| `bin_gone` | El bin se borró o caducó antes de su turno. |
| `suspended` | El bin o su workspace se suspendió antes de su turno. |
| `not_entitled` | El plan dejó de incluir el reenvío antes de su turno. |
| `request_gone` | La petición llegó al final de su retención antes de su turno. |

### Plan y consumo {#plan}

`GET /v1/plan` indica qué límites se aplican:

```json
{
  "plan": "starter",
  "enforced_as": "starter",
  "ceilings": {
    "max_bins": 5,
    "monthly_requests": 25000,
    "retention_days": 7,
    "bin_ttl_minutes": 0,
    "bin_ttl_max_minutes": 10080,
    "read_api": 1,
    "bin_max_sources": 200,
    "bin_max_browser_posts": 5,
    "bin_share_pct": 50,
    "forwarding": 1,
    "forward_max_body_bytes": 262144,
    "forward_rate_per_min": 60,
    "forward_max_attempts": 3
  },
  "past_due": false,
  "suspended": false,
  "system": false
}
```

`plan` es el plan registrado, vacío si el workspace no tiene ninguno; `enforced_as` es el plan cuyos límites se aplican, `free` si no hay ninguno. `ceilings` contiene los límites por nombre ([Planes y límites](#limits)). `past_due` es `true` mientras haya un cargo sin saldar, y `suspended`, una vez que ha terminado el periodo de gracia posterior. `system` es para el propio workspace de NimbusNexus.

`GET /v1/usage` indica cuánto se ha usado de ellos:

```json
{
  "period": "2026-10-01",
  "requests": 26834,
  "monthly_requests": 35000,
  "purchased_requests": 10000,
  "credit": null,
  "bins": 2,
  "max_bins": 5,
  "bin_request_ceiling": 17500
}
```

`period` es el mes, expresado como su primer día. `requests` cuenta lo que han registrado este mes los bins del workspace, frente a `monthly_requests`: las peticiones mensuales del plan más `purchased_requests`, las peticiones compradas con [crédito](#credit) este mes. Aquí, un workspace en Starter ha comprado un bloque además de sus 25.000. `bins` cuenta los bins que tienes, frente a `max_bins`. `bin_request_ceiling` es lo máximo que puede registrar un solo bin este mes, incluidas las peticiones compradas.

`credit` es `null` mientras al mes le quedan peticiones. Una vez agotadas, indica qué está haciendo el crédito: `pending` mientras se compran más, así que los bins vuelven a registrar en cuestión de minutos; `empty` cuando el saldo no alcanza para un bloque; y `off` cuando el crédito está desactivado para Request Bins, o el plan no compra ninguna, como en Custom. Trátalo como una cadena abierta, y ten un caso por defecto para un valor que no conozcas.

## Quién puede hacer qué {#authority}

| | Leer bins, plan y consumo | Leer peticiones capturadas | Crear, renombrar, desactivar y activar bins, y configurar el reenvío | Borrar y vaciar bins |
| --- | --- | --- | --- | --- |
| Propietario o administrador del workspace | sí | sí | sí | sí |
| Miembro | sí | sí | sí | no |
| Lector, o cualquier otro rol | sí | sí | no | no |
| Clave con **Read & write** (alcance `admin`) | sí | en planes de pago | sí | sí |
| Clave con **Read** (alcance `read`) | sí | en planes de pago | no | no |

Una acción rechazada responde `403` `forbidden` con `details.reason` `role`, y `details.required` indica el rol que necesita: `member` para crear o modificar un bin, `admin` para borrarlo o vaciarlo. Para una clave, ambos equivalen a **Read & write** (el alcance `admin`). La consola de la cuenta crea claves **Read** y **Read & write**, y una clave con cualquier otro alcance, como `write`, se trata como **Read**.

Request Bins da servicio a workspaces completos. Un puesto de invitado, o una clave limitada a un proyecto, se rechaza en todas las rutas con `403` `project_confined`.

Un workspace tiene Request Bins en cuanto un propietario o administrador ha abierto la consola, o lo ha añadido desde **Add a product**. Hasta entonces, a los demás miembros se les rechaza con `403` `product_not_enabled`. Las claves no se ven afectadas.

## Planes y límites {#limits}

| Clave de `ceilings` | Qué es | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- | --- |
| `max_bins` | Bins a la vez | 1 | 5 | 25 | 250 |
| `monthly_requests` | Peticiones registradas al mes | 1.000 | 25.000 | 250.000 | 5.000.000 |
| `bin_share_pct` | La parte máxima del mes que puede usar un solo bin | 100 % | 50 % | 40 % | 25 % |
| `retention_days` | Cuánto tiempo se guarda una petición | 1 día | 7 días | 30 días | 90 días |
| `bin_ttl_minutes` | Vida útil por defecto de un bin nuevo | 24 horas | hasta que se borre | hasta que se borre | hasta que se borre |
| `bin_ttl_max_minutes` | La vida útil más larga que puedes fijar | 24 horas | 7 días | 30 días | sin límite del plan; el máximo de la API es un año |
| `read_api` | Leer peticiones capturadas con una clave | no | sí | sí | sí |
| `bin_max_sources` | Emisores distintos antes de que se suspenda un bin | 50 | 200 | 500 | 2.000 |
| `bin_max_browser_posts` | Envíos de formulario desde navegador antes de que se suspenda un bin | 3 | 5 | 5 | 10 |
| `forwarding` | [Reenviar](#forwarding) cada petición a tu propio servidor | no | sí | sí | sí |
| `forward_max_body_bytes` | El cuerpo más grande que lleva un reenvío | — | 256 KiB | 1 MiB | 1 MiB |
| `forward_rate_per_min` | Reenvíos que envía un bin por minuto; los demás esperan su turno | — | 60 | 300 | 600 |
| `forward_max_attempts` | Intentos para enviar un reenvío | — | 3 | 5 | 5 |

`GET /v1/plan` indica las vidas útiles en minutos, donde `0` significa hasta que se borre (`bin_ttl_minutes`) o sin límite del plan (`bin_ttl_max_minutes`), `read_api` y `forwarding` como `1` o `0`, `forward_max_body_bytes` en bytes y las cifras del reenvío como `0` en Free. Los precios están en el [resumen](/docs/product-bins#limits).

- **El mes** es un mes natural en UTC: `period` en `GET /v1/usage`. Cuenta cada petición que registra un bin. Una petición rechazada o limitada por tasa no cuenta.
- **Superadas las peticiones del mes**, o la parte que le corresponde a un bin (`bin_request_ceiling`), los bins responden `200` y no registran nada hasta que el [crédito](#credit) compra más o empieza el mes siguiente, y `refused_count` lo refleja. Ninguna llamada a la API se rechaza por ello.
- **La retención y la vida útil son relojes distintos.** Una petición se borra cuando se agota la retención del plan o cuando termina su bin, lo que ocurra primero.
- **Avisos:** cuando el workspace llega al 80 % y después al 100 % de las peticiones del mes, incluidas las compradas, se le avisa por email, que va al propietario del workspace salvo que elijas otra dirección, y con un webhook con el tipo de evento `bind.quota.threshold_reached` si configuras uno. Ambos están en **Notifications** en tu consola de la cuenta. El email indica qué hará el crédito.
- **Mientras un pago está vencido,** crear y modificar bins se rechaza con `402` `workspace_frozen`, y los bins siguen registrando. Si termina el periodo de gracia, el workspace se suspende: los mismos rechazos llegan como `402` `workspace_suspended`, y los bins responden `200` y no registran nada. Borrar y leer siguen funcionando, y no se borra nada.
- **En un plan más pequeño,** los bins que superan su `max_bins` quedan retenidos, empezando por los más recientes, como [`plan_downgrade`](#suspension), y vuelven, empezando por los más antiguos, en cuanto el plan los permite.

### Más peticiones con crédito {#credit}

El crédito es un saldo que tu workspace guarda para que los productos de NimbusNexus lo gasten cuando se les agota el mes. Lo añades en la [consola de la cuenta]({{ACCOUNT_BASE_URL}}/billing#credit), en **Billing**, donde la tarjeta **Credit** también activa o desactiva el gasto de cada producto. Para Request Bins está activado hasta que lo desactives.

- **El bloque:** 10.000 peticiones por $4, en Free, Starter y Pro. En Custom, las peticiones adicionales se acuerdan por contrato, así que el crédito no compra ninguna.
- **Cuándo:** aproximadamente cada 5 minutos, Request Bins compra un bloque para cada workspace que ha usado el 90 % de su mes y al que le quedan menos de 10.000 peticiones, mientras dure el saldo.
- **Qué añade:** 10.000 a las peticiones del mes y a la parte que le corresponde a cada bin, así que `monthly_requests`, `purchased_requests` y `bin_request_ceiling` en [`GET /v1/usage`](#plan) crecen con el bloque.
- **Solo para el mes:** las peticiones compradas caducan cuando termina el mes. Un bloque usado en parte no se reembolsa, y nada se traslada al mes siguiente.
- **Cuando no puede comprar:** con el crédito desactivado, o con un saldo que no alcanza para un bloque, los bins responden `200` y, una vez superadas las peticiones del mes, no registran nada hasta el mes siguiente, y `credit` en `GET /v1/usage` indica cuál. Un emisor lo bastante rápido como para agotar las últimas peticiones antes de la siguiente compra también encuentra el mes agotado, durante unos minutos, y lo que envía entonces no se registra.

## Errores {#errors}

Los errores de la API usan el formato descrito en [Errores](/docs/errors), con los códigos que envía Inboxes en las mismas situaciones:

| Estado | `code` | Cuándo |
| --- | --- | --- |
| `400` | `bad_request` | Un cuerpo JSON que no es UTF-8 válido. |
| `401` | `unauthorized` | Sin credencial, una credencial revocada o una sesión de consola que ha terminado; `details.reason` indica cuál. |
| `401` | `invalid_credential` | Una clave que no se verifica, ha caducado o se creó para otro producto. |
| `402` | `quota_exceeded` | Crear un bin cuando todos los bins del plan están en uso. |
| `402` | `not_entitled` | En Free: leer peticiones capturadas con una clave (`details.feature` `read_api`), o fijar una URL de reenvío o enviar una prueba (`forwarding`). |
| `402` | `workspace_frozen`, `workspace_suspended` | Crear o modificar un bin mientras un pago está vencido, o después de que se haya interrumpido el servicio. |
| `403` | `forbidden` | `details.reason` es `role`, `project_confined`, `product_not_enabled`, `csrf` o `no_workspace`. |
| `404` | `not_found` | No existe ese bin o esa petición en tu workspace, o se ha borrado o ha caducado; `details.reason` es `bin` o `request`. |
| `405` | `method_not_allowed` | La ruta existe, pero no para este método. |
| `413` | `payload_too_large` | Un cuerpo de petición de más de 2 MiB. |
| `422` | `validation_error` | Un parámetro o un campo no ha superado la validación. Un carácter NUL en la ruta, la query o un cuerpo JSON es el tipo de entrada `bins.nul_character`, una URL de reenvío a la que un bin no reenvía es `bins.forward_target` ([Reenvío](#forwarding)), y una búsqueda cuyas partes se contradicen es `bins.search_conflict` ([Peticiones capturadas](#requests)). |
| `429` | `rate_limited` | Más de 10 envíos de prueba a un mismo bin en un minuto; `details.retry_after` indica cuándo volver a intentarlo. |
| `500` | `internal_error` | Algo ha fallado por nuestra parte. |
| `503` | `unavailable` | Fijar una URL de reenvío o enviar una prueba mientras el reenvío está desactivado para todo el servicio (`details.reason` `forwarding_disabled`), o una prueba que no se recogió para enviarla en un plazo de 3 segundos, así que no se envió nada (`forwarder_unavailable`). |

La API no envía ningún `409`, y solo envía `429` para los envíos de prueba.

## Próximos pasos {#next-steps}

- [Inicio rápido](/docs/product-bins/quickstart) — crea un bin y lee lo que registró.
- [Reenvío](/docs/product-bins/forwarding) — qué envía un reenvío, los reintentos, los límites y de dónde vienen los reenvíos.
- [API de Request Bins](/docs/reference/bins) — todas las operaciones, con la petición en curl, TypeScript, Python o Go.
- [Errores](/docs/errors) — el formato de error, todas las claves de `details` y un patrón para tratarlos.
- [Resumen del producto](/docs/product-bins) — precios y lo que no hace Request Bins.
