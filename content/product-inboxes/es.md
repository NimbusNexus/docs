---
title: "Inboxes"
description: "Direcciones de email desechables para tests — crea una, apunta a ella el sistema bajo prueba y lee lo que llega en la consola o por la API."
publishedAt: 2026-08-18
updatedAt: 2026-10-26
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
| Leer lo que llegó | `GET /v1/inboxes/{id}/messages` (planes de pago; en el plan gratuito se lee en la consola) |
| Borrar un inbox | `DELETE /v1/inboxes/{id}` — es permanente, y la dirección nunca se vuelve a emitir |
| Todas las rutas, con ejemplos | La [referencia de la API de Inboxes](/docs/reference/inboxes) |

## Cómo funciona {#how}

1. **Crea** una dirección — en la consola con **New address**, o con `POST /v1/inboxes`.
2. **Envíale** correo desde el sistema bajo prueba, con la `phrase` del inbox en el asunto si tiene una.
3. **Lee** lo que llegó. Aparece en la consola en cuestión de segundos y, en los planes de pago, en `GET /v1/inboxes/{id}/messages`.
4. **Bórrala** cuando termines, o deja que caduque.

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
| Direcciones a la vez | 1 | 5 | 25 | 250 |
| Mensajes al mes | 1.000 | 25.000 | 250.000 | 5.000.000 |
| Se guardan durante (retención) | 1 día | 7 días | 30 días | 90 días |
| Vida útil de la dirección | 24 horas | hasta que la borres, o hasta 7 días si fijas una | hasta que la borres, o hasta 30 días | hasta que la borres, o cualquier vida útil |
| Frase en el asunto | siempre obligatoria | opcional | opcional | opcional |
| Lectura por la API | no (solo consola) | sí | sí | sí |
| Correo aceptado por minuto y dirección | 60 | 300 | 1.200 | 6.000 |

Los límites de tamaño son los mismos en todos los planes:

| | Límite |
| --- | --- |
| Un email | 5 MiB. El correo más grande se rechaza, nunca se trunca. |
| Cuerpo de texto o HTML | Se guardan 256K caracteres de cada uno; el resto se corta y el mensaje se marca con `truncated: true`. |
| Adjuntos | Se guardan el nombre, el tipo de contenido, el tamaño y el resumen criptográfico. El archivo en sí no se guarda, en ningún plan. |

## Cómo termina una dirección {#lifecycle}

| | Qué ocurre | ¿Puedes deshacerlo? |
| --- | --- | --- |
| **Desactivar** | La dirección deja de aceptar correo y conserva lo que tiene; el correo que se le envía se rechaza. | Sí — vuelve a activarla |
| **Borrar** | La dirección y su correo se borran, y la dirección se retira: nunca se vuelve a emitir, ni para ti ni para nadie. | No |
| **Caducidad** | En `expires_at`, lo mismo que Borrar. Solo caducan las direcciones del plan gratuito (24 horas) y las creadas con `expires_in_minutes`. | No |

Borrar es `DELETE /v1/inboxes/{id}`; las versiones anteriores de esta documentación y el registro de auditoría de la API lo llaman *release*. Una dirección retirada nunca se vuelve a emitir, a propósito: una dirección reciclada entregaría el restablecimiento de contraseña de un desconocido a quien la tuviera después. [Direcciones y la frase](/docs/product-inboxes/addresses#lifecycle) tiene los detalles, incluida la relación entre la caducidad y la retención.

## Lectura por la API {#reading}

Los mensajes se pueden leer en la consola en todos los planes, incluido el gratuito. Leerlos **de forma programática** es lo que añaden los planes de pago: `GET /v1/inboxes/{id}/messages` devuelve el mensaje analizado, las dos partes del cuerpo, los veredictos de autenticación y un campo `extracted` con cualquier código de un solo uso que hayamos encontrado — que suele ser lo único que quiere un test.

Todas las rutas usan el `id` del inbox. La consola lo muestra en la tarjeta de la dirección, con un botón para copiarlo. Si solo tienes la dirección, búscalo:

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes?address=ff25m3tue9vm@nninbox.com" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

La respuesta es la lista habitual, con un elemento como máximo. `GET /v1/inboxes` y `GET /v1/inboxes/{id}` devuelven juntos el `id`, la `address` y la `phrase`, así que una sola llamada te da todo lo necesario para enviar y para leer.

## Cómo obtener acceso {#access}

Regístrate en Inboxes y obtendrás un workspace en el plan gratuito: una dirección a la vez, retención de 24 horas y lectura en la consola. Los precios están en la [página de Inboxes](/inboxes).

Las claves no vienen con el workspace, y la API de Inboxes no las emite. Emite una en tu consola de la cuenta de NimbusNexus, en **API keys**, eligiendo **Inboxes** como producto — Identity es el único emisor de claves de API para todos los productos. Una clave es un JWT, así que empieza por `eyJ`. Envíala como `Authorization: Bearer <key>` o `X-API-Key: <key>`.

Elige el alcance al emitirla: `admin` puede crear, modificar y borrar direcciones además de leer, y `read` solo puede leer. Una clave de Inboxes no se puede limitar a un solo proyecto.

> **Una clave `inbx_…` ya no sirve para autenticarse.** Antes, Inboxes emitía sus propias claves con ese prefijo. Si tienes una, emite una de sustitución en la consola de la cuenta.

## Lo que no hace {#not}

- **No envía.** No hay API de envío ni de retransmisión. Una dirección que pudiera originar correo sería un servicio de spam.
- **No es un archivo histórico.** Un mensaje se borra cuando se agota la retención del plan, y todo lo que hay en una dirección desaparece cuando la dirección se borra o caduca.
- **Todavía no reenvía.** El reenvío de lo que llega a una URL tuya está previsto, pero no implementado.
- **No captura HTTP.** Un inbox solo recibe correo. Para webhooks y otras peticiones HTTP, usa [Request Bins](/docs/product-bins), cuyas URLs registran cualquier petición que reciban.

## Próximos pasos {#next-steps}

- [Inicio rápido](/docs/product-inboxes/quickstart) — crea una dirección, envíale un mensaje y léelo de vuelta.
- [Direcciones y la frase](/docs/product-inboxes/addresses) — el filtro del asunto, la caducidad y la retención.
- [Referencia de la API de Inboxes](/docs/reference/inboxes) — todas las rutas, con la petición en curl, TypeScript, Python o Go.
