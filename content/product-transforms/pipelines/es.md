---
title: "Pipelines"
description: "Los pasos de una pipeline, sus rutas, valores y filtros, las plantillas de las que partir y los límites de una ejecución."
publishedAt: 2026-11-06
updatedAt: 2026-11-06
kind: concept
---

# Pipelines

Una pipeline es un documento JSON, y esta página describe su lenguaje. Webhooks y Request Bins ejecutan el mismo lenguaje en el mismo motor, así que lo que aprendas aquí también vale allí, dentro de las reglas de cabeceras de cada producto. Para probar todo esto sin cuenta, usa el [playground](/transforms/playground).

## El documento {#document}

Esta pipeline mantiene las facturas pagadas de $1,000 o más, quita el email del cliente y cualquier número de teléfono, añade dos campos y una cabecera, e indica que un bearer token va en la petición:

```json
{
  "version": 1,
  "steps": [
    { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
    { "drop": ["data.customer.email", "**.phone"] },
    { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } },
    { "headers": { "set": { "X-Event-Type": "{{ type }}" } } },
    { "auth": { "type": "bearer", "secret": "sec_…" } }
  ]
}
```

`version` es el formato del documento, siempre `1`; no es la versión de la pipeline. Los pasos se ejecutan en el orden en que están escritos. Cada uno es un objeto con una clave de paso y, opcionalmente, una `note` de hasta 200 caracteres, que la consola muestra en el paso y que un descarte incluye en su respuesta. Un `filter` también puede llevar una `action`.

Una ejecución ve una sola petición: un `body`, cualquier valor JSON; `headers`; y `meta`, de solo lectura. En la API de ejecución, los tres son lo que envíes. Cada paso ve el cuerpo tal como lo dejó el anterior. Los pasos se numeran desde 0 en la API y en los textos de error, y desde 1 en el editor de la consola.

| Paso | En la consola | Qué hace |
|---|---|---|
| `filter` | **Filter** | Mantiene la petición solo si coincide o, con `"action": "drop"`, la descarta si coincide. |
| `drop` | **Remove fields** | Quita campos del cuerpo. |
| `set` | **Set fields** | Añade o sobrescribe campos. |
| `map` | **Reshape the body** | Sustituye el cuerpo por uno que construyes tú. |
| `headers` | **Headers** | Pone, quita o renombra cabeceras. |
| `auth` | **Credential** | Indica que un bearer token, autenticación básica o una clave de API va en la petición, y nombra el slot del que sale. |

### `filter` {#step-filter}

Mantiene la petición solo si coincide; si no, la ejecución responde `dropped`. Con `"action": "drop"` funciona al revés: lo que coincide se descarta.

```json
{ "filter": { "data": { "status": "paid", "amount": { "$gte": 100000 } } }, "note": "Paid, $1,000 or more" }
```

- Cada clave es una condición, y todas deben cumplirse. Un objeto anidado se compara por su forma, como `data` aquí.
- Un valor simple coincide por igualdad JSON: `1` es igual a `1.0`.
- Un array coincide si es igual al valor o si alguno de sus elementos coincide: `{"data": {"tags": "urgent"}}` se cumple para `["billing", "urgent"]`, y `{"data": {"items": {"sku": "A-1", "qty": 2}}}` necesita un elemento que tenga ambos.
- Un campo que la petición no tiene solo coincide con `{"$exists": false}` y con las negaciones, como `$neq`.
- Los operadores son `$eq`, `$neq`, `$gt`, `$gte`, `$lt`, `$lte` (números con números, texto con texto; las marcas de tiempo ISO se ordenan por tiempo), `$in`, `$nin`, `$exists`, `$startsWith`, `$endsWith`, `$contains` (texto, o un array que contiene el valor), y `$and`, `$or` y `$not` para combinar filtros.
- `$headers`, `$meta` y `$body` comprueban esa parte de la petición: `{"$headers": {"x-github-event": "push"}}`.

### `drop` {#step-drop}

Quita campos del cuerpo: una lista de 1 a 50 rutas. `*` equivale a un nivel cualquiera y `**` a cualquier profundidad, así que `**.email` quita todos los campos `email`, estén donde estén. Una ruta que no coincide con nada no es un error.

```json
{ "drop": ["data.customer.email", "data.cards[*].number", "**.phone"] }
```

### `set` {#step-set}

