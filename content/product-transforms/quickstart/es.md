---
title: "Inicio rápido de Transforms"
description: "Prueba una pipeline con una petición, guárdala, ejecútala, mira cómo se descarta una petición y guarda una versión nueva, por la API."
publishedAt: 2026-11-06
updatedAt: 2026-11-11
kind: quickstart
---

# Inicio rápido de Transforms

De cero a una pipeline con versiones en unos minutos. Vas a probar una pipeline con una petición, guardarla, ejecutarla, ver cómo se descarta una petición y guardar una versión nueva. Para ver lo que hace una pipeline antes de iniciar sesión, prueba el [playground](/transforms/playground).

## Antes de empezar {#before}

Crea una clave de API en tu [consola de la cuenta]({{ACCOUNT_BASE_URL}}/api-keys?product=transforms), con **Transforms** como producto y **Read & write** como permiso. Free basta para todo lo que hay aquí. Después, pon la clave en una variable de entorno:

```bash
export TRANSFORMS_API_KEY="<your-api-key>"
```

Todas las rutas siguientes son relativas a `https://transforms.nimbusnexus.net`, y todas las peticiones llevan `Authorization: Bearer <your key>`.

## 1. Prueba una pipeline {#test}

Esta pipeline mantiene las facturas pagadas de $1,000 o más, quita el email del cliente y cualquier número de teléfono, y añade dos campos y una cabecera. `POST /v1/pipelines/test` ejecuta un documento una vez, con una petición que envías, y no guarda ni cuenta nada:

```bash
curl -X POST https://transforms.nimbusnexus.net/v1/pipelines/test \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } },
        { "headers": { "set": { "X-Event-Type": "{{ type }}" } } }
      ]
    },
    "body": {
      "type": "invoice.paid",
      "data": {
        "id": "in_42",
        "amount": 150000,
        "currency": "usd",
        "customer": { "name": "Ana Silva", "email": "ana@example.com", "phone": "+1 202 555 0142" }
      }
    }
  }'
```

```json
{
  "status": "ok",
  "version": null,
  "body": {
    "type": "invoice.paid",
    "data": {
      "id": "in_42",
      "amount": 150000,
      "currency": "usd",
      "customer": { "name": "Ana Silva" }
    },
    "event_type": "invoice.paid",
    "amount_display": "1,500.00 USD"
  },
  "body_changed": true,
  "headers": { "X-Event-Type": "invoice.paid" },
  "query": {},
  "step": null,
  "note": null,
  "reason": null,
  "error": null,
  "duration_ms": 0.4
}
```

`status` es `ok`, así que `body` y `headers` son lo que hay que enviar. `version` es `null` porque todavía no se ha guardado nada.

## 2. Guárdala {#save}

Guarda el mismo documento como pipeline, con un nombre:

```bash
curl -X POST https://transforms.nimbusnexus.net/v1/pipelines \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Paid invoices",
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } },
        { "headers": { "set": { "X-Event-Type": "{{ type }}" } } }
      ]
    }
  }'
```

La respuesta es `201` con [la pipeline](/docs/product-transforms/reference#pipeline), recortada aquí:

```json
{
  "id": "pipe_8e27d40b19c3f6a5e0d71b42",
  "name": "Paid invoices",
  "status": "enabled",
  "current_version": 1,
  "destinations": [],
  "consumers": []
}
```

Guarda el `id`: todas las llamadas posteriores lo usan.

```bash
export PIPELINE_ID="pipe_8e27d40b19c3f6a5e0d71b42"
```

## 3. Ejecútala {#run}

Envía una petición a la pipeline guardada. La ejecución acepta un `body` y, opcionalmente, `headers` y `meta`, y responde con lo que hizo la pipeline:

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body": {"type": "invoice.paid", "data": {"id": "in_42", "amount": 150000, "currency": "usd"}}}'
```

La respuesta tiene la misma forma que la de la prueba, con `"version": 1`. No se guarda nada de la petición, y la ejecución suma una al recuento del mes en `GET /v1/usage`. Enviar el resultado es cosa tuya: Transforms no envía nada por sí mismo.

## 4. Mira cómo se descarta una petición {#dropped}

Envía una factura por debajo del importe del filtro:

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body": {"type": "invoice.paid", "data": {"id": "in_43", "amount": 99999, "currency": "usd"}}}'
```

```json
{
  "status": "dropped",
  "version": 1,
  "body": null,
  "body_changed": false,
  "headers": {},
  "query": {},
  "step": 0,
  "note": "Paid invoices of $1,000 or more",
  "reason": "no_match",
  "error": "dropped by step 0 (Paid invoices of $1,000 or more)",
  "duration_ms": 0.1
}
```

Sigue siendo un `200`, porque la pipeline se ejecutó. `step` cuenta desde 0, y `reason` es `no_match` para un filtro con el que la petición no coincidió. En este caso, no envíes nada.

## 5. Guarda una versión nueva {#version}

Haz `PATCH` de la pipeline con un documento nuevo, aquí sin el paso de cabeceras:

```bash
curl -X PATCH "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } }
      ]
    }
  }'
```

`current_version` ahora es `2`, y las ejecuciones usan esa versión. La versión 1 no ha cambiado: `GET /v1/pipelines/{id}/versions` lista las versiones guardadas, y una ejecución todavía puede nombrar una de ellas:

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"version": 1, "body": {"type": "invoice.paid", "data": {"id": "in_42", "amount": 150000, "currency": "usd"}}}'
```

Para volver a la versión 1, guarda de nuevo su contenido, lo que la convierte en la versión 3.

## En la consola {#console}

La consola en `https://transforms.nimbusnexus.net` hace todo esto con un formulario para cada paso: **Filter**, **Remove fields**, **Set fields**, **Reshape the body**, **Headers** y **Credential**. **Start from a template** ofrece mensajes de Slack, Discord y Teams, Keep only these fields y Drop personal data, y **JSON** muestra el documento completo. Prueba lo que hay en el editor antes de guardarlo.

## Limpieza {#cleanup}

Cada plan limita cuántas pipelines puedes tener, así que borra esta cuando termines:

```bash
curl -X DELETE "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY"
```

Borrar es **permanente**, para la pipeline y para todas sus versiones. Para que deje de ejecutarse durante un tiempo, haz `PATCH` de la pipeline con `{"status": "disabled"}`, y más adelante vuelve a `{"status": "enabled"}`. Una pipeline desactivada responde a una ejecución con `409` `conflict`, `pipeline_disabled`.

## Próximos pasos {#next-steps}

- [Pipelines](/docs/product-transforms/pipelines) — todos los pasos, rutas, filtros y plantillas.
- [Referencia de Transforms](/docs/product-transforms/reference) — todas las rutas y campos, roles, límites y errores.
- [API de Transforms](/docs/reference/transforms) — todas las operaciones, con la petición en curl, TypeScript, Python o Go.
- [Resumen del producto](/docs/product-transforms) — credenciales, planes y lo que no hace Transforms.
