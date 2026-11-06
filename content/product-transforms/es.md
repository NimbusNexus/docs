---
title: "Transforms"
description: "Pipelines declarativas que filtran, recortan y adaptan una petición. Constrúyelas, versiónalas y pruébalas en un solo lugar, y después ejecútalas por la API o por referencia desde el producto que envía."
publishedAt: 2026-11-06
updatedAt: 2026-11-06
kind: concept
---

# Transforms

NimbusNexus Transforms convierte las **pipelines** en objetos propios. Una pipeline es una lista corta de pasos declarativos que descartan una petición si no coincide, quitan o añaden campos, reconstruyen el cuerpo a partir de una plantilla y ponen cabeceras. Constrúyela en la consola o por la API REST, pruébala, guarda sus versiones, ejecútala por la API o haz referencia a ella por su id desde el producto que envía.

> **¿No es la página que buscabas?** Transforms no envía nada por sí mismo. Para cambiar lo que recibe un endpoint en cada entrega, consulta [Transformaciones](/docs/product-webhooks/transformations) en Webhooks, y para cambiar lo que reenvía un bin, consulta [Una pipeline antes de cada reenvío](/docs/product-bins/forwarding#pipeline) en Request Bins. Prueba una pipeline sin cuenta en el [playground](/transforms/playground).

## De un vistazo {#at-a-glance}

| | |
| --- | --- |
| Qué creas | Una **pipeline**: un documento JSON de hasta 20 pasos, como `{"version": 1, "steps": [{"drop": ["**.email"]}]}` |
| Qué hace | Filtra una petición, quita o añade campos, reconstruye el cuerpo a partir de una plantilla y pone cabeceras |
| Qué no hace | Enviar nada ni guardar nada de lo que procesa. No es un servicio de reenvío |
| Consola | `https://transforms.nimbusnexus.net` |
| URL base de la API | `https://transforms.nimbusnexus.net/v1` |
| Autenticación | `Authorization: Bearer <key>`, con una clave creada en la consola de la cuenta con **Transforms** como producto |
| Identificador | El `id` de la pipeline, por ejemplo `pipe_8e27d40b19c3f6a5e0d71b42` |
| Probar un documento | `POST /v1/pipelines/test`, que no guarda ni cuenta nada |
| Ejecutar una pipeline guardada | `POST /v1/pipelines/{id}/run`, que responde con lo que hizo |
| Todos los pasos, rutas y filtros | [Pipelines](/docs/product-transforms/pipelines) |
| Todas las rutas, roles y límites | La [referencia de Transforms](/docs/product-transforms/reference) |

## Cómo funciona {#how}

1. **Construye** una pipeline: añade pasos en el formulario de la consola, pégalos como JSON o parte de una [plantilla](/docs/product-transforms/pipelines#templates). Un documento que nunca podría ejecutarse se rechaza al guardarlo, con un `422` `invalid_pipeline` que indica su paso, su ruta y el motivo.
2. **Pruébala**. Ejecuta lo que hay en el editor con una petición que pegues, y mira el cuerpo y las cabeceras que enviaría, el paso que la descartó o por qué falló.
3. **Guárdala**. Guardar contenido nuevo añade una versión, y una versión nunca cambia. Guardar el mismo contenido no añade ninguna, y restaurar una versión anterior es volver a guardar su contenido.
4. **Ejecútala**, de una de estas dos formas:
   - **Por la API.** Envía una petición a `POST /v1/pipelines/{id}/run`. Ejecuta la pipeline con lo que envías, responde con el resultado y no guarda nada. Enviar el resultado a algún sitio es cosa tuya.
   - **Por referencia.** Haz referencia a la pipeline por su id desde Webhooks, que la ejecuta antes de cada entrega en su propio proceso. Cada versión nueva le llega sin cambiar ningún endpoint.

El [inicio rápido](/docs/product-transforms/quickstart) hace los pasos 1 a 4 por la API.

## Qué responde una ejecución {#answers}

Una pipeline no tiene bucles, ni reloj, ni red, así que la misma pipeline hace siempre lo mismo con la misma petición. Una ejecución responde `200` con uno de tres estados, porque en todos los casos la pipeline se ejecutó:

| `status` | Qué significa | Qué hacer |
| --- | --- | --- |
| `ok` | `body`, `headers` y `query` son la petición que hay que enviar. | Envíala. |
| `dropped` | Un filtro descartó la petición. `step`, `note` y `reason` indican cuál y por qué. | No envíes nada. |
| `failed` | La pipeline no puede ejecutarse con esta petición. `step`, `reason` y `error` indican por qué, como un límite que ha superado. | Cambia la pipeline o la petición. La misma petición falla igual, así que no reintentes. |

## Credenciales {#credentials}

Transforms no guarda credenciales. El paso `auth` de una pipeline indica que un bearer token, autenticación básica o una clave de API va en la petición, y nombra un **slot** para ello. Un slot es un id y una etiqueta, sin ningún valor: añade uno en la consola, en **Credential slots**, o con `POST /v1/slots`. El documento contiene el id del slot y nada más, así que leer una pipeline de nuevo nunca muestra una credencial, y ninguna ruta acepta ni devuelve el valor de una credencial.

Para enviar una, ejecuta la pipeline por referencia desde el producto que envía. Ese producto asigna el slot a un secreto de su propio almacén, con su propia clave, y lo envía a sus propias URLs. Fuera de ese producto, el slot no significa nada.

Test y la API de ejecución muestran lo que añadiría el paso, con el valor enmascarado: `Authorization: Bearer ••••`. No pueden enviar una credencial, porque Transforms no tiene ninguna que enviar.

Primero se ve dónde se ejecuta una pipeline. Al leerla se listan los productos que la ejecutan por referencia y la versión que ejecuta cada uno. Para guardar una versión nueva con un paso `auth`, o para borrar la pipeline, hay que nombrar a cada uno de ellos en `confirm_destinations`; si no, se rechaza con `409` `conflict`, `destinations_unconfirmed` ([Quién ejecuta una pipeline](/docs/product-transforms/reference#destinations)).

## Planes y límites {#limits}

| | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- |
| Pipelines | 5 | 25 | 100 | 1,000 |
| Slots de credenciales | 5 | 25 | 100 | 1,000 |
| Versiones guardadas por pipeline | 10 | 25 | 50 | 100 |
| Ejecuciones por minuto | 60 | 600 | 3,000 | 12,000 |

Los seis pasos, las plantillas, Test, la API de ejecución y la ejecución por referencia están en todos los planes, Free incluido.

Las ejecuciones se cuentan, no se facturan. `GET /v1/usage` muestra las del mes. Por encima de la tasa del plan, que Test comparte, una ejecución responde `429` `rate_limited` e indica cuánto hay que esperar. Una ejecución en un producto que hace referencia a la pipeline cuenta en el consumo de ese producto. Una versión que un producto fija, o que se ha visto ejecutándose en un producto en los últimos 30 días, se conserva aunque supere el número del plan.

## Cómo obtener acceso {#access}

Abre la consola en `https://transforms.nimbusnexus.net` e inicia sesión con tu cuenta de NimbusNexus, o añade Transforms desde **Add a product** en cualquier consola de NimbusNexus. La primera visita de un propietario o administrador del workspace añade Transforms al workspace; a partir de entonces, los demás miembros pueden abrirlo.

La API de Transforms no emite claves. Crea una en tu [consola de la cuenta]({{ACCOUNT_BASE_URL}}/api-keys?product=transforms), en **API keys**, con **Transforms** como producto. Una clave es un JWT, así que empieza por `eyJ`. Envíala como `Authorization: Bearer <key>` o `X-API-Key: <key>`.

Elige su permiso al crearla: **Read** lee y ejecuta pipelines, y **Read & write** además puede crearlas, cambiarlas, probarlas y borrarlas. [Quién puede hacer qué](/docs/product-transforms/reference#authority) tiene la tabla completa, roles del workspace incluidos.

## Lo que no hace {#not}

- **No envía.** No tiene destino, ni reintentos, ni registro de entregas. Webhooks entrega eventos y Request Bins reenvía peticiones.
- **No guarda lo que procesa.** La petición y la respuesta de una ejecución desaparecen cuando termina la llamada. Solo queda el recuento.
- **No guarda credenciales.** Una credencial sale del producto que ejecuta la pipeline por referencia.
- **No ejecuta código.** Para la lógica que los pasos no pueden expresar, un endpoint de Webhooks puede ejecutar en su lugar un [script](/docs/product-webhooks/transformations#script), en un plan de pago.

## Próximos pasos {#next-steps}

- [Inicio rápido](/docs/product-transforms/quickstart) — prueba una pipeline, guárdala, ejecútala y guarda una versión nueva.
- [Pipelines](/docs/product-transforms/pipelines) — todos los pasos, rutas, filtros y plantillas, y los límites de una ejecución.
- [Referencia de Transforms](/docs/product-transforms/reference) — todas las rutas y campos, roles, límites y errores.
- [Playground](/transforms/playground) — ejecuta una pipeline de ejemplo sin cuenta.