Añade o sobrescribe campos: de 1 a 50 pares de una ruta y un [valor](#values). Crea por el camino los objetos que falten, y cada valor lee el cuerpo tal como lo encontró el paso. Una ruta que se topa con un valor que no es un objeto hace fallar la ejecución con `set_conflict`.

```json
{ "set": { "event_type": "{{ type }}", "data.total_cents": { "$ref": "data.amount" } } }
```

### `map` {#step-map}

Sustituye el cuerpo por un [valor](#values) que escribes tú, normalmente un objeto.

```json
{ "map": {
    "invoice_id": "{{ data.id }}",
    "amount": { "$ref": "data.amount" },
    "amount_display": "{{ data.amount | money(data.currency) }}",
    "event": "{{ type }}"
} }
```

Con una petición `invoice.paid` cuyo `data` es `{"id": "in_42", "amount": 150000, "currency": "usd"}`, el cuerpo pasa a ser:

```json
{ "invoice_id": "in_42", "amount": 150000, "amount_display": "1,500.00 USD", "event": "invoice.paid" }
```

### `headers` {#step-headers}

Pone cabeceras con `set`, las quita con `remove` y las renombra con `rename`, en este orden: remove, rename, set. Los nombres coinciden sin importar mayúsculas y minúsculas, y un nombre que se pone sustituye a todas sus grafías.

```json
{ "headers": { "set": { "X-Event-Type": "{{ type }}", "Content-Type": "application/json" } } }
```

Un paso de cabeceras no puede poner una cabecera que pertenezca a la conexión, como `Host` o `Content-Length`, ni `Set-Cookie`. Tampoco puede poner `Authorization`, `Cookie` ni `X-Api-Key`, porque el valor quedaría en el documento, que devuelve cada lectura: una credencial va en un paso `auth`. Un producto que ejecuta la pipeline por referencia también le aplica sus propias reglas de cabeceras.

### `auth` {#step-auth}

Indica que una credencial va en la petición, y nombra el slot del que sale:

| `type` | Añade |
|---|---|
| `bearer` | `Authorization: Bearer` y la credencial. |
| `basic` | `Authorization: Basic`, a partir de un `username` y de la credencial como contraseña. |
| `api_key`, `"in": "header"` | La credencial en la cabecera llamada `name`, tras un `prefix` opcional como `"Token "`. |
| `api_key`, `"in": "query"` | La credencial como parámetro de consulta `name`, en la URL del destino. |

```json
{ "auth": { "type": "api_key", "in": "header", "name": "X-Api-Key", "secret": "sec_…" } }
```

`secret` es el id de un [slot](/docs/product-transforms/reference#slots) del workspace. Nunca es un valor: un valor pegado ahí se rechaza con `invalid_secret`, y el rechazo no lo repite. El producto que ejecuta la pipeline por referencia asigna el slot a un secreto propio ([Credenciales](/docs/product-transforms#credentials)). Test y la API de ejecución muestran la cabecera o el parámetro con el valor enmascarado.

Los pasos `auth` van después de todos los demás, así que ningún paso puede leer, copiar ni comprobar una credencial.

## Rutas y valores {#values}

Una ruta nombra un campo del cuerpo:

| Ruta | Nombra |
|---|---|
| `data.customer.email` | Un campo. |
| `data.items[0].sku` | Un elemento de una lista. |
| `data['first name']` | Una clave que contiene un espacio, un punto o un corchete. |
| `data.items[*].sku` | Cada elemento; en un valor, la lista de todos ellos. |
| `**.email` | `email` a cualquier profundidad; solo en un `drop`. |
| `$meta.source`, `$headers.x-name`, `$body.data` | Los metadatos de la petición, una de sus cabeceras o su cuerpo; solo en un valor. |

`set` acepta rutas simples, `drop` acepta `*` y `**`, y un valor lee con `*` pero no con `**`.

Un valor en `set`, `map` o una cabecera es JSON y se copia tal como está escrito, salvo dos cosas:

- **`{{ path }}`** dentro de una cadena inserta un valor como texto. Un valor que falta o `null` no inserta nada, y un objeto o una lista se insertan como JSON. `{{ 'text' }}` y `{{ 42 }}` son literales, así que un `{{` literal se escribe `{{ '{{' }}`.
- **`{"$ref": "path"}`** inserta el valor tal cual y conserva su tipo: un número sigue siendo un número, y una lista, una lista. Añade `"default"` para cuando falte la ruta.

Una expresión puede pasar su valor por filtros, de izquierda a derecha: `{{ data.amount | money(data.currency) }}` da `1,500.00 USD` para un importe de 150000 en `usd`.

| Filtro | Da |
|---|---|
| `upper`, `lower` | El texto en mayúsculas o en minúsculas. |
| `default(x)` | `x` cuando el valor falta, es `null` o está vacío. |
| `truncate(n)` | Como máximo `n` caracteres, seguidos de `…`. |
| `join(sep)` | Una lista como texto, unida con `", "` salvo que indiques `sep`. |
| `length` | El número de elementos, claves o caracteres. |
| `json`, `json(indent)` | El valor como JSON compacto, o sangrado con 1 a 8 espacios. |
| `number(digits)` | Un número con esa cantidad de decimales. |
| `money(currency)` | Un importe en unidades menores, con formato; incluye las monedas sin decimales y las de tres. |
| `date(format)` | Una fecha ISO 8601 o segundos epoch, en UTC, con `%Y`, `%m`, `%d`, `%H`, `%M`, `%S` y otros. |
| `escape(target)` | Texto que no puede dar formato a un mensaje de chat: `slack` (por defecto), `discord` o `markdown`. |
| `code(target, max, language)` | Texto como bloque de código en el marcado de `slack`, `discord` o `markdown`, que el texto no puede cerrar antes de tiempo, ajustado a `max` caracteres. |

No hay bucles, condiciones ni operaciones aritméticas: una condición es un paso `filter`, y una lista se convierte en texto con `[*]` y `join`.

## Plantillas {#templates}

La galería reúne pipelines ya hechas para empezar. En la consola están en **Start from a template**. Por la API, `GET /v1/pipelines/templates` devuelve cada una con su `pipeline`. Al guardar una, obtienes una pipeline que es tuya: cámbiala como cualquier otra; nada la vincula ya a la plantilla.

| `id` | Plantilla | Qué envía |
|---|---|---|
| `slack` | **Slack message** | Para un incoming webhook de Slack: el tipo del evento como encabezado, su id y su hora, y sus datos en un bloque de código. |
| `discord` | **Discord message** | Para el webhook de un canal de Discord: un embed con el tipo del evento, sus datos en un bloque de código, y su id y su hora. No menciona a nadie. |
| `teams` | **Microsoft Teams card** | Para el webhook de un flujo de trabajo de Teams: una Adaptive Card con el tipo del evento, su id y su hora, y sus datos en monoespaciado. |
| `keep_fields` | **Keep only these fields** | El `id`, `type`, `created_at` y `version` del evento, y solo los campos de `data` que lista su `map`, empezando por `data.id`. Un campo de la lista que el evento no tiene se envía como `null`. |
| `drop_personal` | **Drop personal data** | El evento sin `email`, `phone`, `first_name`, `last_name`, `address`, `billing_address`, `shipping_address`, `date_of_birth` ni `ip_address`, a cualquier profundidad. Un `name` a secas se queda, porque a menudo nombra un plan o un producto. |

Cada plantilla de chat es un paso `map` y un paso `headers` que pone `Content-Type: application/json`, y funciona con cualquier evento. Un tipo que falta aparece como "Event" y un id o una hora que faltan, como "—"; los datos se recortan para caber en los límites de la app, y nada del evento puede dar formato al mensaje, mencionar a nadie ni cerrar antes de tiempo el bloque de código.

## Límites {#limits}

Una pipeline no tiene bucles, ni reloj, ni red, y unos límites fijos acotan cada ejecución. Al superar uno, la ejecución responde `failed` con el motivo, y un documento que supere uno se rechaza al guardarlo.

| Qué | Límite | Se rechaza como |
|---|---|---|
| Un documento, como JSON compacto | 64 KiB | `too_large` |
| Pasos | 20 | `too_many_steps` |
| Rutas en un `drop`, campos en un `set`, nombres en cada parte de un paso `headers` | 50 | `invalid_value` |
| La configuración de un paso, como JSON compacto | 16 KiB | `too_large` |
| La nota de un paso | 200 caracteres | `invalid_value` |
| Anidamiento, en un paso y en un cuerpo | 32 niveles | `too_deep`, `input_too_deep` |
| El cuerpo que lee un paso | 256 KiB | `input_too_large` |
| El cuerpo con el que responde una ejecución | 256 KiB | `output_too_large` |
| Un valor que genera un paso | 64 KiB | `value_too_large` |
| Trabajo en una ejecución | 100,000 valores leídos o copiados; el texto cuenta uno por KiB | `too_many_nodes` |
| Cabeceras al final de una ejecución | 50 | `too_many_headers` |
| Un valor de cabecera | 8 KiB | `header_too_large` |

El playground tiene límites más bajos: un documento de 16 KiB, un cuerpo de 32 KiB y 10,000 valores leídos o copiados en una ejecución.

## Próximos pasos {#next-steps}

- [Inicio rápido](/docs/product-transforms/quickstart) — prueba una pipeline, guárdala y ejecútala.
- [Referencia de Transforms](/docs/product-transforms/reference) — todas las rutas y campos, y qué significa cada rechazo.
- [Transformaciones en Webhooks](/docs/product-webhooks/transformations) — el mismo lenguaje en un endpoint de Webhooks.
