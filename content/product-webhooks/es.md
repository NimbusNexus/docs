---
title: "Webhooks"
description: "La plataforma de webhooks gestionada — publica un evento una vez y nosotros firmamos, reintentamos y reenviamos cada entrega a tus suscriptores."
publishedAt: 2026-08-05
updatedAt: 2026-10-19
kind: concept
---

# Webhooks

NimbusNexus Webhooks es un producto independiente para enviar webhooks a *tus* suscriptores. Publicas un evento una vez; nosotros lo repartimos entre todos los endpoints suscritos a ese tipo, firmamos cada entrega, reintentamos las que fallan y guardamos lo que nunca llega en una cola dead-letter que puedes reenviar.

> **¿No es la página que buscabas?** Si has llegado aquí para recibir notificaciones sobre *tu propia infraestructura de NimbusNexus* — `vm.created`, `snapshot.completed`, `invoice.generated` — esa es otra función, documentada en [Webhooks de la plataforma](/docs/webhooks). Son dos sistemas sin relación entre sí y **sus cabeceras de firma son distintas**, así que el código de verificación escrito para uno rechazará todas las entregas del otro.

La diferencia en una línea: los webhooks de la plataforma son eventos que *nosotros* te enviamos sobre tu cuenta; este producto entrega eventos que *tú* envías a tus propios clientes.

## Para qué sirve {#what-for}

Gestionar tú mismo la entrega de webhooks parece fácil hasta que deja de serlo. La entrega en sí es un POST — el trabajo es todo lo que la rodea: firmar para que los suscriptores puedan fiarse del payload, reintentar sin saturar un endpoint que ya está caído, mantener un cuerpo idéntico byte a byte entre reintentos para que las firmas sigan siendo válidas, desactivar los endpoints que llevan una semana fallando y dar a soporte una forma de responder "¿se envió?" con pruebas.

Este producto es esa maquinaria que lo rodea. También recibe en el otro sentido — las [fuentes](/docs/product-webhooks/sources) aceptan webhooks de Stripe, GitHub o cualquier otro que firme sus payloads — así que un solo sistema gestiona los dos lados de tu tráfico de webhooks.

## Los objetos {#objects}

| Objeto | Qué es |
|---|---|
| **Workspace** | Tu cuenta. Todo lo que tienes queda dentro de él y aislado de los demás workspaces. |
| **Proyecto** | Una agrupación dentro del workspace. Separar staging de producción son dos proyectos; también lo es tener dos productos en paralelo. Se identifica por id (`prj_…`). |
| **Evento** | Algo que ha ocurrido — un tipo como `order.created`, más un payload JSON. Lo publicas tú, o lo recibe una fuente. |
| **Fuente** | Una URL a la que un proveedor envía webhooks. Cada petición firmada se convierte en un evento. Consulta [Fuentes](/docs/product-webhooks/sources). |
| **Endpoint** | Una URL HTTPS registrada para recibir webhooks, con una o varias suscripciones. |
| **Suscripción** | Una regla de coincidencia de un endpoint: `exact`, `prefix`, `suffix` o `all`, más un patrón como `order.`. |
| **Entrega** | Un envío, con seguimiento de sus intentos, de un evento a un endpoint que coincide. Firmada, reintentada, observable. Consulta [Entregas y reintentos](/docs/product-webhooks/deliveries). |
| **Tipo de evento** | Una entrada del catálogo de nombres de tipo, con un JSON Schema opcional. Consulta [Tipos de evento](/docs/product-webhooks/event-types). |
| **Secreto de firma** | Secreto propio de cada endpoint con el que se firma con HMAC cada entrega. Se muestra **una sola vez**, al crearlo. |

Al publicar un evento, se compara con todos los endpoints activados cuyas suscripciones cubren ese tipo, y se crea una entrega por cada coincidencia. Si el workspace exige la [verificación de endpoints](/docs/product-webhooks/endpoint-verification), solo cuentan los endpoints verificados.

Sobre eso funcionan dos contadores, y la diferencia importa cuando eliges un plan. Una publicación es siempre un **evento**, y ese recuento, que no depende del reparto, es lo que `GET /v1/usage` muestra como `messages_used`. Pero la cuota mensual que **se aplica** cuenta *entregas* — una por cada endpoint que coincide — y por eso repartir un solo evento entre diez endpoints consume diez. El contador por evento se registra y pasará a ser la unidad de facturación; la cuota de entregas es el tope que de verdad rechaza una publicación hoy.

## Cómo se comporta una entrega {#delivery}

