---
title: "Transformaciones"
description: "Filtra, recorta, adapta o añade credenciales a cada entrega antes de que se firme y se envíe: con una pipeline de pasos declarativos en todos los planes o con un script de JavaScript en los planes de pago."
publishedAt: 2026-10-30
updatedAt: 2026-11-06
kind: concept
---

# Transformaciones

Una transformación cambia lo que recibe un endpoint: se ejecuta con cada evento antes de que lo entreguemos y envía en su lugar una petición adaptada, o nada en absoluto. Es una **pipeline** de pasos declarativos, en todos los planes, o un **script** de JavaScript, en los planes de pago; lo que produce se firma con el secreto del endpoint y se envía como cualquier otra entrega.

## Para qué sirve {#what-for}

- **Un receptor que pide credenciales.** Tu propia API, o la de un socio, espera un bearer token, autenticación básica o una clave de API. Una pipeline las añade desde un [secreto](#credentials) que guardamos cifrado y que no volvemos a mostrar.
- **Un receptor que quiere su propio formato.** Slack, Discord y Microsoft Teams solo aceptan sus propios formatos de mensaje y rechazan nuestro sobre; un CRM quiere tres campos, con sus propios nombres. Una [plantilla](#templates) o un paso `map` construye ese cuerpo.
- **Solo algunos eventos.** Una [suscripción](/docs/product-webhooks#objects) solo coincide por el tipo de evento. "Solo los `invoice.paid` de $1.000 o más" necesita el payload, y un paso `filter` lo lee.
- **Menos datos, o algunos más.** Quita los datos personales antes de que los vea un proveedor de analítica, o añade el tipo de evento al cuerpo o a una cabecera.

## Pipelines y scripts {#kinds}

| | Pipeline | Script |
|---|---|---|
| Qué escribes | Hasta 20 pasos, en el formulario de la consola o como JSON | Una función de JavaScript |
| Planes | Todos, Free incluido | Starter, Pro y Custom |
| Dónde se ejecuta | Junto a la entrega, con límites fijos; no se ejecuta código tuyo | En un sandbox propio, con un presupuesto de CPU, memoria y tiempo |
| Sirve para | Credenciales, filtros, quitar y añadir campos, adaptar el formato, mensajes de chat | Lógica que los pasos no pueden expresar |

Una transformación es una cosa u otra, y su tipo queda fijado al crearla. Un endpoint ejecuta como máximo una transformación; una misma transformación puede servir a varios endpoints de su proyecto. Una pipeline también puede [guardarse en Transforms](#reference) y ejecutarse aquí por referencia.

En Free, crear o probar un script se rechaza con `402 not_entitled`. Un workspace que deja su plan de pago conserva sus scripts y todavía puede renombrarlos, pausarlos, desvincularlos y borrarlos, pero no guardar código nuevo, ni probar ni reanudar ninguno; las entregas a un endpoint que ejecuta uno esperan hasta que el plan vuelva a incluir scripts o hasta que lo desvincules. Las pipelines siguen ejecutándose en cualquier plan.

Los scripts dependen de un servicio sandbox propio; las pipelines no. Mientras los scripts están desactivados, la consola lo indica, `GET /v1/plan` devuelve `transformations_available: false` y las entregas a un endpoint que ejecuta un script esperan. Si el sandbox no puede aceptar un script en un momento dado, guardar o probar uno responde `503 unavailable` y no guarda nada, y el intento de una entrega falla con un mensaje que lo indica y se reintenta según el calendario habitual.

`GET /v1/plan` también indica qué incluye tu plan: `pipelines` es `true` en todos los planes, y `transformations` es `true` cuando incluye scripts. Las ejecuciones de ambos tipos se cuentan, pero no se facturan; `transformation_runs` es el recuento de este mes.

## Una pipeline {#pipeline}

Una pipeline es un documento JSON. Esta envía las facturas pagadas de $1.000 o más, sin el email del cliente ni ningún número de teléfono, con el tipo de evento añadido al cuerpo y un bearer token sacado de un secreto guardado:

```json
{
  "version": 1,
  "steps": [
    { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
    { "drop": ["data.customer.email", "**.phone"] },
    { "set": { "event_type": "{{ type }}" } },
    { "auth": { "type": "bearer", "secret": "sec_…" } }
  ]
}
```

`version` es el formato del documento, siempre `1`; no es la versión de la transformación. Los pasos se ejecutan en el orden en que están escritos. Cada uno es un objeto con una clave de paso y, opcionalmente, una `note` de hasta 200 caracteres, que la consola muestra en el paso y que queda registrada en la entrega que un filtro descarta. Un `filter` también puede llevar una `action`.

El primer paso ve el sobre que enviaríamos si no, con su `id`, `type`, `created_at`, `data` y `version`, y cada paso siguiente ve el cuerpo tal como lo dejó el anterior. Si ningún paso cambia el cuerpo, el receptor recibe los bytes originales del evento. Los pasos se numeran desde 0 en la API y en los textos de error, y desde 1 en el editor de la consola.

| Paso | En la consola | Qué hace |
|---|---|---|
| `filter` | **Filter** | Envía el evento solo si coincide o, con `"action": "drop"`, lo descarta si coincide. |
| `drop` | **Remove fields** | Quita campos del cuerpo. |
| `set` | **Set fields** | Añade o sobrescribe campos. |
| `map` | **Reshape the body** | Sustituye el cuerpo por uno que construyes tú. |
| `headers` | **Headers** | Pone, quita o renombra cabeceras. |
| `auth` | **Credential** | Añade un bearer token, autenticación básica o una clave de API desde un secreto guardado. |

### `filter` {#step-filter}

Mantiene la entrega solo si el evento coincide; si no, la entrega se [descarta](#dropped) y no se envía nada. Con `"action": "drop"` funciona al revés: lo que coincide se descarta.

```json
{ "filter": { "data": { "status": "paid", "amount": { "$gte": 100000 } } }, "note": "Paid, $1,000 or more" }
```

- Cada clave es una condición, y todas deben cumplirse. Un objeto anidado se compara por su forma, como `data` aquí.
- Un valor simple coincide por igualdad JSON: `1` es igual a `1.0`.
- Un array coincide si es igual al valor o si alguno de sus elementos coincide: `{"data": {"tags": "urgent"}}` se cumple para `["billing", "urgent"]`, y `{"data": {"items": {"sku": "A-1", "qty": 2}}}` necesita un elemento que tenga ambos.
- Un campo que el evento no tiene solo coincide con `{"$exists": false}` y con las negaciones, como `$neq`.
- Los operadores son `$eq`, `$neq`, `$gt`, `$gte`, `$lt`, `$lte` (números con números, texto con texto; las marcas de tiempo ISO se ordenan por tiempo), `$in`, `$nin`, `$exists`, `$startsWith`, `$endsWith`, `$contains` (texto, o un array que contiene el valor), y `$and`, `$or` y `$not` para combinar filtros.
- `$meta` comprueba a dónde va la entrega: `{"$meta": {"endpoint": {"id": "ep_3f9a…"}}}`.

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

Con un evento `invoice.paid` cuyo `data` es `{"id": "in_42", "amount": 150000, "currency": "usd"}`, envía:

```json
{ "invoice_id": "in_42", "amount": 150000, "amount_display": "1,500.00 USD", "event": "invoice.paid" }
```

### `headers` {#step-headers}

Pone cabeceras con `set`, las quita con `remove` y las renombra con `rename`, en este orden: remove, rename, set. Los nombres coinciden sin importar mayúsculas y minúsculas. Una pipeline empieza sin cabeceras propias: las cabeceras personalizadas del endpoint y las nuestras se añaden después de que se ejecute, una cabecera que pone sustituye a una personalizada con el mismo nombre, y `remove` y `rename` solo alcanzan las cabeceras que hayan puesto los pasos anteriores.

```json
{ "headers": { "set": { "X-Event-Type": "{{ type }}", "Content-Type": "application/json" } } }
```

Una pipeline no puede poner una cabecera que enviamos nosotros, es decir, ninguna `X-Webhook-*`, la firma incluida, ni `User-Agent`; tampoco una que pertenezca a la conexión, como `Host`, `Content-Length` o `Expect`. `Content-Type` sí puede ponerla, y pasa a ser el tipo de contenido de la entrega. Sin ella, la entrega sale como `application/json`.

### `auth` {#step-auth}

Añade credenciales desde un [secreto guardado](#credentials), indicado por su id:

| `type` | Añade |
|---|---|
| `bearer` | `Authorization: Bearer` y el secreto. |
| `basic` | `Authorization: Basic`, a partir de un `username` y del secreto como contraseña. |
| `api_key`, `"in": "header"` | El secreto en la cabecera llamada `name`, tras un `prefix` opcional como `"Token "`. |
| `api_key`, `"in": "query"` | El secreto como parámetro de consulta `name`, en la URL del endpoint y solo para esa petición. |

```json
{ "auth": { "type": "api_key", "in": "header", "name": "X-Api-Key", "secret": "sec_…" } }
```

Los pasos `auth` van después de todos los demás, así que ningún paso puede leer, copiar ni comprobar las credenciales.

## Rutas y valores {#values}

Una ruta nombra un campo del cuerpo:

| Ruta | Nombra |
|---|---|
| `data.customer.email` | Un campo. |
| `data.items[0].sku` | Un elemento de una lista. |
| `data['first name']` | Una clave que contiene un espacio, un punto o un corchete. |
| `data.items[*].sku` | Cada elemento; en un valor, la lista de todos ellos. |
| `**.email` | `email` a cualquier profundidad; solo en un `drop`. |
| `$meta.endpoint.id` | El endpoint al que va la entrega, y `$meta.endpoint.description` su descripción; solo en un valor. |

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

La galería reúne pipelines ya hechas para empezar. En la consola están en **Start from a template**, debajo de los pasos: **Use Slack message**, o el botón de cualquier otra, pone los pasos de esa plantilla en el editor, tras preguntarte si sustituirían a los tuyos. Por la API, `GET /v1/transformations/templates` devuelve cada una con su `pipeline`.

| Plantilla | Qué envía |
|---|---|
| **Slack message** | Para un incoming webhook de Slack: el tipo del evento como encabezado, su id y su hora, y sus datos en un bloque de código. |
| **Discord message** | Para el webhook de un canal de Discord: un embed con el tipo del evento, sus datos en un bloque de código, y su id y su hora. No menciona a nadie. |
| **Microsoft Teams card** | Para el webhook de un flujo de trabajo de Teams: una Adaptive Card con el tipo del evento, su id y su hora, y sus datos en monoespaciado. |
| **Keep only these fields** | El `id`, `type`, `created_at` y `version` del evento, y solo los campos de `data` que lista su `map`, empezando por `data.id`. Un campo de la lista que el evento no tiene se envía como `null`. |
| **Drop personal data** | El evento sin `email`, `phone`, `first_name`, `last_name`, `address`, `billing_address`, `shipping_address`, `date_of_birth` ni `ip_address`, a cualquier profundidad. Un `name` a secas se queda, porque a menudo nombra un plan o un producto. |

Al guardar una, obtienes una pipeline que es tuya: cámbiala como cualquier otra; nada la vincula ya a la plantilla. Cada plantilla de chat es un paso `map` y un paso `headers` que pone `Content-Type: application/json`, y funciona con cualquier evento. Un tipo que falta aparece como "Event" y un id o una hora que faltan, como "—"; los datos se recortan para caber en los límites de la app, y nada del evento puede dar formato al mensaje, mencionar a nadie ni cerrar antes de tiempo el bloque de código.

Slack, Discord y Teams no pueden responder al [desafío de verificación](/docs/product-webhooks/endpoint-verification#cannot-echo), así que un endpoint que apunta a uno de ellos necesita la verificación desactivada en su proyecto, algo que los planes de pago permiten.

**Los presets ahora son plantillas.** Un endpoint que ya ejecuta un preset, que es un script, lo sigue ejecutando tal cual, y solo un endpoint así sigue ofreciendo **Preset** entre sus opciones. La plantilla del mismo nombre hace lo mismo sin script, en todos los planes.

## Credenciales {#credentials}

Un paso `auth` indica un secreto por su id (`sec_…`), nunca por su valor. Un secreto pertenece a un proyecto, como una transformación, y solo las pipelines de ese proyecto pueden usarlo. Su valor se guarda cifrado y nunca se devuelve: la API lista los secretos por nombre e id, una pipeline leída de nuevo solo lleva el id, una prueba muestra las credenciales como `••••`, y una entrega solo guarda los nombres de las cabeceras y los parámetros de consulta que añadió.

En la consola, **Secret**, dentro de un paso **Credential**, lista los secretos del proyecto. Para guardar uno nuevo, elige **New secret…**, rellena **Secret name** y **Secret value** y pulsa **Save secret**.

Por la API, con el valor leído de una variable de entorno:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/secrets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": \"prj_…\", \"name\": \"CRM token\", \"value\": \"$CRM_TOKEN\"}"
```

```json
{ "id": "sec_…", "project_id": "prj_…", "name": "CRM token", "transformation_count": 0, "created_at": "…", "updated_at": "…" }
```

`PATCH /v1/secrets/{id}` renombra un secreto o sustituye su valor; todas las pipelines que lo usan envían el valor nuevo desde el siguiente intento, también en los reintentos de entregas anteriores. `DELETE /v1/secrets/{id}` se rechaza con `409 secret_in_use` mientras la versión actual de una pipeline use el secreto. La consola solo crea secretos; para renombrarlos, sustituirlos o borrarlos, usa la API.

## Scripts {#script}

Un script es una sola función llamada `transform`, en Starter, Pro y Custom:

```js
function transform(event, context) {
  // event:   { id, type, created_at, data, version }, the envelope we would otherwise send
  // context: { endpoint: { id, description }, attempt }
  if (event.type !== "invoice.paid") return null; // send nothing
  return {
    body: { text: `Invoice ${event.data.id} paid` },
    headers: { "X-Team": "billing" },
  };
}
```

Devuelve la petición que hay que enviar, o `null` para no enviar nada. Un `body` que es un objeto o una lista se envía como JSON; una cadena se envía tal cual, como `text/plain; charset=utf-8`. `contentType` fija otro tipo de contenido, en lugar de una cabecera `Content-Type`, y `headers` añade cabeceras sujetas a las reglas de las cabeceras personalizadas de un endpoint. La URL y el método siguen siendo los del endpoint. Lo que el script escriba con `console.log` se guarda con la entrega, hasta 4 KiB.

El script es JavaScript estándar en un solo archivo, sin red, sin sistema de archivos, sin temporizadores y sin imports, así que una biblioteca que necesite tiene que ir empaquetada dentro. Al guardarlo, primero lo cargamos en el sandbox sin llamarlo: un error de sintaxis, la falta de una función `transform` o un código de nivel superior que falla se rechazan con `422 invalid_transformation`, y no se guarda nada.

## Pruebas {#test}

**Test**, debajo del editor, ejecuta lo que hay en el editor, esté guardado o no, con **A recent event** de las últimas entregas del endpoint o con **An event you paste**. Pulsa **Run test**: no se envía ni se guarda nada. Una pipeline se ejecuta con los secretos de su proyecto, y la respuesta muestra cada credencial como `••••`. El resultado es uno de estos:

- **Would send**: el tipo de contenido, el tamaño, las cabeceras y el cuerpo que recibiría el receptor.
- **Would send nothing**: un filtro la descartó, en el paso indicado, o el script devolvió `null`.
- **Failed**: por qué y, si es una pipeline, en qué paso.

Por la API, envía la pipeline, o el `code` de un script, junto con un evento:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations/test \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "prj_…",
       "pipeline": {"version": 1, "steps": [
         {"map": {"text": "{{ type }}: {{ data.id }}"}},
         {"auth": {"type": "bearer", "secret": "sec_…"}}]},
       "event": {"id": "evt_1", "type": "invoice.paid", "created_at": "2026-11-03T10:00:00Z", "data": {"id": "in_42"}, "version": "1"}}'
```

```json
{ "status": "ok", "body": "{\"text\":\"invoice.paid: in_42\"}", "content_type": null, "headers": { "Authorization": "Bearer ••••" }, "logs": "", "reason": null, "error": null, "fuel": 0, "duration_ms": 0.2, "query": {}, "step": null }
```

`status` es `ok`, `dropped` o `failed`. Si se descarta o falla, `step` es el paso, contado desde 0; `reason` es la palabra clave, como `no_match` (o `matched`, para un filtro con `"action": "drop"`) o `set_conflict`; y `error` lo explica con palabras, con la nota del filtro si se descartó. `content_type` es `null` salvo que un paso lo haya fijado. Una prueba que descarta o falla sigue dando un `200`, pero una pipeline que nunca podría ejecutarse se rechaza con `422 invalid_pipeline`, igual que al guardarla.

Probar una pipeline funciona en todos los planes. Probar un script necesita un plan con scripts, comparte con el guardado de scripts un cupo de 60 por minuto por workspace, con ráfagas de 10, y además devuelve los `logs` y el `fuel` del script.

El **Send test ping** de un endpoint envía su ping fijo sin la transformación, y por tanto sin las credenciales de una pipeline: un receptor que las comprueba lo rechaza. **Test**, o un evento real, muestra lo que recibirá tu receptor.

## Versiones y pausa {#versions}

Guardar una pipeline o un script con cambios crea su siguiente versión; guardar uno idéntico a la versión actual no crea ninguna. Se guardan las últimas 50 versiones, y cada entrega registra la versión que le dio forma. En la consola, **Versions** las lista, y **Load into editor** carga una anterior en el editor; al guardarla, pasa a ser la versión más reciente. Por la API, `GET /v1/transformations/{id}/versions` las lista, de la más reciente a la más antigua, y `GET /v1/transformations/{id}/versions/{version}` devuelve una con su pipeline o su código.

**Pause** detiene una transformación sin desvincularla, igual que `PATCH /v1/transformations/{id}` con `{"status": "disabled"}`. Las entregas de sus endpoints esperan en lugar de salir sin transformar: aparecen como `failed`, con el `last_error` "paused: the endpoint's transformation is not running", y salen cuando la reanudas con **Resume** (`{"status": "enabled"}`), con la versión que sea la actual en ese momento. Pausar y reanudar una pipeline funciona en cualquier plan.

## Cómo vincularla a un endpoint {#set-up}

En la consola, abre el menú del endpoint en la página **Endpoints** y elige **Transformation**, o haz clic en su entrada de la columna **Transformation**. Después:

1. Elige **Pipeline** y constrúyela: con **Add a step**, partiendo de una plantilla, o pegando un documento entero en **JSON** y pulsando **Apply JSON**. O elige **Script** y escribe la función.
2. [Pruébala](#test).
3. Pulsa **Save**. Las siguientes entregas del endpoint pasan por ella.

**Off** y **Save** la desactivan tras una confirmación, y las entregas vuelven a salir como el sobre del evento. Si ningún otro endpoint la ejecuta, la transformación se borra con sus versiones. Como el tipo no puede cambiar, pasar un endpoint de un script a una pipeline, o al revés, guarda una transformación nueva en lugar de la anterior, y borra la anterior si ningún otro endpoint la ejecuta. Cuando una transformación se ejecuta en varios endpoints, guardarla la cambia para todos.

Por la API, crea la transformación en el proyecto del endpoint y después apunta el endpoint a ella:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Paid invoices to the CRM", "project_id": "prj_…",
       "pipeline": {"version": 1, "steps": [
         {"filter": {"type": "invoice.paid"}, "note": "Paid invoices only"},
         {"drop": ["**.email"]},
         {"auth": {"type": "bearer", "secret": "sec_…"}}]}}'

curl -sX PATCH {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a… \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"transformation_id": "trf_…"}'
```

Un script lleva `code` en lugar de `pipeline`; enviar las dos cosas, o ninguna, se rechaza. Para cambiar el documento más adelante, usa `PATCH /v1/transformations/{id}` con una `pipeline` nueva. Si la versión nueva tiene un paso `auth` y hay endpoints que ejecutan la transformación, el `PATCH` también debe llevar `confirm_destinations`: la URL de cada uno de esos endpoints, tal como los lista `destinations` de la transformación, porque las credenciales van a todos. `POST /v1/endpoints` también acepta `transformation_id`, `{"transformation_id": null}` la desvincula, y una transformación de otro proyecto se rechaza como no encontrada. Crear, cambiar y probar transformaciones y secretos requiere una clave `admin`; una clave `read` puede listarlos y leerlos. Una persona, a diferencia de una clave, también necesita el rol de propietario o de administrador para guardar o cambiar un secreto, para guardar una pipeline cuyo paso `auth` hace referencia a uno o para vincular una pipeline así a un endpoint.

## Una pipeline guardada en Transforms {#reference}

Una transformación puede ejecutar una pipeline guardada en [Transforms](/docs/product-transforms) en lugar de tener la suya. Su tipo es `reference`, en todos los planes, y guardamos qué pipeline nombra, no una copia. La pipeline se sigue ejecutando aquí, junto a la entrega, y Transforms no participa en el envío. Las ejecuciones también cuentan aquí, en `transformation_runs`. Las [pruebas](#test), la [pausa](#versions), [lo que muestra una entrega](#deliveries) y el [recuento de fallos](#failures) funcionan como en cualquier pipeline.

La consola no ofrece este tipo. Crea una por la API, en el proyecto del endpoint, y después [apunta el endpoint a ella](#set-up) con `transformation_id`:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Paid invoices to the CRM", "project_id": "prj_…",
       "pipeline_ref": {"id": "pipe_…", "secrets": {"sec_1f0a…": "sec_9c4e…"}}}'
```

| Campo de `pipeline_ref` | Qué es |
|---|---|
| `id` | El `id` de la pipeline en Transforms, que debe ser de este workspace. |
| `version` | Una versión que fijar. Sin ella sigue la versión actual, y una nueva llega a las entregas en menos de un minuto. |
| `secrets` | Hasta 20 pares: el id de un [slot](/docs/product-transforms#credentials) que nombra la pipeline y, después, el id de un [secreto](#credentials) de este proyecto. Cada slot que nombra la versión necesita uno, y una pipeline sin paso `auth` no necesita ninguno. |

Transforms no guarda credenciales, así que vienen de esta asignación: cada paso `auth` se ejecuta con el secreto de este proyecto en lugar de su slot. Una referencia que asigna un secreto sigue las reglas de un paso `auth`: una persona necesita el rol de propietario o de administrador para guardarla, una versión nueva debe nombrar todos los endpoints en `confirm_destinations`, y el secreto no se puede borrar mientras la referencia lo asigne. Una pipeline en Transforms es de todo el workspace, así que elegirla requiere una clave o un inicio de sesión que alcance todo el workspace. Una clave o un inicio de sesión limitados a ciertos proyectos se rechazan con `403` `project_confined`, aunque pueden seguir leyendo, renombrando y vinculando lo que ya está guardado.

Para cambiar la pipeline, la versión o los secretos, envía `PATCH /v1/transformations/{id}` con un `pipeline_ref` nuevo, que guarda la siguiente versión de la transformación. Una versión nueva en Transforms no necesita ningún `PATCH`, salvo que la referencia fije una. Para probarla, envía `pipeline_ref` en lugar de `pipeline` a `POST /v1/transformations/test`: ejecuta lo que la referencia ejecuta ahora, con cada credencial enmascarada, incluso mientras la pipeline está desactivada en Transforms. Para una entrega, `GET /v1/deliveries/{id}/transform` añade `pipeline_version`, la versión de la pipeline que se ejecutó, junto a `version`, la de la transformación.

Un evento nunca se envía sin transformar. Cuando la pipeline no puede ejecutarse:

| Qué ha pasado | Qué hace la entrega |
|---|---|
| No se puede contactar con Transforms | Una versión ya obtenida se sigue ejecutando. Sin nada en qué basarse, la entrega espera sin gastar ningún intento y vuelve a mirar cada 5 minutos. Aparece como `failed`, con un `last_error` que empieza por `paused:`. |
| La pipeline está desactivada en Transforms | En menos de un minuto, fije o no la referencia una versión, las entregas esperan de la misma forma, y salen cuando se vuelve a activar. |
| Se ha borrado la pipeline | La entrega falla con `pipeline_failed: reference_missing: …` y va a la cola dead-letter. |
| Una versión más reciente nombra un slot que la referencia no asigna | La entrega falla igual con `secret_missing`, que nombra el slot. Asígnalo con un `PATCH`. |
| Una versión más reciente contiene algo que rechazamos, como una cabecera que enviamos nosotros | La entrega falla igual, con el motivo, como `managed_header`. Guardar en Transforms no comprueba nuestras reglas de cabeceras. |

Cada fallo cuenta en contra de la transformación, como en cualquier pipeline ([Cuando una ejecución falla](#failures)). Transforms lista `webhookd` entre los servicios que ejecutan una pipeline, y para guardar una versión nueva con un paso `auth`, o para borrar la pipeline, hay que nombrarlo antes ([Quién ejecuta una pipeline](/docs/product-transforms/reference#destinations)).

## Qué muestra una entrega {#deliveries}

Una transformación se ejecuta una vez por entrega, en su primer intento. Lo que produjo se guarda con la entrega, y cada reintento vuelve a enviar ese mismo cuerpo, firmado de nuevo, con las cabeceras del endpoint tal como estén en ese intento. Las credenciales de una pipeline nunca se guardan: cada intento las vuelve a añadir con el valor que tenga el secreto en ese momento. [Volver a entregarla](/docs/product-webhooks/deliveries#replay) ejecuta de nuevo la versión actual de la transformación.

En la consola, abre una entrega en la página **Deliveries**. **Transformed by** nombra la transformación y la versión que se ejecutó, y el resultado es uno de estos:

- **Transformed**: el tipo de contenido, el tamaño, las cabeceras que puso, los nombres de las credenciales que añadió y el cuerpo que se envió.
- **Dropped**: un filtro descartó la entrega, o el script devolvió `null`, así que no se envió nada.
- **Failed**: por qué falló la ejecución. La entrega está en la cola dead-letter.

Por la API, `GET /v1/deliveries/{id}/transform` devuelve la ejecución, o `null` si no se ejecutó ninguna: `transformation_id`, `version`, `status` (`ok`, `dropped` o `failed`), `reason`, `error`, `body`, `content_type`, `header_names`, `credential_headers` y `credential_query` (nombres, nunca valores) y `duration_ms`. La ejecución de un script también tiene `logs` y `fuel`.

### Entregas descartadas {#dropped}

Cuando un filtro descarta una entrega, o un script devuelve `null`, no se envía nada y no se hace ningún intento. La entrega queda como `sent` con `"dropped": true`, la consola la muestra como **dropped**, y las estadísticas del endpoint y del workspace la cuentan aparte de las entregadas: la tasa de éxito se calcula sobre lo que debía enviarse. Descartar no es fallar, ni para el endpoint ni para la transformación. Una entrega descartada tampoco cuenta para la [cuota mensual de entregas](/docs/product-webhooks#objects): la cuota cuenta cada entrega cuando se publica su evento, antes de que se ejecute un filtro o un script, y deja de contarla cuando se descarta. Por eso, con la cuota agotada, una publicación se sigue rechazando, aunque un filtro fuera a descartar todas sus entregas.

## Cuando una ejecución falla {#failures}

Una pipeline que se pudo guardar puede fallar igualmente con un evento concreto: un `set` que escribiría dentro de un valor que no es un objeto (`set_conflict`), un cuerpo o un valor que supera su [límite](#limits), un valor que una cabecera no puede llevar, o unas credenciales cuyo secreto ya no existe (`secret_missing`) o no se puede enviar (`invalid_secret`). La misma pipeline falla igual con el mismo evento, así que la entrega va directamente a la cola dead-letter, sin enviarse, con un `last_error` como `pipeline_failed: step 2: set_conflict: …`.

Un script falla cuando lanza una excepción, se queda sin tiempo o sin memoria, entra en una recursión demasiado profunda o devuelve algo que no es una petición (un objeto con `body`, o `null`). Su entrega va a la cola dead-letter con un `last_error` que empieza por `transform_failed:`.

Nunca enviamos en su lugar el evento sin transformar: el receptor puede ser un tercero, y la transformación puede estar ahí precisamente para ocultarle datos.

Cada ejecución fallida cuenta en contra de la transformación, igual que las entregas fallidas cuentan en contra de un endpoint, y una ejecución que envía o descarta corta la racha. Tras 20 fallos seguidos, la transformación se desactiva (**turned off after failures** en la consola, `auto_disabled` en la API), las entregas de sus endpoints quedan a la espera, y enviamos un email al propietario del workspace y un [webhook operativo](/docs/product-webhooks/deliveries#operational) `transformation.disabled`. Arréglala, pruébala y reanúdala con **Resume**, o envía `PATCH /v1/transformations/{id}` con `{"status": "enabled"}`: las entregas que esperaban salen, y las que fueron a la cola dead-letter se pueden [volver a entregar](/docs/product-webhooks/deliveries#replay).

## Límites {#limits}

Una pipeline no tiene bucles, ni reloj, ni E/S, así que la misma pipeline hace siempre lo mismo con el mismo evento, y unos límites fijos acotan cada ejecución:

| Pipeline | Límite |
|---|---|
| Pasos | 20 |
| Rutas en un `drop`, campos en un `set`, nombres en cada parte de un paso `headers` | 50 |
| La configuración de un paso, como JSON compacto | 16 KiB |
| La nota de un paso | 200 caracteres |
| Anidamiento, en un paso y en un cuerpo | 32 niveles |
| El cuerpo que lee un paso y el cuerpo que se envía | 256 KiB |
| Un valor que genera un paso | 64 KiB |
| Trabajo en una ejecución | 100.000 valores leídos o copiados; el texto cuenta uno por KiB |
| Cabeceras al final de una ejecución | 50 |
| Un valor de cabecera | 8 KiB |
| El valor de un secreto | 4.096 caracteres de ASCII imprimible, sin espacios al principio ni al final |

| Script | Límite |
|---|---|
| CPU | Unos 50 ms de tiempo de script, contados en instrucciones en lugar de medidos, así que el mismo script tiene el mismo presupuesto por mucha carga que tengamos |
| Tiempo transcurrido | 1 segundo |
| Memoria | 64 MiB |
| Tamaño del script | 1 MiB |
| Salida | 256 KiB |
| Logs | 4 KiB |
| Scripts ejecutándose a la vez, por workspace | 2 en Starter, 4 en Pro; en Custom, los del plan en el que se basa el contrato |

## Errores {#errors}

Una pipeline que nunca podría ejecutarse se rechaza al guardarla o al probarla, con `422 invalid_pipeline`. El rechazo nombra el primer problema: `details.reason`, `details.path` (un JSON Pointer hasta él) y `details.step` (contado desde 0), cada uno cuando corresponde.

```json
{ "error": { "code": "invalid_pipeline", "message": "…", "details": { "reason": "managed_header", "path": "/steps/0/headers/set/User-Agent", "step": 0 }, "request_id": "…" } }
```

| `reason` | Qué está mal |
|---|---|
| `invalid_document` | No es un objeto con una `version` y una lista de `steps`. |
| `unsupported_version` | `version` no es `1`. |
| `no_steps` | No hay pasos. |
| `too_many_steps` | Hay más de 20 pasos. |
| `invalid_step` | Un paso no es un objeto con una sola clave de paso, sin nada más al lado que una `note` y, en un filtro, una `action`. |
| `unknown_step` | Una clave de paso no es `filter`, `drop`, `set`, `map`, `headers` ni `auth`. |
| `invalid_value` | Un ajuste no es de los que acepta su paso, como un `drop` vacío o una nota de más de 200 caracteres. |
| `invalid_path` | Una ruta no se puede leer, o lleva un comodín donde su paso no lo acepta. |
| `invalid_template` | Una expresión no se puede leer, o nombra un filtro que no existe. |
| `invalid_filter` | Un filtro no es válido, por ejemplo porque usa un operador desconocido. |
| `invalid_header` | Un nombre de cabecera no es válido o pertenece a la conexión, o un valor no es ASCII imprimible en una sola línea. |
| `invalid_secret` | El `secret` de un paso `auth` no es el id de un secreto. Un valor pegado ahí nunca se repite en un mensaje. |
| `auth_not_last` | Hay un paso después de un paso `auth`. |
| `too_deep` | Algo está anidado a más de 32 niveles. |
| `too_large` | La configuración de un paso supera los 16 KiB. |
| `not_json` | Contiene un valor que no es JSON. |
| `managed_header` | Un paso pone una cabecera que enviamos nosotros: `X-Webhook-*` o `User-Agent`. |
| `forbidden_header` | Un paso pone una cabecera hop-by-hop o de control, como `Expect`. |
| `unknown_secret` | Un paso `auth`, o los `secrets` de una referencia, nombran un secreto que su proyecto no tiene. |
| `unknown_pipeline` | Una [referencia](#reference) nombra una pipeline que este workspace no tiene en Transforms. |
| `unknown_pipeline_version` | Una referencia fija una versión que Transforms no tiene. |
| `unbound_secret` | La versión que ejecuta una referencia nombra un slot que sus `secrets` no asignan. |

Los demás rechazos:

| Estado | Código | Cuándo |
|---|---|---|
| `422` | `validation_error` | Una transformación enviada con más de uno de `code`, `pipeline` y `pipeline_ref` o sin ninguno, o un `PATCH` con el campo de otro tipo. |
| `402` | `not_entitled` (`feature: transformations`) | Crear un script, guardar código nuevo, reanudar un script o probarlo en un plan sin scripts. |
| `422` | `invalid_transformation` | Un script que no se carga: `syntax_error`, `no_transform`, `code_too_large` o `load_failed`. |
| `409` | `conflict` (`transformation_in_use`) | Borrar una transformación que un endpoint todavía ejecuta. Desvincúlala primero. |
| `409` | `conflict` (`secret_in_use`) | Borrar un secreto que usa la versión actual de una pipeline. Cambia primero la pipeline. |
| `409` | `conflict` (`destinations_unconfirmed`) | Un `PATCH` que guarda un paso `auth` sin nombrar en `confirm_destinations` todos los endpoints que ejecutan la transformación. `details.destinations` lista sus URL, y no se guarda nada. |
| `403` | `forbidden` (`role`) | Un miembro que guarda o cambia un secreto, guarda una pipeline cuyo paso `auth` hace referencia a uno o vincula una pipeline así a un endpoint. |
| `403` | `forbidden` (`project_confined`) | Una clave o un inicio de sesión limitados a ciertos proyectos que eligen o prueban una pipeline de Transforms. |
| `404` | `not_found` (`transformation`, `transformation_version`, `secret`) | No existe, esa versión ya no se guarda, o un endpoint nombra una transformación de otro proyecto. |
| `429` | `rate_limited` | Se han superado los 60 guardados y pruebas de scripts por minuto por workspace. |
| `503` | `unavailable` (`transform`) | El sandbox no pudo ejecutar el script en ese momento. No se guardó nada; vuelve a intentarlo. |
| `503` | `unavailable` (`transforms`) | No se pudo consultar a Transforms sobre la pipeline de una referencia. No se guardó nada; vuelve a intentarlo. |

## Próximos pasos {#next-steps}

- [Slack, Teams y Discord](/docs/product-webhooks/chat-apps) — consigue la URL de webhook de un canal y envíale eventos.
- [Entregas y reintentos](/docs/product-webhooks/deliveries) — estados, reintentos y cómo volver a enviar.
- [Verificación de endpoints](/docs/product-webhooks/endpoint-verification) — el desafío, y los receptores que no pueden responderlo.
- [Transforms](/docs/product-transforms) — crea, versiona y prueba pipelines en un solo sitio, y ejecútalas aquí por referencia.
- [API de Webhooks](/docs/reference/webhooks) — todas las rutas, entre ellas `/v1/transformations` y `/v1/secrets`.
- [Resumen de Webhooks](/docs/product-webhooks) — eventos, endpoints y suscripciones.
