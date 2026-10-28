---
title: "Request Bins"
description: "URLs públicas que registran cada petición HTTP que reciben — apunta cualquier aplicación, script o servicio a una y lee exactamente lo que envió, en la consola o por la API."
publishedAt: 2026-10-22
updatedAt: 2026-10-27
kind: concept
---

# Request Bins

NimbusNexus Request Bins te da **bins**: URLs públicas que registran cada petición HTTP que reciben, con cualquier método, a cualquier ruta bajo la URL y con cualquier cuerpo. Apunta a uno cualquier cosa que envíe HTTP — un proveedor de webhooks, tu propia aplicación, un script, un job de CI — y lee exactamente lo que llegó: el método, la ruta, la query, las cabeceras, el cuerpo y la dirección de origen, en la consola o por la API REST.

> **¿No es la página que buscabas?** Un bin registra lo que recibe y responde igual a todos los emisores. En un plan de pago también puede reenviar cada petición a una sola URL tuya, tal como llegó ([Reenvío](/docs/product-bins/forwarding)), pero no comprueba firmas ni entrega a varios endpoints. Para verificar los webhooks de un proveedor y entregarlos como eventos a tus endpoints, con una cola dead-letter y la posibilidad de volver a entregarlos, usa una [fuente de Webhooks](/docs/product-webhooks/sources).

## De un vistazo {#at-a-glance}

| | |
| --- | --- |
| Qué creas | Un **bin**: una URL como `https://nnbin.net/b/k7xq2mbn9tfa` |
| Qué registra | Cada petición a esa URL o a cualquier ruta bajo ella, con cualquier método (`GET`, `POST`, el `PROPFIND` de WebDAV, uno propio del emisor), cualquier cabecera y cualquier cuerpo |
| Qué recibe el emisor | `200` y `{"status":"accepted"}`, al instante |
| Reenvío | En Starter, Pro y Custom, un bin también puede reenviar cada petición a tu propia URL https ([Reenvío](/docs/product-bins/forwarding)) |
| Consola | `https://bins.nimbusnexus.net` |
| URL base de la API | `https://bins.nimbusnexus.net/v1` |
| Autenticación | `Authorization: Bearer <key>`, con una clave creada en la consola de la cuenta con **Request Bins** como producto |
| Identificador que usan todas las rutas | El `id` del bin, por ejemplo `bin_3f9a1c7e5b2d8f4a6c0e9b17` — no su URL |
| Buscar un bin por su URL | `GET /v1/bins?url=<url>` |
| Leer lo que llegó | `GET /v1/bins/{id}/requests`, o `GET /v1/requests` para todos los bins a la vez (planes de pago; en Free se lee en la consola) |
| Todas las rutas, qué responde la URL de un bin, roles y límites | La [referencia de Request Bins](/docs/product-bins/reference) |

## Cómo funciona {#how}

