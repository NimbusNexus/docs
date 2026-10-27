---
title: "Idempotencia"
description: "Peticiones de escritura que puedes reintentar sin riesgo con la cabecera Idempotency-Key."
publishedAt: 2026-05-20
updatedAt: 2026-10-05
kind: concept
---

# Idempotencia

Una petición es **idempotente** cuando hacerla dos veces tiene el mismo efecto que hacerla una vez. `GET /v1/vms` es idempotente por naturaleza — no cambia nada. `POST /v1/vms` **no** es idempotente por naturaleza — llámalo dos veces y tendrás dos VMs.

La cabecera `Idempotency-Key` te permite convertir cualquier petición de escritura en una que se puede reintentar sin riesgo. Pasa cualquier valor único (lo habitual es un UUID) y guardamos la respuesta en caché durante 24 horas: cada repetición con la misma clave devuelve la misma respuesta.

## El problema que resuelve {#problem}

Llamas a `POST /v1/vms`. La red se cae en el camino de vuelta y recibes un timeout en lugar de un 201. ¿Se ha creado la VM? No lo sabes:

- Si reintentas: quizá acabes con dos VMs (la original ha funcionado; tu reintento ha creado una segunda).
- Si no reintentas: quizá acabes sin ninguna VM (la original ha fallado; has aceptado un estado equivocado).

Con una clave de idempotencia, el reintento es seguro. Si la original ha funcionado, el reintento devuelve el mismo 201 con el mismo id de VM — sin duplicados. Si la original ha fallado, el reintento hace el trabajo de verdad.

## Cómo usar la cabecera {#usage}

Envía cualquier cadena de hasta 255 caracteres:

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web-01", "size": "gp-2-4", "region": "us-east-1", "image": "ubuntu-24.04" }'
```

Lo habitual es un UUID v4 por operación lógica. Genéralo una vez en el cliente, guárdalo antes de enviar la petición y reutilízalo en cada reintento de esa misma operación lógica. Genera uno nuevo para la *siguiente* operación lógica.

## Qué cuenta como "la misma clave" {#same-key}

Guardamos la respuesta en caché indexada por:

1. El valor de la cabecera `Idempotency-Key`
2. La clave de API que hace la petición
3. El endpoint (método + ruta)

Así, dos peticiones comparten una respuesta en caché solo si **coinciden las tres cosas**. Esto evita accidentes — una clave reutilizada en dos endpoints, con dos claves de API o incluso en dos proyectos (claves de API distintas) no hará que se crucen las respuestas.

## Qué se guarda en caché {#cached}

Guardamos en caché la **respuesta completa** — código de estado, cabeceras y cuerpo. Una repetición con la misma clave devuelve una salida idéntica byte a byte. Esto importa a los clientes que calculan una huella de las respuestas para detectar "¿ha cambiado esto?" — obtienen una respuesta coherente.

También guardamos en caché los **errores**. Si tu primera llamada no ha superado la validación (`422 validation_error`), el reintento devuelve el mismo `422` — no un error distinto aunque hayas corregido algo entre un intento y otro. Es lo correcto: idempotencia significa "mismo efecto", y el efecto de la primera llamada fue un fallo. Si quieres un intento nuevo, genera una clave nueva.

La API de Webhooks es la excepción: solo registra una clave cuando una publicación tiene éxito. Consulta [En la API de Webhooks](#webhooks).

El TTL de la caché es de **24 horas** desde el primer uso. Pasado ese tiempo, una petición con la misma clave se trata como una petición nueva.

## Cuándo usarla {#when}

| Tipo de endpoint | ¿Usarla? |
|---|---|
| `POST` que crea un recurso (`POST /v1/vms`) | Sí |
| `PUT` que sustituye un recurso (`PUT /v1/vms/{id}`) | Sí |
| `PATCH` que actualiza un recurso | Sí |
| `DELETE` | Sí |
| `GET`, `HEAD`, `OPTIONS` | No — ya son idempotentes por naturaleza |
| `POST` que lanza una operación puntual (p. ej. `POST /v1/vms/{id}/reboot`) | Sí — reiniciar dos veces no es lo mismo que reiniciar una vez |

En la práctica: cualquier petición de escritura que pueda fallar a medio camino se beneficia de una clave. El coste es una cabecera en cada petición y un paso de generación de UUID por tu parte.

## Conflicto con un uso anterior {#conflicts}

Si reutilizas una clave con un **cuerpo de petición distinto** en el mismo endpoint, recibes `409 Conflict` con `error.code: 'conflict'`, y `error.message` dice que la clave ya se usó con otro cuerpo de petición. La petición original se mantiene; tu cuerpo distinto se rechaza. Es el comportamiento más seguro — devolver en silencio la respuesta antigua ocultaría un bug en tu bucle de reintentos.

Si de verdad necesitas hacer una petición distinta, genera una clave nueva.

Versiones anteriores de esta página decían que esta respuesta llevaba `error.code: 'idempotency_key_reused'`. La API nunca ha enviado ese código; envía `conflict`. `conflict` también cubre otros choques con el estado existente, como un nombre ya en uso; en la API de Webhooks, `details.reason` es `idempotency_key_reuse` en este caso. Consulta [Errores](/docs/errors#codes-state).

## En la API de Webhooks {#webhooks}

En la API de Webhooks, `Idempotency-Key` se aplica a la publicación de un evento (`POST /v1/events`) y se comporta así:

| Envías | Recibes |
|---|---|
| Una clave nueva | `201` y el evento nuevo, repartido entre los endpoints que coinciden. |
| La misma clave y el mismo cuerpo | `200`, el evento **original** y la cabecera `Idempotency-Replayed: true`. No se vuelve a repartir nada. |
| La misma clave y otro cuerpo | `409` con `error.code: 'conflict'`, `details.reason: 'idempotency_key_reuse'` y la clave en `details.idempotency_key`. El evento original se mantiene. |
| La misma clave después de una petición que ha fallado | La petición se vuelve a ejecutar. Una publicación fallida (un error de validación, un error de cuota, un límite de tasa) no registra la clave. |

"El mismo cuerpo" significa el mismo tipo de evento y el mismo payload para el mismo proyecto. Una clave de idempotencia pertenece a tu workspace y a tu proyecto, no a la clave de API que la envió, así que dos claves de API que publican en el mismo proyecto comparten las claves de idempotencia. Cada clave se conserva al menos 24 horas.

## Cuándo no merece la pena {#skip}

El flujo sin clave es `best-effort retry`. Para las lecturas, está bien; para las escrituras en las que puedes tolerar "quizá nada, quizá una" (operaciones idempotentes a nivel de aplicación), también. La cabecera no cuesta nada — pero si tu aplicación no reintenta cuando algo falla, no notarás la diferencia.

Los casos en los que de verdad quieres una clave:

- Todo lo relacionado con la facturación (no quieres cobrar dos veces a una tarjeta)
- Todo lo que ve el usuario (no quieres enviar una notificación dos veces)
- Cualquier paso de un flujo de trabajo que provisiona algo cuando hay un fallo (no quieres recursos huérfanos)

## Próximos pasos {#next-steps}

- [Convenciones](/docs/conventions) — paginación, códigos de estado, formatos de error y el resto.
- [Límites de tasa](/docs/rate-limiting) — cuando los reintentos reciben un 429: la otra mitad de los reintentos seguros.
- [Errores](/docs/errors) — el formato de error y qué significa cada `error.code`.
