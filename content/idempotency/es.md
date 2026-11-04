---
title: "Idempotencia"
description: "Qué rutas aceptan la cabecera Idempotency-Key y cómo reintentar sin riesgo en las demás."
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: concept
---

# Idempotencia

Una petición es **idempotente** cuando hacerla dos veces tiene el mismo efecto que hacerla una vez. `GET /api/v1/instance/` es idempotente por naturaleza — no cambia nada. `POST /api/v1/instance/` **no** es idempotente por naturaleza — llámalo dos veces y tendrás dos VMs.

La cabecera `Idempotency-Key` hace que una petición se pueda reintentar sin riesgo, pero solo en las pocas rutas que la aceptan. Todas las demás rutas ignoran la cabecera.

## El problema que resuelve {#problem}

Publicas un evento con `POST /v1/events`. La red se cae en el camino de vuelta y recibes un timeout en lugar de un 201. ¿Ha salido el evento? No lo sabes:

- Si reintentas: quizá tus clientes lo reciban dos veces (la petición original ha funcionado; tu reintento ha publicado un segundo evento).
- Si no reintentas: quizá no lo reciban nunca (la original ha fallado; has aceptado un estado equivocado).

Con una clave de idempotencia, el reintento es seguro. Si la original ha funcionado, el reintento devuelve el evento original y no vuelve a repartir nada. Si la original ha fallado, el reintento hace el trabajo de verdad.

## Rutas que aceptan la cabecera {#usage}

| Ruta | API | La clave es |
|---|---|---|
| `POST /v1/events` | Webhooks | Opcional |
| `POST /v1/qr-tracked/imports` | Códigos QR | Obligatoria |
| `POST /api/v1/payment/payment_methods/{payment_method_id}/add_funds` | Infraestructura | Obligatoria |

Envía cualquier cadena única:

```bash
curl -X POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "event_type": "order.created", "payload": { "order_id": "1234" } }'
```

Lo habitual es un UUID v4 por operación lógica. Genéralo una vez en el cliente, guárdalo antes de enviar la petición y reutilízalo en cada reintento de esa misma operación lógica. Genera uno nuevo para la *siguiente* operación lógica.

## En la API de Webhooks {#webhooks}

En la API de Webhooks, `Idempotency-Key` se aplica a la publicación de un evento (`POST /v1/events`) y se comporta así:

| Envías | Recibes |
|---|---|
| Una clave nueva | `201` y el evento nuevo, repartido entre los endpoints que coinciden. |
| La misma clave y el mismo cuerpo | `200`, el evento **original** y la cabecera `Idempotency-Replayed: true`. No se vuelve a repartir nada. |
| La misma clave y otro cuerpo | `409` con `error.code: 'conflict'`, `details.reason: 'idempotency_key_reuse'` y la clave en `details.idempotency_key`. El evento original se mantiene. |
| La misma clave después de una petición que ha fallado | La petición se vuelve a ejecutar. Una publicación fallida (un error de validación, un error de cuota, un límite de tasa) no registra la clave. |

"El mismo cuerpo" significa el mismo tipo de evento y el mismo payload para el mismo proyecto. Una clave de idempotencia pertenece a tu workspace y a tu proyecto, no a la clave de API que la envió, así que dos claves de API que publican en el mismo proyecto comparten las claves de idempotencia. Cada clave se conserva al menos 24 horas.

## En códigos QR y al añadir fondos {#other-routes}

En códigos QR, una importación en bloque (`POST /v1/qr-tracked/imports`) necesita una clave. Una clave de idempotencia pertenece a tu workspace. La misma clave y el mismo cuerpo devuelven la importación original sin volver a crear sus códigos; la misma clave y otro cuerpo responden `409`.

Añadir fondos a tu saldo (`POST /api/v1/payment/payment_methods/{payment_method_id}/add_funds`) también necesita una clave, para que una recarga reintentada no cobre dos veces a la tarjeta. Esta llamada necesita una sesión iniciada, no una clave de API ([Métodos de pago](/docs/api/payment-methods)).

## Conflicto con un uso anterior {#conflicts}

En Webhooks y en códigos QR, si reutilizas una clave con un **cuerpo de petición distinto** en el mismo endpoint, recibes `409 Conflict` con `error.code: 'conflict'`, y `error.message` dice que la clave ya se usó con otro cuerpo de petición. La petición original se mantiene; tu cuerpo distinto se rechaza. Es el comportamiento más seguro — devolver en silencio la respuesta antigua ocultaría un bug en tu bucle de reintentos.

Si de verdad necesitas hacer una petición distinta, genera una clave nueva.

Versiones anteriores de esta página decían que esta respuesta llevaba `error.code: 'idempotency_key_reused'`. La API nunca ha enviado ese código; envía `conflict`. `conflict` también cubre otros choques con el estado existente, como un nombre ya en uso; en la API de Webhooks, `details.reason` es `idempotency_key_reuse` en este caso. Consulta [Errores](/docs/errors#codes-state).

## En todas las demás rutas {#skip}

Sin una clave, comprueba antes de reintentar una escritura:

- **Crear una VM o un volumen.** La llamada pone el trabajo en cola y responde sin ningún id, así que busca el recurso nuevo en la lista (`GET /api/v1/instance/`, `GET /api/v1/storage/`) antes de volver a enviarla. Un `name` único hace que sea fácil de encontrar.
- **Crear algo con un nombre único.** Una zona DNS o un contenedor del almacenamiento de objetos cuyo nombre ya está en uso responde `409`, así que un reintento tras un timeout no puede crear un duplicado. Interpreta el `409` como una señal de que la petición original puede haber funcionado.
- **Borrar.** Repetir un borrado no borra nada más, aunque la segunda llamada puede responder con un error porque el recurso ya no existe. Lee el recurso para asegurarte.

Para las lecturas, reintentar siempre está bien.

## Próximos pasos {#next-steps}

- [Convenciones](/docs/conventions) — paginación, códigos de estado, formatos de error y el resto.
- [Límites de tasa](/docs/rate-limiting) — cuando los reintentos reciben un 429: la otra mitad de los reintentos seguros.
- [Errores](/docs/errors) — el formato de error y qué significa cada `error.code`.