1. **Crea** un bin — en la consola con **Create a bin** (**New bin** cuando ya tengas uno), o con `POST /v1/bins`. Su URL registra peticiones desde ese momento.
2. **Envíale** peticiones. Da la URL a lo que quieras observar — la configuración de webhooks de un proveedor, la configuración de tu aplicación, un script, un job de CI — o llámala tú mismo con `curl`. Lo que va después del slug lo eliges tú: una petición a `https://nnbin.net/b/k7xq2mbn9tfa/orders/42` se registra con la ruta `/orders/42`.
3. **Lee** lo que llegó. Aparece en la consola en cuestión de segundos y, en los planes de pago, en `GET /v1/bins/{id}/requests`. Para encontrar una petición entre muchas, busca texto en rutas, cabeceras y cuerpos, o quédate solo con algunos métodos: **Search** y los chips de método encima de la lista en la consola, `q` y `method` en la API ([Peticiones capturadas](/docs/product-bins/reference#requests)). Para ver qué rutas usó un emisor, cambia la lista a **By path**: cuenta las peticiones a cada ruta, y al elegir una se listan sus peticiones. `GET /v1/bins/{id}/paths` hace lo mismo en la API ([Peticiones por ruta](/docs/product-bins/reference#paths)). **All bins** en la consola, y `GET /v1/requests` en la API, reúnen en una sola lista lo que registraron todos los bins, con la misma búsqueda.
4. **Borra** el bin cuando termines, o deja que caduque.

El [inicio rápido](/docs/product-bins/quickstart) hace los cuatro pasos.

Usa la `url` exactamente como la devuelve la API. Las URLs de los bins están en su propio dominio, `nnbin.net`, no en `{{ROOT_DOMAIN}}`.

## Qué recibe el emisor {#answers}

Un bin responde a cada petición al instante con `200` y el cuerpo `{"status":"accepted"}`, haya registrado la petición o no. Un bin desactivado, suspendido o que ha superado las peticiones mensuales de su plan responde igual, y lo mismo hace una URL cuyo bin nunca existió o se borró. Es deliberado: un emisor que recibe un error puede dejar de enviar, o desactivar tu webhook, y una respuesta distinta para un bin activo permitiría a cualquiera sondear en busca de bins.

La URL de un bin solo responde otra cosa cuando no se ha registrado nada:

- `429`, con `Retry-After`, cuando el emisor o el bin supera su límite por minuto;
- `503`, con `Retry-After`, cuando la petición no se ha podido guardar en ese momento, así que el emisor debe volver a enviarla;
- `404`, cuando el slug de la URL no es uno que Request Bins haya podido emitir nunca.

La referencia tiene los detalles: [qué responde la URL de un bin](/docs/product-bins/reference#edge-answers).

## Qué se registra {#recorded}

De cada petición, un bin guarda el método, la ruta después del slug, la query, las cabeceras en orden de llegada, el cuerpo, la dirección de origen y cuándo llegó. Unas pocas reglas determinan lo que lees después:

- **Los cuerpos se guardan completos, hasta 1 MiB.** De un cuerpo mayor se guarda el primer MiB, `truncated` es `true` y `size_bytes` sigue indicando su tamaño real.
- **Las credenciales se ocultan.** Los valores de `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` y `X-API-Key` se sustituyen por `[redacted]` antes de guardar nada. Las demás cabeceras se guardan tal como se enviaron, incluidas las de firma, porque una firma es justo lo que necesitas ver cuando falla su verificación.
- **No se modifica ni se ejecuta nada.** Un cuerpo se guarda con los bytes que llegaron, y la consola lo muestra como texto, nunca como marcado.
- **Cada petición es una fila independiente.** Una petición enviada de nuevo, con el mismo método, ruta, query y cuerpo, se guarda otra vez, con sus propias cabeceras, dirección y hora, así que cada uno de los reintentos de un emisor se puede abrir por separado.

## Reenvío {#forwarding}

En Starter, Pro y Custom, un bin también puede reenviar a tu propio servidor cada petición que registra. Dale una URL de reenvío, y el método, la ruta, la query, las cabeceras y el cuerpo se envían a esa URL tal como llegaron, mientras el emisor sigue recibiendo al instante el `200` del bin. El bin vuelve a intentarlo cuando tu servidor falla, y guarda junto a la petición lo que respondió tu servidor, así que ves lo que envió un emisor y lo que hizo con ello tu endpoint. Las credenciales no se reenvían: las cabeceras que un bin oculta nunca salen de él. [Reenvío](/docs/product-bins/forwarding) tiene las reglas, los reintentos, los límites y la dirección de la que vienen los reenvíos.

## Planes y límites {#limits}

| | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- |
| Precio | $0 | $9 al mes, o $86.40 al año | $29 al mes, o $278.40 al año | por contrato |
| Bins a la vez | 1 | 5 | 25 | 250 |
| Peticiones registradas al mes | 1.000 | 25.000 | 250.000 | 5.000.000 |
| Se guardan durante (retención) | 1 día | 7 días | 30 días | 90 días |
| Vida útil del bin | 24 horas | hasta que lo borres, o hasta 7 días si fijas una | hasta que lo borres, o hasta 30 días | hasta que lo borres, o hasta un año |
| Lectura por la API | no (solo consola) | sí | sí | sí |
| [Reenvío](/docs/product-bins/forwarding), por bin | no | 60 peticiones por minuto | 300 peticiones por minuto | 600 peticiones por minuto |
| Emisores distintos por bin | 50 | 200 | 500 | 2.000 |
| Envíos de formulario desde navegador por bin | 3 | 5 | 5 | 10 |

Free basta para ver exactamente qué envía cualquier aplicación, script o servicio: un bin, 1.000 peticiones al mes, leídas en la consola.

El mes es un mes natural en UTC, y cuenta cada petición que registra un bin. Superadas las peticiones del mes, los bins siguen respondiendo `200` y no registran nada hasta que empieza el mes siguiente; las peticiones rechazadas así no cuentan. Un bin solo puede usar una parte de las peticiones del mes — todas en Free, la mitad en Starter, el 40 % en Pro y una cuarta parte en Custom — para que una URL muy activa o filtrada no pueda agotar las peticiones de los demás bins del workspace.

Las dos últimas filas son límites contra el abuso, descritos en [Bins suspendidos](#suspended).

## Bins suspendidos {#suspended}

La URL de un bin es pública: cualquiera que la tenga puede enviarle peticiones. Eso haría de un bin un lugar cómodo para recoger lo que envía el formulario de una página de phishing, o datos sacados de máquinas de desconocidos, así que un bin se suspende cuando su tráfico se parece a eso:

- le llegan peticiones desde más direcciones distintas que el límite de **emisores distintos** del plan; o
- recibe más envíos de formulario desde navegadores web que el límite de **envíos de formulario desde navegador** del plan, desde al menos tres direcciones.

Un bin suspendido sigue respondiendo `200` y no registra nada. La consola indica el motivo, y también `suspended_code` en la API. Una suspensión es cosa nuestra, no un interruptor tuyo: activar el bin no la levanta, así que contacta con soporte si crees que es un error. Los bins también quedan retenidos, sin borrarse, cuando un cambio de plan deja al workspace con más bins de los que permite el nuevo plan, y mientras el workspace está suspendido por un cargo impagado; cada uno vuelve en cuanto se resuelve su causa.

Para denunciar la URL de un bin que se está usando de forma abusiva, escribe a `abuse@nnbin.net` con la URL completa.

## Cómo obtener acceso {#access}

Abre la consola en `https://bins.nimbusnexus.net` e inicia sesión con tu cuenta de NimbusNexus, o añade Request Bins desde **Add a product** en cualquier consola de NimbusNexus. La primera visita de un propietario o administrador del workspace añade Request Bins al workspace; a partir de entonces, los demás miembros pueden abrirlo. Un workspace personal empieza en Free, y un workspace de equipo empieza con una prueba de Starter de 7 días.

La API de Request Bins no emite claves. Crea una en tu [consola de la cuenta]({{ACCOUNT_BASE_URL}}/api-keys?product=bins), en **API keys**, con **Request Bins** como producto. Una clave es un JWT, así que empieza por `eyJ`. Envíala como `Authorization: Bearer <key>` o `X-API-Key: <key>`.

Elige su permiso al crearla: **Read** lee los bins y lo que registraron, y **Read & write** además puede crear, modificar, vaciar y borrar bins. En Free una clave puede gestionar bins, pero leer por la API lo que registraron requiere Starter o superior; la consola lo lee en todos los planes. [Quién puede hacer qué](/docs/product-bins/reference#authority) tiene la tabla completa, roles del workspace incluidos.

## Lo que no hace {#not}

- **No responde con la respuesta que tú definas.** Todos los bins responden `200` con `{"status":"accepted"}`; devolver un estado, unas cabeceras o un cuerpo a tu elección no está implementado.
- **No repite peticiones.** Una petición registrada no se puede volver a enviar bajo demanda. Con [Reenvío](/docs/product-bins/forwarding), cada petición se reenvía una vez, según llega.
- **No hace push.** No hay stream ni callback: haz polling de `GET /v1/bins/{id}/requests` con `since`, como hace la consola cada 3 segundos.
- **No es un archivo histórico.** Una petición se borra cuando se agota la retención del plan, y todo lo que hay en un bin desaparece cuando el bin se borra o caduca.
- **No divide un workspace por proyectos.** Request Bins da servicio a workspaces completos, así que se rechazan los puestos de invitado y las claves limitadas a un proyecto.

## Próximos pasos {#next-steps}

- [Inicio rápido](/docs/product-bins/quickstart) — crea un bin, envíale una petición y léela de vuelta.
- [Reenvío](/docs/product-bins/forwarding) — reenvía cada petición a tu propio servidor y mira qué respondió.
- [Referencia de Request Bins](/docs/product-bins/reference) — todas las rutas y campos, qué responde la URL de un bin, roles, alcances y límites.
- [API de Request Bins](/docs/reference/bins) — todas las operaciones, con la petición en curl, TypeScript, Python o Go.
- [Errores](/docs/errors) — el formato de error y los códigos que envía la API.
