---
title: "Slack, Teams y Discord"
description: "Envía eventos a un canal de Slack, Microsoft Teams o Discord, con una transformación predefinida que convierte cada evento en un mensaje que el canal acepta."
publishedAt: 2026-10-30
updatedAt: 2026-10-30
kind: guide
---

# Slack, Teams y Discord

Slack, Microsoft Teams y Discord dan a un canal una URL de webhook que publica todo lo que recibe — pero solo en su propio formato de mensaje, así que rechazan el sobre del evento que enviamos normalmente. Una [transformación](/docs/product-webhooks/transformations) salva esa diferencia. Al terminar esta guía tendrás:

- un endpoint que apunta a la URL de webhook de tu canal;
- el preset de esa aplicación, que convierte cada evento en un mensaje que la aplicación acepta;
- un evento de prueba publicado en el canal.

Tiempo total: unos 10 minutos.

## Requisitos previos {#prereqs}

- Un workspace de Webhooks en Starter, Pro o Custom. Free no incluye transformaciones.
- Poder añadir un webhook al canal: en Slack, instalar una aplicación en el workspace; en Teams, crear un flujo de trabajo; en Discord, tener el permiso **Manage Webhooks**.
- La [verificación de endpoints](/docs/product-webhooks/endpoint-verification#cannot-echo) desactivada para el proyecto en el que va el endpoint. Estos canales solo aceptan sus propios mensajes, así que nunca pueden responder al desafío de verificación, y un endpoint que debe superarlo no recibe nada. Los planes de pago pueden desactivar la verificación.

## 1 · Obtén la URL de webhook del canal {#webhook-url}

### Slack {#slack}

Crea una aplicación de Slack para tu workspace y activa **Incoming Webhooks** en su configuración. Elige **Add New Webhook to Workspace**, selecciona el canal y autoriza el acceso. Copia la URL, que tiene este aspecto: `https://hooks.slack.com/services/T…/B…/…`. Los pasos oficiales de Slack están en [Enviar mensajes con incoming webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks).

### Microsoft Teams {#teams}

En Teams, abre **Workflows** y parte de la plantilla **Send webhook alerts to a channel**. Elige el equipo y el canal, guarda el flujo de trabajo y copia la URL del webhook desde sus detalles. Los pasos oficiales de Microsoft están en [Crear incoming webhooks con Workflows para Microsoft Teams](https://support.microsoft.com/en-us/office/create-incoming-webhooks-with-workflows-for-microsoft-teams-8ae491c7-0394-4861-ba59-055e33f75498).

### Discord {#discord}

En Discord, abre **Server Settings → Integrations → Webhooks** y crea un webhook. Elige el canal en el que publica y después pulsa **Copy Webhook URL**; la URL tiene este aspecto: `https://discord.com/api/webhooks/…/…`. Los pasos oficiales de Discord están en [Introducción a los webhooks](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks).

Trata la URL como un secreto: estos canales no comprueban nuestra firma, así que cualquiera que la tenga puede publicar en el canal.

## 2 · Añade el endpoint {#endpoint}

En la consola, elige **New endpoint** en la página **Endpoints**, pega la URL y suscribe el endpoint a los eventos que debe ver el canal. Mantén la lista corta: un canal lo leen personas, y cada evento que coincide se convierte en un mensaje.

Por la API:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://hooks.slack.com/services/T…/B…/…", "project_id": "prj_…",
       "subscriptions": [{"match_kind": "exact", "pattern": "invoice.paid"}]}'
```

## 3 · Elige el preset {#preset}

Abre el menú del endpoint en la página **Endpoints** y elige **Transformation**. Selecciona **Preset** y después el de tu aplicación — **Slack message**, **Microsoft Teams card** o **Discord message** — y pulsa **Save**. A partir de ahora, cada entrega a este endpoint se envía como un mensaje:

| Preset | Lo que muestra el canal |
|---|---|
| Slack message | El tipo y el id del evento, cuándo ocurrió y sus datos en un bloque de código. |
| Microsoft Teams card | Una Adaptive Card con el tipo de evento, su id y su hora, y sus datos. |
| Discord message | El tipo y el id del evento, y sus datos en un bloque de código JSON. |

Cada uno recorta los datos para que quepan en el límite propio de la aplicación, como 3.000 caracteres en una sección de Slack o 2.000 en un mensaje de Discord.

Un preset es un script como cualquier otro, así que por la API no hay que indicar ningún nombre: [crea una transformación](/docs/product-webhooks/transformations#set-up) con el script que quieras. **Edit this script**, en la consola, muestra el código de cada preset para que partas de él.

## 4 · Pruébalo {#test}

En la sección **Test** de la misma página, elige **Run test**. Ejecuta el preset con un evento reciente de las entregas del endpoint, o con uno que pegues, y muestra el mensaje que enviaría. No se envía nada.

Después envía uno real: **Send test event** en la página Overview de la consola, o publica un evento al que esté suscrito el endpoint:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "invoice.paid", "project_id": "prj_…", "payload": {"id": "in_123", "amount": 125000, "currency": "usd"}}'
```

El mensaje aparece en el canal a los pocos segundos. El **Send test ping** del endpoint no sirve aquí: envía su ping fijo sin transformar, y el canal lo rechaza.

## Lo que has hecho {#summary}

Ahora, cada evento al que está suscrito el endpoint publica un mensaje en tu canal. Abre una entrega en la página **Deliveries** para ver el mensaje que se envió; si la aplicación respondió con un error, también aparece ahí, en los intentos de la entrega.

## Cómo personalizarlo {#customize}

Elige **Edit this script** para cambiar lo que dice el mensaje o qué eventos publican uno. Devolver `null` no envía nada, así que un script puede reservar el canal para los eventos que la gente necesita. Para Slack:

```js
function transform(event) {
  if (event.type !== "invoice.paid" || event.data.amount < 100000) return null;
  return { body: { text: `Invoice ${event.data.id} paid: ${event.data.amount / 100} ${event.data.currency}` } };
}
```

Para Discord, envía `content` donde Slack espera `text`; para Teams, conserva la tarjeta del preset y cambia el texto que contiene. Una entrega que el script descarta no se envía y no cuenta como fallida. Prueba el script antes de guardarlo: una ejecución que falla manda la entrega a la cola dead-letter; nunca se envía el evento sin transformar.

## Próximos pasos {#next-steps}

- [Transformaciones](/docs/product-webhooks/transformations) — el contrato del script, los límites y qué pasa cuando un script falla.
- [Verificación de endpoints](/docs/product-webhooks/endpoint-verification#cannot-echo) — los receptores que no pueden responder al desafío.
- [Entregas y reintentos](/docs/product-webhooks/deliveries) — estados, reintentos y cómo volver a enviar.
