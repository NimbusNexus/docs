---
title: "SDK de TypeScript"
description: "Cliente tipado para la API REST de NimbusNexus. ESM + CJS, Node 20+, compatible con navegadores."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: sdk
---

# SDK de TypeScript

> **Estado: versión preliminar.** El SDK está en desarrollo activo. Esta página documenta la forma de la v1.0; hasta que se publique el paquete, usa directamente la API REST según [Autenticación](/docs/authentication) y [Convenciones](/docs/conventions).

Un cliente de TypeScript tipado que envuelve la API REST v1. Publicación dual ESM + CJS, Node 20+ y ejecución en el navegador. Se genera a partir de la especificación OpenAPI en producción, así que los tipos están sincronizados con la API por construcción.

> **¿Quieres enviar webhooks a tus propios clientes?** Para eso está el [producto Webhooks](/docs/product-webhooks), que es independiente y tiene su propio SDK de TypeScript publicado — [`@nimbusnexus/webhooks-sdk`](/docs/product-webhooks/sdks). Esta página trata del cliente de la API de la nube de NimbusNexus.

## Instalación (cuando se publique) {#install}

```bash
npm install @nimbusnexus/sdk
# or
pnpm add @nimbusnexus/sdk
# or
yarn add @nimbusnexus/sdk
```

## Uso rápido {#quick}

```ts
import { NimbusNexus } from '@nimbusnexus/sdk'

const nn = new NimbusNexus({
  apiKey: process.env.NIMBUS_KEY!, // never hardcode
})

// List VMs in a region
const { items, pagination } = await nn.vms.list({
  region: 'us-east-1',
  limit: 50,
})

// Create a VM
const vm = await nn.vms.create({
  name: 'web-01',
  size: 'gp-1-2',
  region: 'us-east-1',
  image: 'ubuntu-24.04',
})

// Poll until running
while (vm.state !== 'running') {
  await new Promise(r => setTimeout(r, 1000))
  Object.assign(vm, await nn.vms.get(vm.id))
}
```

## Principios de diseño {#design}

- **Tipado de principio a fin.** Cuerpos de petición, parámetros de query, formas de respuesta — cada endpoint expone su esquema OpenAPI completo como un tipo de TypeScript. Sin `any` ni conversiones con `as` en tu código.
- **Refleja la API REST.** `nn.vms.list()` es `GET /v1/vms`. `nn.databases.snapshots.list(dbId)` es `GET /v1/databases/{dbId}/snapshots`. Sin métodos de conveniencia a medida que se alejen de la API.
- **Idempotencia por defecto.** Cada llamada de escritura genera automáticamente una `Idempotency-Key` (UUID v4). Sustitúyela con `{ idempotencyKey: '...' }` si necesitas una clave estable entre reintentos por tu parte.
- **Reintenta los 429 y 5xx.** La configuración por defecto reintenta con backoff exponencial + jitter ante `429`, `502`, `503` y `504`. Desactívalo con `{ retries: 0 }` si prefieres gestionarlo tú.
- **Sin dependencias en tiempo de ejecución en el bundle del navegador.** En el servidor se añade `node:crypto` para los helpers de verificación HMAC; el bundle del navegador no tiene dependencias.

## Configuración {#config}

```ts
const nn = new NimbusNexus({
  apiKey: process.env.NIMBUS_KEY!,
  // All optional:
  baseUrl: '{{API_BASE_URL}}', // defaults to canonical
  timeout: 30_000,             // request timeout in ms
  retries: 3,                   // max retries on 429 / 5xx
  retryDelay: 1000,             // base delay; doubled per attempt with jitter
  userAgent: 'my-app/2.4',      // appended to the default `nimbusnexus-sdk/<ver>` UA
  fetch: customFetch,           // optional fetch implementation override
})
```

## Helper de verificación de webhooks {#webhooks}

```ts
import { verifyWebhook } from '@nimbusnexus/sdk/webhooks'

export async function POST(req: Request) {
  const body = await req.text()
  const ok = verifyWebhook({
    body,
    timestamp: req.headers.get('NN-Timestamp')!,
    signature: req.headers.get('NN-Signature')!,
    secret: process.env.NIMBUS_WEBHOOK_SECRET!,
  })
  if (!ok) return new Response('bad signature', { status: 401 })

  // handle event...
  return new Response('ok')
}
```

El verificador se encarga del HMAC + la comparación en tiempo constante + la comprobación de la ventana de replay. No escribas el tuyo propio — equivocarse en cualquiera de ellos es el patrón habitual de suplantación de webhooks.

## Helper de paginación {#pagination}

```ts
// Manual paging
for (const page of nn.vms.listPages({ region: 'us-east-1' })) {
  console.log(`got ${page.items.length} VMs`)
}

// Auto-flatten
for await (const vm of nn.vms.listAll({ region: 'us-east-1' })) {
  console.log(vm.name)
}
```

`listPages()` y `listAll()` son iteradores asíncronos que recorren el cursor por ti. Consulta [Paginación](/docs/pagination) para ver el mecanismo subyacente.

## Estado actual {#status}

El SDK se está generando a partir de la especificación OpenAPI, pero todavía no se ha publicado. Mientras tanto:

- Usa directamente la API REST. La autenticación y las convenciones están documentadas y son estables.
- La forma del SDK que muestra esta página es el diseño de API con el que nos comprometemos; no cambiará antes de la v1.0.
- Suscríbete al changelog en [{{BASE_URL}}/changelog]({{BASE_URL}}/changelog) para enterarte del anuncio de la versión.

## Próximos pasos {#next-steps}

- [Autenticación](/docs/authentication) — qué hace `apiKey` en la petición HTTP.
- [Webhooks de la plataforma](/docs/webhooks) — qué comprueba `verifyWebhook`.
- [Paginación](/docs/pagination) — qué recorren `listAll` y `listPages`.
