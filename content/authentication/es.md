---
title: "Autenticación"
description: "Claves de API, alcances, el aislamiento entre proyectos y cómo rotar credenciales sin riesgo."
publishedAt: 2026-05-19
updatedAt: 2026-10-15
kind: concept
---

# Autenticación

La API de NimbusNexus usa **claves de API** como tokens bearer. Hay un único mecanismo para todos los endpoints — ni un formato de credencial por recurso, ni un esquema de firma aparte para las llamadas "avanzadas". Si puedes hacer una petición autenticada, puedes hacerlas todas.

## Cómo es una petición {#request-shape}

Envía la clave en la cabecera `Authorization`. El formato es la palabra literal `Bearer` seguida de tu clave:

```bash
curl {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer nn_live_xxxxxxxxxxxxxxxx"
```

Las claves llevan un prefijo según el entorno: `nn_live_*` para producción y `nn_test_*` para el sandbox. Después del prefijo tienen 32–48 caracteres de un alfabeto seguro para base32.

## Cómo generar una clave {#generating}

En el panel: **Settings → API keys → New key**. Verás el valor de la clave una sola vez, al crearla; cópialo en ese momento. Después, el panel solo muestra el prefijo + los 4 últimos caracteres, para que puedas distinguir cada clave sin exponer el secreto.

No hay una API para crear claves de API, y es a propósito. Para recuperarse del compromiso de una clave hace falta un canal fuera de banda al que la clave comprometida no pueda llegar — tener que usar el panel es el cuello de botella que hace que esa recuperación sea limpia.

## Alcance de proyecto {#project-scope}

Cada clave de API tiene el alcance de **un único proyecto**. La clave puede leer y escribir recursos de su proyecto; no puede ver los recursos de otros proyectos, ni siquiera dentro de la misma cuenta.

Los proyectos son la unidad de control de acceso, de facturación y de aislamiento. El proyecto por defecto que viene con una cuenta nueva sirve para el desarrollo individual; los equipos que trabajan en producción suelen querer un proyecto por entorno (`prod`, `staging`, `dev`), para que una clave de desarrollo comprometida no pueda llegar a los datos de producción.

Cambiar de proyecto = generar una clave nueva en el proyecto de destino. No hay ningún mecanismo del tipo "usa esta clave, pero haz como si estuvieras en otro proyecto"; eso erosionaría la garantía de aislamiento.

## Alcances (capacidades) {#scopes}

Las claves llevan **alcances** que limitan lo que pueden hacer dentro de su proyecto. El conjunto de alcances por defecto de una clave nueva es lectura+escritura sobre todo el proyecto; puedes restringirlo al crearla, p. ej. a solo `vms:read` para un agente de monitorización que nunca necesita crear recursos.

La lista completa de alcances refleja los tipos de recurso:

- `vms:read`, `vms:write`, `vms:create`, `vms:delete`
- `databases:read`, `databases:write`, …
- `block-storage:read`, `block-storage:write`, …
- `object-storage:read`, `object-storage:write`, …
- `iam:read`, `iam:write` (gestionar los propios usuarios, proyectos y claves)

Una petición a un endpoint que requiere un alcance que la clave no tiene devuelve `403 Forbidden` con `error.code: 'forbidden'`, y `error.message` dice qué faltaba. Así sale barato empezar con alcances restringidos y ampliarlos solo cuando algo falle. (Versiones anteriores de esta página prometían `scope_required` con el alcance en `error.fields.scope`; la API nunca ha enviado ninguno de los dos.)

## Rotación {#rotation}

Cada clave se puede rotar de forma independiente. Rotar una clave:

1. Genera un nuevo valor de clave.
2. Marca la clave antigua como **obsoleta**, pero la mantiene válida durante **24 horas**.
3. Registra el uso de las dos claves durante ese periodo, para que puedas comprobar que la clave nueva está en uso antes de que la antigua deje de funcionar.

Para la rotación automatizada (que recomendamos), llama a la API de IAM para rotar de forma programada y deja que el solapamiento de 24 horas absorba el tiempo del despliegue. Las herramientas que guardan la clave durante mucho tiempo (CI/CD, agentes desplegados) deberían volver a leerla al arrancar el proceso, para que una rotación se propague en un ciclo de despliegue.

Si sospechas que una clave está comprometida, **revócala** en lugar de rotarla — así te saltas el periodo de gracia de 24 horas y la clave antigua queda invalidada de inmediato. El panel permite revocarla con un solo clic; también hay un endpoint de IAM para revocar claves de emergencia desde tu código.

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
- Para configuraciones entre servicios dentro de tu propia infraestructura, también puedes crear **relaciones de confianza** entre proyectos — consulta la referencia de IAM (próximamente).
