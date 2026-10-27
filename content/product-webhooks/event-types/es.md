---
title: "Tipos de evento"
description: "El catálogo de nombres de evento de un workspace, la política para los nombres que aún no ha visto y los JSON Schemas opcionales que deben cumplir los payloads."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: concept
---

# Tipos de evento

Cada evento tiene un tipo — `order.created`, `stripe.invoice.paid` — y los endpoints se [suscriben](/docs/product-webhooks#objects) a los tipos por patrón. El catálogo de tipos de evento es la lista de nombres que usa tu workspace, con una descripción y un JSON Schema opcionales para cada uno. También es donde decides qué pasa cuando aparece un nombre que nadie ha registrado.

## ¿Tengo que registrar los tipos? {#register}

No — no con la política por defecto. Con **Lenient**, cualquier tipo que publiques (o que reciba una [fuente](/docs/product-webhooks/sources)) se acepta y se añade al catálogo la primera vez que aparece. La mayoría de los workspaces nunca registran un tipo a mano.

Registra uno cuando quieras:

- **describirlo** para quien desarrolle contra tus webhooks;
- **comprobar sus payloads** contra un JSON Schema (más abajo);
- o pasar a **Strict**, donde solo se pueden publicar tipos registrados.

En cualquier caso, las suscripciones de los endpoints coinciden por el nombre; una suscripción a `order.` no necesita que `order.created` esté en el catálogo.

## La política para tipos no registrados {#policy}

| Política | Un tipo no registrado… |
|---|---|
| **Lenient** (por defecto) | se acepta y se añade al catálogo. |
| **Strict** | se rechaza con `422 unknown_event_type`. |

Strict va bien en un workspace donde el conjunto de tipos es un contrato — así, una errata en un publicador falla de forma visible al publicar en lugar de crear sin avisar un tipo al que no se suscribe ningún endpoint. Una petición de una fuente rechazada así aparece como `unknown_event_type` en las [peticiones capturadas](/docs/product-webhooks/captured-requests#outcomes).

La política se fija para el workspace y se puede fijar por proyecto (`PUT /v1/event-types/policy`, con `?project_id=` para un proyecto). En la consola es el control **When an unregistered type arrives** de la página Event types, y sigue al selector de proyecto.

## Esquemas de payload {#schemas}

Un tipo puede llevar un [JSON Schema](https://json-schema.org/) (draft 7). A partir de entonces, cada publicación de ese tipo se comprueba contra él, y un payload que no lo cumple se rechaza con `422 invalid_payload`, con la lista de lo que ha fallado.

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/event-types \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "name": "order.created",
        "description": "A customer placed an order",
        "payload_schema": {
          "type": "object",
          "required": ["order_id", "total"],
          "properties": {"order_id": {"type": "string"}, "total": {"type": "integer"}}
        }
      }'
```

Los esquemas se comprueban al guardarlos: uno que no es un JSON Schema válido, o cuyas expresiones regulares podrían hacer la comprobación extremadamente lenta, se rechaza con una explicación.

## Tipos de todo el workspace y por proyecto {#scope}

Un tipo registrado sin proyecto se aplica a todos los proyectos. Uno registrado con `project_id` solo se aplica a ese proyecto, y ahí tiene prioridad sobre una entrada de todo el workspace con el mismo nombre — así, un proyecto puede llevar su propia descripción o un esquema más estricto. La columna **Applies to** de la consola muestra cuál es cuál.

## De dónde viene un tipo {#origin}

| Origen | En la consola | Cómo llegó ahí |
|---|---|---|
| `manual` | added here | Se registró en la consola o con `POST /v1/event-types`. |
| `ingest` | from a source | Llegó por primera vez a través de una fuente, con Lenient. |
| `lenient` | auto-added | Se publicó por primera vez a través de la API, con Lenient. |

## `webhook.received` {#webhook-received}

Si el catálogo muestra `webhook.received` y tú nunca lo publicaste: una fuente recibió peticiones de las que no pudo leer un tipo, y no tenía un tipo por defecto al que recurrir. Dale a esa fuente un tipo por defecto, o indícale la cabecera o la ruta JSON que lleva el tipo — consulta [Tipos de evento de una fuente](/docs/product-webhooks/sources#event-types).

## Próximos pasos {#next-steps}

- [Fuentes](/docs/product-webhooks/sources) — cómo lee una fuente el tipo de la petición de un proveedor.
- [Resumen de Webhooks](/docs/product-webhooks) — las suscripciones y los demás objetos.
- [Errores](/docs/errors) — `unknown_event_type`, `invalid_payload` y el resto.
