---
title: "Slack, Teams y Discord"
description: "Envía eventos a un canal de Slack, Microsoft Teams o Discord, con una plantilla que convierte cada evento en un mensaje que el canal acepta."
publishedAt: 2026-10-30
updatedAt: 2026-11-03
kind: guide
---

# Slack, Teams y Discord

Slack, Microsoft Teams y Discord dan a un canal una URL de webhook que publica todo lo que recibe — pero solo en su propio formato de mensaje, así que rechazan el sobre del evento que enviamos normalmente. Una [transformación](/docs/product-webhooks/transformations) salva esa diferencia. Al terminar esta guía tendrás:

- un endpoint que apunta a la URL de webhook de tu canal;
- la plantilla de esa aplicación, que convierte cada evento en un mensaje que la aplicación acepta;
- un evento de prueba publicado en el canal.

Tiempo total: unos 10 minutos.

## Requisitos previos {#prereqs}

- Un workspace de Webhooks en cualquier plan: las plantillas de chat son pipelines, y todos los planes las incluyen.
- Poder añadir un webhook al canal: en Slack, instalar una aplicación en el workspace; en Teams, crear un flujo de trabajo; en Discord, tener el permiso **Manage Webhooks**.
- La [verificación de endpoints](/docs/product-webhooks/endpoint-verification#cannot-echo) desactivada para el proyecto en el que va el endpoint. Estos canales solo aceptan sus propios mensajes, así que nunca pueden responder al desafío de verificación, y un endpoint que debe superarlo no recibe nada. Los planes de pago pueden desactivar la verificación; en un plan que la exige, estos canales no se pueden usar.

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

## 3 · Parte de la plantilla {#preset}

Abre el menú del endpoint en la página **Endpoints** y elige **Transformation**. Selecciona **Pipeline** y, en **Start from a template**, la de tu aplicación — **Use Slack message**, **Use Microsoft Teams card** o **Use Discord message** — y pulsa **Save**. A partir de ahora, cada entrega a este endpoint se envía como un mensaje:

| Plantilla | Lo que muestra el canal |
|---|---|
| Slack message | El tipo de evento como encabezado, su id y su hora, y sus datos en un bloque de código. |
| Microsoft Teams card | Una Adaptive Card con el tipo de evento, su id y su hora, y sus datos en monoespaciado. |
| Discord message | Un embed con el tipo de evento como título, sus datos en un bloque de código JSON y, debajo, su id y su hora. No menciona a nadie. |

Cada plantilla recorta los datos para que quepan en los límites de la aplicación, y nada del evento puede dar formato al mensaje, mencionar a nadie ni cerrar antes de tiempo el bloque de código. Al guardarla, la pipeline pasa a ser tuya: no cambia aunque cambie la plantilla.

Por la API, `GET /v1/transformations/templates` devuelve cada plantilla con su `pipeline`: [crea una transformación](/docs/product-webhooks/transformations#set-up) con ese documento y después pon su id en el `transformation_id` del endpoint.

Un endpoint que ya ejecuta uno de los antiguos presets, que son scripts, lo sigue ejecutando sin cambios.

## 4 · Pruébalo {#test}

En la sección **Test** de la misma página, elige **Run test**. Ejecuta la pipeline del editor con un evento reciente de las entregas del endpoint, o con uno que pegues, y muestra el mensaje que enviaría. No se envía nada.

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

Los pasos de la plantilla ahora son los de tu pipeline, así que puedes cambiarlos como cualquier otro. Para reservar el canal para los eventos que la gente necesita, añade un paso **Filter** con **Send only matching events** y dos condiciones, `type` **is** `invoice.paid` y `data.amount` **is at least** `100000`, y súbelo al principio, para que compruebe el evento antes de que se construya el mensaje. En JSON:

```json
{ "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } } }
```

Una entrega que el filtro descarta no se envía y no cuenta como fallida. Para cambiar lo que dice el mensaje, edita el paso **Reshape the body**, que lo construye; la consola lo muestra como JSON, así que cámbialo ahí y pulsa **Apply**. Sus valores leen el evento mediante [rutas y filtros](/docs/product-webhooks/transformations#values), como `{{ data.amount | money(data.currency) }}`. Prueba antes de guardar: una ejecución que falla manda la entrega a la cola dead-letter; nunca se envía el evento sin transformar.

## Próximos pasos {#next-steps}

- [Transformaciones](/docs/product-webhooks/transformations#templates) — plantillas, pasos de una pipeline, pruebas y qué pasa cuando una ejecución falla.
- [Verificación de endpoints](/docs/product-webhooks/endpoint-verification#cannot-echo) — los receptores que no pueden responder al desafío.
- [Entregas y reintentos](/docs/product-webhooks/deliveries) — estados, reintentos y cómo volver a enviar.
