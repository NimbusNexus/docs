---
title: "Autenticación"
description: "Claves de API, alcances, el aislamiento entre proyectos y cómo rotar credenciales sin riesgo."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: concept
---

# Autenticación

La API de NimbusNexus en `{{API_HOST}}` recibe una **clave de API** en la cabecera `X-API-Key`. Cada clave pertenece a una persona y funciona en un proyecto, con los roles y las reglas de acceso con los que se creó.

## Cómo es una petición {#request-shape}

Envía la clave en la cabecera `X-API-Key`:

```bash
curl {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY"
```

La clave es el valor `api_key` que recibes al crearla: el ID de la clave y su secreto, unidos por dos puntos y codificados en base64. Una clave que la API no puede decodificar o no reconoce responde `401`.

## Cómo generar una clave {#generating}

Crea una clave en el panel o con `POST /api/v1/api_keys/` desde una sesión iniciada con el alcance del proyecto de la clave. Dale un `name` que sea único entre tus claves y, de forma opcional, una `description` y un `expires_at`. La respuesta contiene la clave una sola vez, en `api_key`; cópiala en ese momento. Después, la API devuelve el nombre, los roles, las reglas de acceso y la caducidad de la clave, pero nunca su secreto.

## Alcance de proyecto {#project-scope}

Cada clave de API tiene el alcance de **un único proyecto**. La clave puede leer y escribir recursos de su proyecto; no puede ver los recursos de otros proyectos, ni siquiera dentro de la misma cuenta.

Los proyectos son la unidad de control de acceso y de aislamiento; la facturación es por workspace. El proyecto por defecto que viene con una cuenta nueva sirve para el desarrollo individual; los equipos que trabajan en producción suelen querer un proyecto por entorno (`prod`, `staging`, `dev`), para que una clave de desarrollo comprometida no pueda llegar a los datos de producción.

Cambiar de proyecto = generar una clave nueva en el proyecto de destino. No hay ningún mecanismo del tipo "usa esta clave, pero haz como si estuvieras en otro proyecto"; eso erosionaría la garantía de aislamiento.

## Qué puede hacer una clave {#scopes}

Una clave actúa con **roles** en su proyecto, y unas **reglas de acceso** limitan qué llamadas puede hacer:

- `roles` — los roles con los que actúa la clave, elegidos entre los que tienes en el proyecto. Si lo omites, la clave los recibe todos.
- `access_rules` — las llamadas que la clave puede hacer. Cada regla es un `service` (`api` para esta API), un `method` y un `path`, como `GET` y `/api/v1/instance/`. `GET /api/v1/api_keys/access_rules_artifacts` lista todos los métodos y rutas que puedes indicar; si una ruta no existe, crear la clave responde `422`.
- `unrestricted: true` — sin reglas de acceso: la clave puede hacer cualquier llamada que permitan sus roles.

Una clave sin reglas de acceso y sin `unrestricted` solo puede leer su propia sesión (`GET /api/v1/account/get_session_auth_data`). Una llamada fuera de las reglas de acceso de una clave responde `403`, con el mensaje "API key is restricted for this path!". Así sale barato empezar con reglas restringidas y añadir llamadas solo cuando se rechace una.

## Rotación {#rotation}

No hay ninguna llamada para rotar. Para sustituir una clave, crea la nueva, pasa tus herramientas a ella y después borra la antigua con `DELETE /api/v1/api_keys/{api_key_id}`. La API comprueba la clave en cada petición, así que una clave borrada deja de funcionar en su siguiente llamada. Las herramientas que guardan la clave durante mucho tiempo (CI/CD, agentes desplegados) deberían volver a leerla al arrancar el proceso, para que una rotación se propague en un ciclo de despliegue. Ponles un `expires_at` a las claves, para que una olvidada deje de funcionar por sí sola.

Si sospechas que una clave está comprometida, bórrala de inmediato, en el panel o con `DELETE /api/v1/api_keys/{api_key_id}` desde una sesión iniciada.

## Errores habituales {#errors}

Las APIs de Webhooks e Inboxes responden a un problema de credenciales con estos códigos. Se diferencian en un punto: `invalid_credential`, una clave que la API no reconoce, es un `403` en Webhooks y un `401` en Inboxes.

| Estado    | error.code           | API   | Qué significa |
| --------- | -------------------- | ----- | ------------- |
| 401       | `unauthorized`       | Ambas | No se ha enviado ninguna credencial (ni `Authorization` ni `X-API-Key`) o la clave se ha revocado. |
| 401 / 403 | `invalid_credential` | Ambas | La clave o el token no es válido: un `401` en Inboxes, un `403` en Webhooks. Sustitúyelo; volver a enviarlo no funcionará. |
| 403       | `forbidden`          | Ambas | La clave es válida, pero no puede hacer esto: un alcance o un rol que falta, una clave limitada a ciertos proyectos usada fuera de ellos o un producto que no está habilitado para tu workspace. |

`message` dice en qué caso estás; decide según `code`, no según el estado: `invalid_credential` es un `403` en Webhooks y un `401` en Inboxes. Trátalo junto con `unauthorized`, como "esta credencial no sirve".

Versiones anteriores de esta página enumeraban `no_credentials`, `invalid_credentials`, `expired_credentials`, `scope_required` y `wrong_project`. Las APIs nunca han enviado esos códigos. Envían `unauthorized` donde la página decía `no_credentials`; `invalid_credential` donde decía `invalid_credentials` o `expired_credentials`, ya que una clave caducada es una clave que la API no puede verificar; y `forbidden` donde decía `scope_required` o `wrong_project`.

Los errores anteriores usan el formato de error estándar que se describe en [Errores](/docs/errors).

## Próximos pasos {#next-steps}

- Lee [Convenciones](/docs/conventions) para conocer los patrones que siguen todos los endpoints (ids de recursos, paginación, errores, idempotencia).
- Lee la [referencia de máquinas virtuales](/docs/api/vms) para ver un ejemplo concreto y completo de la API de un recurso.
