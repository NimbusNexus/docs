---
title: "Inboxes"
description: "Direcciones de email desechables para tests — crea una, apunta a ella el sistema bajo prueba y lee lo que llega en la consola o por la API."
publishedAt: 2026-08-18
updatedAt: 2026-10-27
kind: concept
---

# Inboxes

NimbusNexus Inboxes te da **direcciones de email** desechables que aceptan correo real. Creas una, apuntas a ella un formulario de registro o una suite de tests y lees lo que llegó en la consola o por la API REST.

> **¿No es la página que buscabas?** Inboxes solo recibe email. Si quieres *enviar* correo desde tu aplicación, este no es el producto. Para capturar **peticiones HTTP** — los webhooks de un proveedor, o lo que envía tu propia aplicación — usa [Request Bins](/docs/product-bins).

## De un vistazo {#at-a-glance}

| | |
| --- | --- |
| Qué creas | Un **inbox**: una dirección de email desechable |
| URL base de la API | `{{INBOXES_BASE_URL}}` |
| Autenticación | `Authorization: Bearer <key>`, con una clave emitida en la consola de la cuenta con **Inboxes** como producto |
| Identificador que usan todas las rutas | El `id` del inbox, por ejemplo `inb_7f820a77f64ea18174499945` — nunca la dirección |
| Buscar un inbox por su dirección | `GET /v1/inboxes?address=<address>` |
| Leer lo que llegó | `GET /v1/inboxes/{id}/messages`, o `GET /v1/messages` para todos los inboxes a la vez (planes de pago; en el plan gratuito se lee en la consola) |
| Buscar en lo que llegó | `q` en cualquiera de las dos listas, acotado con `in` o `header` ([Búsqueda de mensajes](#search)) |
| Borrar un inbox | `DELETE /v1/inboxes/{id}` — es permanente, y la dirección nunca se vuelve a emitir |
| Todas las rutas, con ejemplos | La [referencia de la API de Inboxes](/docs/reference/inboxes) |

## Cómo funciona {#how}

1. **Crea** un inbox — en la consola con **Create an inbox**, o con `POST /v1/inboxes`.
2. **Envía** correo a su dirección desde el sistema bajo prueba, con la `phrase` del inbox en el asunto si tiene una.
3. **Lee** lo que llegó. Aparece en la consola en cuestión de segundos y, en los planes de pago, en `GET /v1/inboxes/{id}/messages`. Para encontrar un mensaje entre muchos, busca en los asuntos, los remitentes, las cabeceras y los cuerpos: **Search** encima de la lista en la consola, `q` en la API ([Búsqueda de mensajes](#search)). **All inboxes** en la consola, y `GET /v1/messages` en la API, listan lo que llegó a todos los inboxes a la vez.
4. **Bórralo** cuando termines, o deja que caduque.

El [inicio rápido](/docs/product-inboxes/quickstart) hace los cuatro pasos con `curl`.

Usa la `address` exactamente como la devuelve la API. Las direcciones están en un dominio propio, no en `{{ROOT_DOMAIN}}`, para que el tráfico desechable nunca comparta reputación con el dominio que usa tu correo real.

## Cómo se acepta el correo {#acceptance}

El correo se rechaza en la puerta en lugar de aceptarse y ocultarse. Un mensaje solo se guarda si se cumple todo esto:

- la dirección del destinatario es un inbox vigente y activado;
- el **asunto contiene la frase de ese inbox**, si tiene una;
- el workspace está dentro de su cupo mensual;
- el mensaje no supera los 5 MiB.

Todo lo demás se rechaza durante la conversación SMTP, así que el servidor emisor se entera y genera el rebote. Un mensaje rechazado nunca se guarda ni cuenta para tu consumo.

El correo aceptado se sanea antes de guardarlo: el HTML pasa por un saneador con lista de permitidos, y la consola lo muestra en un marco con sandbox, con las imágenes remotas bloqueadas hasta que las pidas. Cualquiera puede enviar correo a una dirección desechable, así que el contenido se trata como si lo hubiera escrito un atacante.

## Límites por plan {#limits}

| | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- |
| Inboxes a la vez | 1 | 5 | 25 | 250 |
| Mensajes al mes | 1.000 | 25.000 | 250.000 | 5.000.000 |
| Se guardan durante (retención) | 1 día | 7 días | 30 días | 90 días |
| Vida útil del inbox | 24 horas | hasta que lo borres, o hasta 7 días si fijas una | hasta que lo borres, o hasta 30 días | hasta que lo borres, o cualquier vida útil |
| Frase en el asunto | siempre obligatoria | opcional | opcional | opcional |
| Lectura por la API | no (solo consola) | sí | sí | sí |
| Correo aceptado por minuto y por inbox | 60 | 300 | 1.200 | 6.000 |

Los límites de tamaño son los mismos en todos los planes:

| | Límite |
| --- | --- |
| Un email | 5 MiB. El correo más grande se rechaza, nunca se trunca. |
| Cuerpo de texto o HTML | Se guardan 256K caracteres de cada uno; el resto se corta y el mensaje se marca con `truncated: true`. |
| Adjuntos | Se guardan el nombre, el tipo de contenido, el tamaño y el resumen criptográfico. El archivo en sí no se guarda, en ningún plan. |

## Cómo termina un inbox {#lifecycle}

| | Qué ocurre | ¿Puedes deshacerlo? |
| --- | --- | --- |
| **Desactivar** | El inbox deja de aceptar correo y conserva lo que tiene; el correo que se le envía se rechaza. | Sí — vuelve a activarlo |
| **Borrar** | El inbox y su correo se borran, y su dirección se retira: nunca se vuelve a emitir, ni para ti ni para nadie. | No |
| **Caducidad** | En `expires_at`, lo mismo que Borrar. Todos los inboxes del plan gratuito caducan, como máximo a las 24 horas; en un plan de pago, solo caduca un inbox creado con una vida útil. | No |

En la consola, el menú ⋯ de la página de un inbox contiene **Rename…**, **Disable** o **Enable**, **Empty inbox…**, que borra su correo y conserva el inbox, y **Delete inbox…**. Borrar es `DELETE /v1/inboxes/{id}`; las versiones anteriores de esta documentación y el registro de auditoría de la API lo llaman *release*. Una dirección retirada nunca se vuelve a emitir, a propósito: una dirección reciclada entregaría el restablecimiento de contraseña de un desconocido a quien la tuviera después. [Direcciones y la frase](/docs/product-inboxes/addresses#lifecycle) tiene los detalles, incluida la relación entre la caducidad y la retención.

## Lectura por la API {#reading}

Los mensajes se pueden leer en la consola en todos los planes, incluido el gratuito. Leerlos **de forma programática** es lo que añaden los planes de pago: `GET /v1/inboxes/{id}/messages` lista los mensajes de un inbox, del más reciente al más antiguo, con el remitente, el asunto y los veredictos de autenticación de cada uno y, con `extract=otp`, un campo `extracted` con cualquier código de un solo uso que hayamos encontrado — que suele ser lo único que quiere un test. `GET /v1/messages` reúne en una sola lista los mensajes de todos los inboxes del workspace, cada uno con su `inbox_id`. `GET /v1/inboxes/{id}/messages/{message_id}` devuelve un mensaje completo: las dos partes del cuerpo, los detalles de sus adjuntos y sus [cabeceras](#headers).

Todas las rutas usan el `id` del inbox. La consola lo muestra en la página del inbox, junto a **ID**, con un botón para copiarlo. Si solo tienes la dirección, búscalo:

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes?address=ff25m3tue9vm@nninbox.com" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

La respuesta es la lista habitual, con un elemento como máximo. `GET /v1/inboxes` y `GET /v1/inboxes/{id}` devuelven juntos el `id`, la `address` y la `phrase`, así que una sola llamada te da todo lo necesario para enviar y para leer.

## Búsqueda de mensajes {#search}

Las dos listas de mensajes aceptan una búsqueda: `GET /v1/inboxes/{id}/messages` para un inbox y `GET /v1/messages` para todos. El cuadro **Search** de la consola, encima de cada lista, envía los mismos parámetros:

| Parámetro | Qué es |
| --- | --- |
| `q` | Solo los mensajes que contienen este texto, de hasta 200 caracteres, sin distinguir mayúsculas de minúsculas. |
| `in` | Dónde busca `q`: `all`, el valor por defecto, o solo `subject`, `from` (el remitente, tal como figura en su cabecera From), `headers` (cada una como `name: value`) o `body` (el cuerpo de texto o, en un email que solo tiene cuerpo HTML, el texto de su HTML). |
| `header` | Solo los valores de esta cabecera, con su nombre en mayúsculas o minúsculas, y cualquiera de ellos cuando la cabecera llegó más de una vez. Sin `q`, todos los mensajes que llevan la cabecera. Se combina con `in` `all` o `headers`. |

```bash
curl -G "{{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945/messages" \
  --data-urlencode "q=verification code" \
  --data-urlencode "in=subject" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

`since`, `until`, `extract` y `limit` funcionan igual con una búsqueda que sin ella. Un `header` con `in` igual a `subject`, `from` o `body` se rechaza con un `422` `validation_error` cuya entrada tiene el tipo `inboxes.search_conflict`.

Una búsqueda se pagina de forma distinta a la lista sin búsqueda. Lee los mensajes del más reciente al más antiguo y se detiene cuando tiene `limit` coincidencias o ha leído 16 MiB de correo (o 5.000 mensajes), lo que ocurra primero, así que una página puede tener menos coincidencias que `limit`, o ninguna, aunque queden mensajes más antiguos sin leer. La página de una búsqueda tiene `next_offset` `null` y, hasta que la búsqueda haya leído el mensaje más antiguo de la lista, un `next_until`: devuélvelo como `until`, con la misma búsqueda y el mismo `since`, para seguir buscando desde donde se detuvo. Con una búsqueda, `offset` se salta ese número de mensajes antes de que la búsqueda empiece a leer. Sin búsqueda, `next_until` siempre es `null`, y la lista se pagina por `next_offset`.

Una búsqueda en las cabeceras solo encuentra el correo que llegó después de que Inboxes empezara a guardar las cabeceras ([Cabeceras](#headers)).

## Cabeceras {#headers}

`GET /v1/inboxes/{id}/messages/{message_id}` incluye las líneas de cabecera del email como `headers`: objetos con un `name` y un `value`, en orden de llegada, con los duplicados conservados, cada valor desplegado y sus palabras codificadas (RFC 2047) decodificadas. Se guardan hasta 256 líneas; un nombre se corta a 256 caracteres y un valor a 8.192. Las listas no incluyen las cabeceras. En la consola, están en la sección **Headers** del mensaje.

`headers` es `null` en un email que llegó antes de que Inboxes empezara a guardar las cabeceras: no se guardaron para él y no se pueden añadir después. El email en bruto no se guarda, solo sus partes analizadas.

## Cómo obtener acceso {#access}

Regístrate en Inboxes y obtendrás un workspace en el plan gratuito: un inbox a la vez, retención de 24 horas y lectura en la consola. Los precios están en la [página de Inboxes](/inboxes).

Las claves no vienen con el workspace, y la API de Inboxes no las emite. Emite una en tu consola de la cuenta de NimbusNexus, en **API keys**, eligiendo **Inboxes** como producto — Identity es el único emisor de claves de API para todos los productos. Una clave es un JWT, así que empieza por `eyJ`. Envíala como `Authorization: Bearer <key>` o `X-API-Key: <key>`.

Elige el alcance al emitirla: `admin` puede crear, modificar, vaciar y borrar inboxes además de leer, y `read` solo puede leer. Una clave de Inboxes no se puede limitar a un solo proyecto.

> **Una clave `inbx_…` ya no sirve para autenticarse.** Antes, Inboxes emitía sus propias claves con ese prefijo. Si tienes una, emite una de sustitución en la consola de la cuenta.

## Lo que no hace {#not}

- **No envía.** No hay API de envío ni de retransmisión. Una dirección que pudiera originar correo sería un servicio de spam.
- **No es un archivo histórico.** Un mensaje se borra cuando se agota la retención del plan, y todo lo que hay en una dirección desaparece cuando la dirección se borra o caduca.
- **Todavía no reenvía.** El reenvío de lo que llega a una URL tuya está previsto, pero no implementado.
- **No captura HTTP.** Un inbox solo recibe correo. Para webhooks y otras peticiones HTTP, usa [Request Bins](/docs/product-bins), cuyas URLs registran cualquier petición que reciban.

## Próximos pasos {#next-steps}

- [Inicio rápido](/docs/product-inboxes/quickstart) — crea un inbox, envíale un mensaje y léelo de vuelta.
- [Direcciones y la frase](/docs/product-inboxes/addresses) — el filtro del asunto, la caducidad y la retención.
- [Referencia de la API de Inboxes](/docs/reference/inboxes) — todas las rutas, con la petición en curl, TypeScript, Python o Go.
