---
title: "Inicio rápido de Inboxes"
description: "Crea una dirección de email desechable, envíale un mensaje y léelo de vuelta — en la consola o con curl."
publishedAt: 2026-08-18
updatedAt: 2026-10-22
kind: quickstart
---

# Inicio rápido de Inboxes

De cero a algo que puedes comprobar en un test. Vas a crear una dirección de email, enviarle correo real y leer su código de un solo uso.

## Antes de empezar {#before}

- **En la consola, con cualquier plan.** Abre Inboxes y elige **New address**. La tarjeta de la nueva dirección muestra exactamente a qué enviar: la dirección, y su frase si tiene una. Lo que llega aparece debajo en cuestión de segundos. Ese es todo el flujo en el plan gratuito.
- **Por la API, con un plan de pago.** Leer de forma programática requiere Starter o superior — en el plan gratuito las rutas de mensajes responden `not_entitled`. También necesitas una clave de API emitida en la consola de la cuenta con **Inboxes** como producto; consulta [Cómo obtener acceso](/docs/product-inboxes#access).

Todas las rutas siguientes son relativas a `{{INBOXES_BASE_URL}}`, y todas las peticiones llevan `Authorization: Bearer <your key>`.

## 1. Crea una dirección {#allocate}

```bash
curl -X POST {{INBOXES_BASE_URL}}/v1/inboxes \
  -H "Authorization: Bearer $INBOXES_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phrase": true}'
```

```json
{
  "id": "inb_7f820a77f64ea18174499945",
  "address": "ff25m3tue9vm@nninbox.com",
  "transport": "email",
  "phrase": "nn-re89dr",
  "status": "enabled",
  "expires_at": null
}
```

Importan tres campos:

- **`address`** es lo que le das al sistema bajo prueba.
- **`phrase`** debe aparecer en el asunto de todo lo que se envíe a esa dirección, o el correo se rechaza — eso es lo que impide que una dirección filtrada se use para registrarse en servicios. En un plan de pago, la frase solo se activa si la pides: sin `"phrase": true` obtienes `"phrase": ""` y la dirección acepta cualquier asunto.
- **`id`** es lo que usan todas las llamadas posteriores. Guárdalo.

`expires_at` es `null` porque una dirección de un plan de pago vive hasta que la borras; envía `expires_in_minutes` para obtener una que caduque sola.

`transport` siempre es `"email"`, porque un inbox solo recibe correo. `POST /v1/inboxes` acepta `"transport": "email"` o ningún `transport`; cualquier otro valor, como `"http"`, se rechaza con un `422` `validation_error`. Para registrar peticiones HTTP, usa [Request Bins](/docs/product-bins).

## 2. Envíale un mensaje {#send}

Aquí no hay nada específico de NimbusNexus — envía desde lo que estés probando. La única regla es el asunto:

```text
To:      ff25m3tue9vm@nninbox.com
Subject: nn-re89dr Your verification code
```

Un asunto sin la frase se rechaza durante la conversación SMTP. Tu emisor se entera, y no se guarda nada — así que, si aquí falta un mensaje, es un rechazo real, no un descarte silencioso.

## 3. Léelo de vuelta {#read}

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945/messages?extract=otp" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

```json
{
  "items": [
    {
      "id": "msg_bd160c0bcf8db20fba4e535d",
      "from_addr": "noreply@example.test",
      "subject": "nn-re89dr Your verification code",
      "received_at": "2026-08-18T09:12:04Z",
      "extracted": { "otp": "100017" }
    }
  ],
  "next_offset": null
}
```

`extracted.otp` es lo importante. Un test que comprueba un flujo de registro suele querer exactamente una cosa — el código — y `?extract=otp` lo pone en la respuesta de la lista, así que el caso habitual no necesita una segunda petición. Sin `extract`, `extracted` es `null`; `extract=links` devuelve en su lugar los enlaces del mensaje, y `extract=all` devuelve ambos.

Para el mensaje completo, incluidas las dos partes del cuerpo y los veredictos de SPF/DKIM/DMARC:

```bash
curl {{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945/messages/msg_bd160c0bcf8db20fba4e535d \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

**¿Solo tienes la dirección?** Busca el inbox para obtener su `id`:

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes?address=ff25m3tue9vm@nninbox.com" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

## Polling, no push {#polling}

No hay stream ni callback. El correo llega en cuestión de segundos, así que haz polling de la ruta de la lista — basta con un intervalo corto durante unos segundos, y es lo que hace la propia consola.

No hagas polling un número fijo de veces para comprobar después la última respuesta. Comprueba que el mensaje *aparece*, con un timeout, o un emisor lento parecerá uno averiado.

## Limpieza {#cleanup}

Una dirección de un plan de pago nunca caduca salvo que la hayas creado con `expires_in_minutes`, y todos los planes limitan cuántas puedes tener a la vez — así que bórrala cuando termines:

```bash
curl -X DELETE {{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945 \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

Borrar es **permanente**: el inbox y lo que contiene se borran, y la dirección se retira para que nunca se pueda volver a emitir, ni para ti ni para nadie. Es deliberado — una dirección desechable reciclada entregaría el correo de un desconocido en tu inbox. Para pausarla en su lugar, haz `PATCH` con `{"status": "disabled"}` y vuelve a activarla más tarde.

## Próximos pasos {#next-steps}

- [Direcciones y la frase](/docs/product-inboxes/addresses) — las reglas de aceptación completas y cómo se relaciona la caducidad con la retención.
- [Resumen del producto](/docs/product-inboxes) — todos los límites por plan y lo que no hace el producto.
- [Referencia de la API de Inboxes](/docs/reference/inboxes) — todas las rutas, con la petición en curl, TypeScript, Python o Go.
