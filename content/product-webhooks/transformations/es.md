---
title: "Transformaciones"
description: "Adapta, filtra o descarta cada entrega con una función corta de JavaScript que se ejecuta en un sandbox antes de que la entrega se firme y se envíe."
publishedAt: 2026-10-30
updatedAt: 2026-10-30
kind: concept
---

# Transformaciones

Una transformación es una función corta de JavaScript asociada a un endpoint. Recibe cada evento antes de que lo entreguemos y devuelve la petición que hay que enviar en su lugar, o `null` para no enviar nada. Se ejecuta en un sandbox sin acceso a la red y con un presupuesto fijo de CPU y memoria, una vez por entrega; lo que devuelve se firma con el secreto del endpoint y se envía como cualquier otra entrega.

## Para qué sirve {#what-for}

- **Receptores que necesitan su propio formato.** Slack, Microsoft Teams y Discord solo aceptan sus propios formatos de mensaje y rechazan nuestro sobre. Una transformación convierte cada evento en un mensaje que aceptan; los [presets](#presets) lo hacen por ti.
- **Un formato distinto para cada receptor.** Tu propio servicio recibe el payload completo, un CRM recibe tres campos y un proveedor de analítica no recibe nada que contenga datos personales.
- **Filtrar por el payload.** Una [suscripción](/docs/product-webhooks#objects) solo coincide por el tipo de evento. "Solo los `invoice.paid` de más de $1.000" necesita el payload, y un script puede leerlo.

## El script {#script}

Una transformación es una sola función llamada `transform`:

```js
function transform(event, context) {
  // event:   { id, type, created_at, data, version }, the envelope we would otherwise send
  // context: { endpoint: { id, description }, attempt }
  if (event.type === "invoice.paid" && event.data.amount < 100000) {
    return null; // send nothing for small invoices
  }
  return {
    body: { text: `Invoice ${event.data.id} paid: ${event.data.amount / 100} ${event.data.currency}` },
    headers: { "X-Team": "billing" },
  };
}
```

Lo que devuelve decide lo que se envía:

| Lo que devuelve | Lo que se envía |
|---|---|
| `{ body: { … } }` o `{ body: [ … ] }` | El cuerpo como JSON, con `Content-Type: application/json`. |
| `{ body: "…" }` | La cadena tal cual, con `Content-Type: text/plain; charset=utf-8`. |
| `{ body: …, contentType: "…" }` | El cuerpo con ese tipo de contenido. |
| `{ body: …, headers: { … } }` | El cuerpo, con estas cabeceras añadidas, sujetas a las mismas reglas que las cabeceras personalizadas de un endpoint. Usa `contentType` en lugar de una cabecera `Content-Type`. |
| `null` | Nada. La entrega se [descarta](#dropped). |

La URL y el método siguen siendo los del endpoint: la URL es la que se registró, se comprobó y, cuando es obligatorio, se [verificó](/docs/product-webhooks/endpoint-verification). Lo que el script escriba con `console.log` se guarda con la entrega, hasta 4 KiB.

El script es JavaScript moderno estándar, en un solo archivo. No tiene acceso a la red ni al sistema de archivos, no tiene temporizadores y no puede importar módulos, así que una biblioteca que necesite tiene que ir empaquetada dentro del script.

## Presets {#presets}

Los presets son scripts que escribimos y mantenemos nosotros, para los receptores por los que más nos preguntan:

| Preset | Envía |
|---|---|
| **Slack message** | El tipo, el id y los datos del evento como un mensaje de Slack, para un incoming webhook de Slack. |
| **Microsoft Teams card** | El evento como una Adaptive Card, para el webhook de un flujo de trabajo de Teams. |
| **Discord message** | El tipo, el id y los datos del evento como un mensaje de Discord, para el webhook de un canal de Discord. |
| **Keep only these fields** | El sobre, solo con los campos de `data` que indiques. Un nombre con puntos, como `customer.id`, llega a un campo anidado. |

Elegir un preset guarda su script como una transformación tuya, así que puedes abrirla y cambiarla como cualquier otra. [Slack, Teams y Discord](/docs/product-webhooks/chat-apps) explica cada receptor paso a paso, desde el principio.

## Cómo configurar una {#set-up}

En la consola, abre el menú del endpoint en la página **Endpoints** y elige **Transformation**. Selecciona **Preset** o **Script**, [pruébala](#test) y pulsa **Save**: las siguientes entregas del endpoint ya pasan por ella. **Off** la vuelve a quitar.

Por la API, crea la transformación en el proyecto del endpoint y después apunta el endpoint a ella:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "CRM fields", "project_id": "prj_…", "code": "function transform(event) { return { body: { id: event.id, total: event.data.total } }; }"}'

curl -sX PATCH {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a… \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"transformation_id": "tr_…"}'
```

Antes de guardar el script, lo cargamos en el sandbox sin llamarlo: un script con un error de sintaxis, sin función `transform` o con código de nivel superior que falla se rechaza con `422 invalid_transformation`, y no se guarda nada. Un endpoint ejecuta como máximo una transformación; una misma transformación puede servir a varios endpoints de su proyecto. `{"transformation_id": null}` la desvincula.

## Cómo probar un script {#test}

**Test** ejecuta el script que hay en el editor, esté guardado o no, en el mismo sandbox que usan las entregas, con un evento reciente de las propias entregas del endpoint o con uno que pegues. Muestra lo que se enviaría, las cabeceras, los logs y cuánto tardó. No se envía ni se guarda nada.

Por la API:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations/test \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"code": "function transform(event) { return { body: { text: event.type } }; }",
       "event": {"id": "evt_1", "type": "invoice.paid", "created_at": "2026-10-30T12:00:00+00:00", "data": {}, "version": "1"}}'
```

```json
{ "status": "ok", "body": "{\"text\":\"invoice.paid\"}", "content_type": "application/json", "headers": {}, "logs": "", "reason": null, "error": null, "fuel": 2764502, "duration_ms": 3.6 }
```

`status` es `ok`, `dropped` (el script devolvió `null`) o `failed`, y `reason` y `error` indican por qué. Un script que falla sigue dando un `200`. Las pruebas y las comprobaciones al guardar comparten un cupo de 60 por minuto por workspace, con ráfagas de 10.

El **Send test ping** de un endpoint sigue enviando su cuerpo de ping fijo sin transformar; usa **Test** para ver lo que recibirá tu receptor.

## Qué registra una entrega {#deliveries}

El script se ejecuta una vez por entrega, en su primer intento. Lo que devuelve se guarda con la entrega y se firma con el secreto del endpoint como cualquier otro cuerpo, y cada reintento vuelve a enviar esos mismos bytes sin ejecutar otra vez el script, así que un reintento no puede cambiar lo que recibe el receptor. [Volver a entregarla](/docs/product-webhooks/deliveries#replay) ejecuta de nuevo la versión actual de la transformación.

En la consola, abre una entrega en la página **Deliveries** para ver la transformación y la versión que le dieron forma, cuánto tardó la ejecución, el cuerpo que se envió y los logs, o el error. Por la API, `GET /v1/deliveries/{id}/transform` devuelve esa ejecución, o `null` si no se ejecutó ninguna.

### Entregas descartadas {#dropped}

Cuando el script devuelve `null`, no se envía nada y no se hace ningún intento. La entrega queda como `sent` con `"dropped": true`, la consola la muestra como **dropped**, y las estadísticas del endpoint y del workspace la cuentan aparte de las entregadas: la tasa de éxito se calcula sobre lo que debía enviarse.

## Cuando un script falla {#failures}

Una ejecución falla cuando el script lanza una excepción, se queda sin tiempo o sin memoria, entra en una recursión demasiado profunda o devuelve algo que no es una petición (un objeto con `body`, o `null`). La entrega va entonces directamente a la cola dead-letter, con un `last_error` que empieza por `transform_failed:`. Nunca enviamos en su lugar el evento sin transformar: el receptor puede ser un tercero, y el script puede estar ahí precisamente para ocultarle datos.

Cada ejecución fallida cuenta en contra de la transformación, igual que las entregas fallidas cuentan en contra de un endpoint. Tras 20 fallos seguidos, la transformación se desactiva automáticamente, las entregas de sus endpoints quedan a la espera, y enviamos un email al propietario del workspace y un [webhook operativo](/docs/product-webhooks/deliveries#operational) `transformation.disabled`. Arregla el script, pruébalo y vuelve a activar la transformación (**Resume** en la consola, o `PATCH /v1/transformations/{id}` con `{"status": "enabled"}`): las entregas que esperaban salen, y las que fueron a la cola dead-letter se pueden [volver a entregar](/docs/product-webhooks/deliveries#replay).

## Pausa y versiones {#versions}

**Pause** (`{"status": "disabled"}`) detiene una transformación sin desvincularla. Las entregas de sus endpoints esperan en lugar de salir sin transformar: aparecen como `failed`, con el `last_error` "paused: the endpoint's transformation is not running", y salen cuando la reanudas.

Cada vez que guardas código nuevo, se crea una versión nueva. Se guardan las últimas 50 versiones (`GET /v1/transformations/{id}/versions`), y cada entrega registra la versión que le dio forma. Para volver a una versión anterior, cárgala en el editor y guárdala: pasa a ser la versión más reciente.

## Límites {#limits}

Cada ejecución dispone de:

| Límite | Valor |
|---|---|
| CPU | Unos 50 ms de tiempo de script, contados en instrucciones en lugar de medidos, así que el mismo script tiene el mismo presupuesto por mucha carga que tengamos |
| Tiempo transcurrido | 1 segundo |
| Memoria | 64 MiB |
| Tamaño del script | 1 MiB |
| Salida | 256 KiB |
| Logs | 4 KiB |

Los scripts se ejecutan en un servicio propio, separado de la entrega, y cada workspace solo puede ejecutar unos pocos a la vez, así que un script lento o roto solo perjudica a sus propias entregas, no a las de nadie más. Un script típico tarda unos pocos milisegundos.

## Planes {#plans}

Las transformaciones, tanto presets como scripts, están incluidas en todos los planes de pago: Starter, Pro y Custom. Free no las incluye. Los planes se diferencian en cuántos scripts de un workspace se ejecutan a la vez: 2 en Starter, 4 en Pro y lo que diga el contrato en Custom. La tarjeta del plan en la página Overview de la consola cuenta las ejecuciones de este mes. Las ejecuciones se cuentan, pero no se facturan.

Un workspace que deja su plan de pago conserva sus transformaciones y todavía puede renombrarlas, pausarlas, desvincularlas y borrarlas, pero no guardar código nuevo, ni probar ni reanudar ninguna. Las entregas a un endpoint que todavía tiene una esperan hasta que el plan vuelva a incluir transformaciones o hasta que la desvincules.

## Errores {#errors}

| Estado | Código | Cuándo |
|---|---|---|
| `402` | `not_entitled` (`feature: transformations`) | Crear una, guardar código nuevo, activar una o hacer una prueba en un plan sin transformaciones. |
| `422` | `invalid_transformation` | El script no se cargó: `syntax_error`, `no_transform`, `code_too_large` o `load_failed`, con la causa. |
| `409` | `conflict` (`transformation_in_use`) | Borrar una transformación que un endpoint todavía ejecuta. Desvincúlala primero. |
| `404` | `not_found` (`transformation`, `transformation_version`) | Ya no existe, o esa versión ya no se guarda. |
| `429` | `rate_limited` | Se han superado las 60 pruebas y comprobaciones al guardar por minuto. |
| `503` | `unavailable` (`transform`) | El sandbox no pudo ejecutar el script en ese momento. No se guardó nada; vuelve a intentarlo. |

## Próximos pasos {#next-steps}

- [Slack, Teams y Discord](/docs/product-webhooks/chat-apps) — envía eventos a un canal con un preset.
- [Entregas y reintentos](/docs/product-webhooks/deliveries) — qué le pasa a una entrega después de que se ejecute su script.
- [Verificación de endpoints](/docs/product-webhooks/endpoint-verification) — por qué los receptores de chat necesitan la verificación desactivada.
- [Resumen de Webhooks](/docs/product-webhooks) — eventos, endpoints y suscripciones.