- **El cuerpo se construye una sola vez.** El sobre se serializa al publicar y se guarda byte a byte, así que cada reintento envía bytes idénticos. Cada *intento* se vuelve a firmar con un timestamp nuevo, lo que permite a tus suscriptores aplicar una ventana de replay estricta sin que una entrega que llega una hora más tarde falle la verificación.
- **Al menos una vez.** Los reintentos son reales; el mismo evento puede llegar dos veces. Deduplica por el id del evento, que viaja tanto en el cuerpo como en la cabecera `X-Webhook-Event-Id`.
- **Los reintentos se espacian.** Las entregas fallidas se reintentan con backoff exponencial hasta el `max_attempts` del endpoint. Un endpoint puede llevar un `retry_schedule` personalizado — una lista explícita de esperas en segundos — cuando la curva por defecto no le va bien al otro extremo.
- **Las entregas agotadas se guardan, no se descartan.** Van a la cola dead-letter, donde puedes filtrarlas y reenviarlas en bloque cuando el receptor esté sano.
- **Los endpoints que fallan de forma persistente se desactivan** automáticamente, y se registra el motivo. Enviamos un [webhook operativo](/docs/product-webhooks/deliveries#operational) `endpoint.disabled` a los endpoints operativos del workspace, así que suscribe uno para enterarte. Volver a activarlos es una acción explícita.

## Cómo orientarte en la consola {#console}

| Sección | Páginas | Para qué |
|---|---|---|
| **Build** | Sources, Endpoints, Event types | Configurar de dónde vienen los eventos y adónde van. |
| **Observe** | Events, Deliveries, Captured requests, Operational webhooks | Ver lo que llegó, lo que salió y lo que falló, y recibir un aviso cuando algo se rompe. |
| **Manage** | Audit log, Settings | Quién cambió qué; tu plan y tu consumo de Webhooks, la verificación y las herramientas para desarrolladores. |

La página Overview tiene botones para añadir una fuente o un endpoint y para enviar un evento de prueba, y guía a un workspace nuevo hasta su primera entrega.

## Publicar sin riesgos {#publishing}

Envía la cabecera `Idempotency-Key` en cada publicación. Así, una publicación reintentada devuelve el evento original en lugar de repartirse por segunda vez, lo que importa sobre todo justo en la situación que provoca los reintentos — un timeout en el que nunca supiste si la primera llamada había funcionado.

La misma clave con un cuerpo *distinto* se rechaza en lugar de aceptarse sin avisar, así que una colisión de claves aparece como un error en vez de como un evento descartado en silencio.

Para los productores que no pueden permitirse perder un evento cuando la API no está accesible, los SDKs incluyen un outbox de escritura previa: `enqueue()` guarda en local y vuelve sin hacer ninguna llamada de red, y un proceso de vaciado envía después lo pendiente con la misma garantía de idempotencia. Consulta [SDKs](/docs/product-webhooks/sdks).

## Cómo obtener acceso {#access}

Regístrate en Webhooks y obtendrás un workspace en el plan gratuito, que se crea la primera vez que inicias sesión en la consola. Los precios están en la [página de Webhooks](/webhooks).

Las claves no vienen con el workspace, y la API de Webhooks no las emite. La emites tú en tu consola de la cuenta de NimbusNexus, en **API keys**, eligiendo **Webhooks** como producto — Identity es el único emisor de claves de API para todos los productos. Una clave emitida por Identity es un JWT, así que empieza por `eyJ` en lugar de llevar un prefijo de producto. Se envía exactamente igual que antes: `Authorization: Bearer <key>`, o `X-API-Key: <key>`.

Elige el alcance al emitirla. `admin` da control total; `publish` puede producir eventos y no puede leer nada; `read` puede leerlo todo y no puede producir nada. `publish` y `read` son disjuntos, no una escala — una clave `publish` no puede listar entregas, y una clave `read` no puede publicar, así que un job que haga ambas cosas necesita `admin`. Al emitirla, una clave también se puede limitar a un solo proyecto.

> **Una clave `whsk_…` existente ya no sirve para autenticarse.** La familia `whsk_` ha desaparecido, y una petición que lleve una se rechaza como cualquier otra credencial no reconocida. Si tienes una, emite una de sustitución en la consola de la cuenta.

## Próximos pasos {#next-steps}

- [Inicio rápido](/docs/product-webhooks/quickstart) — registra un endpoint, publica un evento y verifica la entrega.
- [Fuentes](/docs/product-webhooks/sources) — recibe webhooks de Stripe, GitHub o cualquier emisor que firme con HMAC.
- [Entregas y reintentos](/docs/product-webhooks/deliveries) — estados, el calendario de reintentos y cómo volver a enviar.
- [Verificación de endpoints](/docs/product-webhooks/endpoint-verification) — el desafío que responde un endpoint antes de recibir eventos.
- [Tipos de evento](/docs/product-webhooks/event-types) — el catálogo, la política para los tipos desconocidos y los esquemas de payload.
- [Peticiones capturadas](/docs/product-webhooks/captured-requests) — las peticiones en bruto que llegaron a una fuente.
- [Verificación de firmas](/docs/product-webhooks/signatures) — el contrato de firma y las tres reglas para comprobarlo.
- [SDKs](/docs/product-webhooks/sdks) — clientes tipados para Python, TypeScript y Go.
- [CLI](/docs/product-webhooks/cli) — `nn-webhooks`, un único binario estático.
- [Webhooks de la plataforma](/docs/webhooks) — lo otro que se llama webhooks: notificaciones sobre tu propia infraestructura.
