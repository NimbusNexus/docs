---
title: "Webhooks de la plataforma"
description: "Suscríbete a los eventos del ciclo de vida de tu infraestructura. Peticiones POST firmadas con HMAC a una URL que tú controlas."
publishedAt: 2026-05-20
updatedAt: 2026-08-05
kind: concept
---

# Webhooks de la plataforma

Los webhooks de la plataforma son la forma en que NimbusNexus avisa a tus sistemas cuando algo cambia — una VM termina de provisionarse, se completa un snapshot, se genera una factura. Tú registras una URL; nosotros le enviamos por POST un payload JSON cada vez que se dispara el evento correspondiente.

> **¿Buscas el producto Webhooks?** Si quieres enviar webhooks a *tus propios* clientes — publicar un evento y que nosotros firmemos, reintentemos y reenviemos cada entrega —, eso es un producto aparte, documentado en [Webhooks (producto)](/docs/product-webhooks). Esta página trata solo de las notificaciones que NimbusNexus te envía *a ti* sobre tu propia infraestructura. **Los dos usan cabeceras de firma distintas**, así que el código de verificación no es intercambiable.

Los webhooks te permiten reaccionar a los cambios de estado sin hacer polling. El polling funciona, pero a gran escala es un derroche (la mayoría de las peticiones devuelven "no ha cambiado nada") y a pequeña escala es lento (solo te enteras de un cambio en el siguiente ciclo de polling). Los webhooks invierten el modelo — te avisamos en el momento en que ocurre algo.

## Cómo es una entrega {#delivery}

```http
POST /webhooks/nimbusnexus HTTP/1.1
Host: your-app.example.com
Content-Type: application/json
NN-Event: vm.created
NN-Delivery-Id: del_01HG7Y3...
NN-Timestamp: 1763410800
NN-Signature: sha256=4d2c8f19e6b07d3f...

{
  "event": "vm.created",
  "occurred_at": "2026-05-20T18:30:00Z",
  "data": {
    "id": "vm_01HG7Y3...",
    "name": "web-01",
    "state": "running",
    "ipv4": "203.0.113.5"
  }
}
```

Cada entrega lleva cuatro cabeceras:

- `NN-Event` — el tipo de evento (`vm.created`, `snapshot.completed`, etc.)
- `NN-Delivery-Id` — único por entrega; puedes usarlo sin riesgo como clave de idempotencia en tu lado
- `NN-Timestamp` — segundos de epoch Unix en el momento de la entrega; se usa en la firma
- `NN-Signature` — HMAC-SHA256 sobre `{timestamp}.{body}`, codificado en hexadecimal

## Cómo verificar la firma {#signature}

La firma demuestra que la entrega viene de NimbusNexus y no de alguien que ha adivinado la URL de tu webhook. Verifícala en tu handler antes de hacer nada más:

```ts
import crypto from 'node:crypto'

function verifyWebhook(req: Request, secret: string): boolean {
  const timestamp = req.headers.get('NN-Timestamp')!
  const signature = req.headers.get('NN-Signature')!.replace(/^sha256=/, '')
  const body = req.bodyText // raw body, not parsed JSON

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex')

  // Constant-time compare avoids timing oracles
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  )
}
```

El secreto se obtiene en el panel al crear el endpoint del webhook. Guárdalo en tu gestor de secretos, no en el código fuente — permite a cualquiera falsificar entregas.

Rechaza también las entregas cuyo timestamp se desvíe más de 5 minutos del reloj de tu servidor. Así acotas la ventana de replay si el secreto llega a filtrarse.

## Tipos de evento {#events}

Todo recurso que tiene un ciclo de vida emite eventos. Los más habituales:

| Evento | Cuándo |
|---|---|
| `vm.created` | Una VM ha terminado de provisionarse y está en `running` |
| `vm.state_changed` | Una VM ha pasado de un estado a otro, sean cuales sean |
| `vm.deleted` | Se ha destruido una VM |
| `snapshot.completed` | Un snapshot ha terminado de copiarse |
| `backup.completed` | Ha terminado un backup programado |
| `database.upgrade_completed` | Ha terminado una actualización del motor de una base de datos gestionada |
| `floating_ip.attached` / `floating_ip.detached` | Cambios de asociación |
| `invoice.generated` | Se ha cerrado una factura mensual |
| `payment.succeeded` / `payment.failed` | Resultados de los pagos |
| `quota.warning` | El proyecto ha superado el 90 % de alguna cuota |

La lista completa de tipos de evento está en la referencia de la API de cada recurso (el campo `events` del recurso muestra lo que emite).

## Semántica de entrega {#delivery-semantics}

- **Al menos una vez.** Una red inestable o un handler lento pueden hacer que reintentemos. Usa `NN-Delivery-Id` para deduplicar en tu lado.
- **El orden no está garantizado.** Dos eventos disparados con ~1 segundo de diferencia pueden llegar desordenados. El campo `occurred_at` del payload te indica el orden real; ordena por él si te importa.
- **Reintentos:** las entregas fallidas (una respuesta que no es 2xx, o un timeout > 10 s) se reintentan con backoff exponencial a los 1, 5, 25, 125 y 625 segundos. Cinco intentos en total. Después, la entrega se descarta; la mostramos en el apartado "failed deliveries" del panel durante 14 días.
- **Timeout:** tu handler tiene 10 segundos para devolver un 2xx. Si necesitas hacer más trabajo, ponlo en una cola y confirma el webhook de inmediato.

## Próximos pasos {#next-steps}

- [Autenticación](/docs/authentication) — cómo funcionan las claves de API (no los secretos de los webhooks).
- [Idempotencia](/docs/idempotency) — el patrón que esta página recomienda para gestionar los reintentos.
- [Convenciones](/docs/conventions) — formatos de error, códigos de estado y el resto del formato de las peticiones.
