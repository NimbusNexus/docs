---
title: "Política de versionado"
description: "Cómo hacemos evolucionar la API sin romper tu código."
publishedAt: 2026-05-20
updatedAt: 2026-10-15
kind: concept
---

# Política de versionado

La API de NimbusNexus está en la **v1** y seguirá en la v1 indefinidamente. Los cambios incompatibles no se publican sobre la v1 — se publicarían detrás de una versión nueva (`v2`, etc.), y la v1 seguiría funcionando sin cambios. Es la misma postura de versionado que adoptan Stripe, Twilio y AWS con sus APIs principales.

## Qué es un cambio incompatible {#breaking}

Cualquier cosa que pueda hacer que el código existente deje de funcionar:

- Eliminar un endpoint
- Eliminar un campo de una respuesta
- Eliminar un código de estado de las respuestas posibles de un endpoint
- Renombrar un campo
- Cambiar el tipo de un campo (p. ej. `string` → `number`)
- Cambiar el comportamiento por defecto de un endpoint existente
- Endurecer la validación de las peticiones (un cuerpo que antes se aceptaba y ahora se rechaza)
- Añadir un nuevo parámetro obligatorio en la petición

Esto nunca ocurre en `v1`. Y punto.

> **Actualizado el 2026-10-15.** Antes del lanzamiento de la v1, los cambios de nombre de errores que ya estaban en curso, y algunos cambios que iban con ellos, se aplicaron sin el periodo de 12 meses que se describe más abajo. En Inboxes: `invalid_request`, el `unauthorized` que enviaba para una clave que no reconoce o no puede verificar, su `error` a secas, el motivo `project` de `forbidden` y las claves de `details` `max_inboxes`, `max_http_bins`, `monthly_messages`, `plan` e `inbox_id`. En Webhooks: `internal`, `unprocessable` y `plan_violation`, el `402` que enviaba para un `max_attempts` por encima del tope del plan y su `409` del reenvío en bloque (ahora ambos son un `422`), y los `details` y tipos de entrada de sus errores de validación. También se eliminaron dos campos de respuesta de Inboxes: `paid_plans_enabled` en `GET /v1/plan`, que para entonces era `true` en todos los workspaces, y el `project_id` de un inbox, que la API había dejado de rellenar. [Errores](/docs/errors#renames) detalla cada cambio de error. Desde el lanzamiento de la v1, todo cambio sigue esta página.

## Qué es un cambio aditivo {#additive}

Cosas que publicaremos en `v1` sin previo aviso:

- Endpoints nuevos
- Parámetros de petición opcionales nuevos
- Campos nuevos en las respuestas (deberías ignorar los campos desconocidos al parsear)
- Códigos de error nuevos (deberías tratar los valores desconocidos de `error.code` según la familia del código de estado)
- Tipos de evento de webhook nuevos
- Valores de enum nuevos (deberías tratar los valores de enum desconocidos como opacos)
- Códigos de estado nuevos de la familia que el endpoint ya devuelve

Documentamos los cambios aditivos en el [changelog](/changelog), pero no los ocultamos tras ningún flag. El código existente sigue funcionando; el código nuevo puede adoptarlos cuando quiera.

## Compatibilidad hacia adelante — cómo escribir código que sobreviva {#forward-compat}

Tres reglas:

**1. Ignora los campos desconocidos al parsear.** Que una respuesta gane un campo nuevo no debería ser un error en tu cliente. La mayoría de las librerías JSON se comportan así por defecto.

```ts
// Correct
const { id, name, state } = await res.json()

// Wrong (will reject responses with new fields)
const allowedKeys = ['id', 'name', 'state']
for (const k of Object.keys(json)) {
  if (!allowedKeys.includes(k)) throw new Error('unknown field')
}
```

**2. Trata los enums desconocidos como opacos.** Si decides según `state`, trata los valores conocidos; para los desconocidos, muestra la cadena en bruto y no falles.

```ts
switch (vm.state) {
  case 'running': return 'green'
  case 'stopped': return 'gray'
  case 'provisioning': return 'amber'
  default: return 'gray' // Don't throw, don't assume — we may add 'migrating'
}
```

**3. Decide según `error.code`, no según `status`.** Los códigos de estado agrupan los errores (`4xx` frente a `5xx`); `error.code` los distingue. Podemos añadir códigos nuevos a códigos de estado existentes; tu código debería caer en el caso por defecto en lugar de tratar los códigos no reconocidos como bugs fatales.

## Política de obsolescencia {#deprecation}

Nos esforzamos por no necesitarla en la v1. Si alguna vez marcamos un endpoint o un campo como obsoleto:

- El endpoint o el campo sigue funcionando sin cambios durante **al menos 12 meses**
- Se añade una cabecera `Deprecation` a las respuestas (RFC 9745)
- Una cabecera `Sunset` lleva la fecha de fin de vida
- El panel muestra el uso de los endpoints obsoletos por proyecto

Doce meses es mucho tiempo. En la práctica, marcar algo como obsoleto en la v1 ha ocurrido cero veces desde el lanzamiento — la evolución aditiva cubre la mayoría de las necesidades.

## Cuando se publique la v2 {#v2}

Si algún día publicamos la v2 (no tenemos intención de hacerlo pronto), el despliegue sería así:

- La v2 se lanzaría en `/v2/...` junto a `/v1/...` — las dos activas en paralelo
- La v1 seguiría recibiendo correcciones de bugs y funciones nuevas (aditivas) durante al menos 24 meses
- La v2 tendría una URL base distinta (`{{API_BASE_URL}}/v2/...`), para que la propia URL indique la versión

Migrarías cuando estuvieras listo, no cuando te obligaran. El camino es empezar a usar los endpoints `/v2` en el código nuevo y migrar el código antiguo a tu ritmo — no hay un cutover de golpe en una fecha fijada.

## Por qué importa {#why}

Una plataforma en la nube cuya API se rompe cada dos años no es una infraestructura fiable. El motivo por el que la v1 sobrevivirá a la mayoría de los demás contratos de la plataforma: el código de los clientes, las integraciones de los partners y la distribución de los SDKs dependen de que esta superficie sea estable. Romperla sin aviso sería la forma más rápida de perder la confianza.

Si alguna vez ves un cambio incompatible real en `v1` que no estaba detrás de una versión nueva: es un bug. Comunícaselo al soporte y lo corregiremos.

## Próximos pasos {#next-steps}

- [Changelog](/changelog) — el registro continuo de los cambios aditivos.
- [Autenticación](/docs/authentication) — la interfaz más estable de la API.
- [Convenciones](/docs/conventions) — el formato de las peticiones, los códigos de estado y las familias de errores.
