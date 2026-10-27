---
title: "Configura un SDK"
description: "Instala el SDK de Webhooks para Python, TypeScript o Go, autentícalo con una clave de API y haz una primera llamada."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: sdk
---

# Configura un SDK

Webhooks tiene SDKs oficiales para Python, TypeScript y Go, todos en la versión {{WEBHOOKS_SDK_VERSION}}. Reintentan los fallos transitorios, verifican las firmas de los webhooks y pueden guardar eventos en buffer mientras la API no está disponible. Elige un lenguaje en la parte superior de la página y todos los ejemplos lo siguen.

Inboxes y códigos QR todavía no tienen SDK; llámalos [por REST](/docs/setup/rest). La [Referencia de la API](/docs/reference) muestra cada una de sus llamadas con el cliente HTTP habitual de tu lenguaje. Tampoco hay todavía SDKs para Infraestructura (VMs, almacenamiento, bases de datos).

## 1 · Instalación {#install}

```bash tab=python
pip install nn-webhooks-sdk
```

```bash tab=typescript
npm install @nimbusnexus/webhooks-sdk
```

```bash tab=go
go get github.com/NimbusNexus/webhooks-go@v{{WEBHOOKS_SDK_VERSION}}
```

Python necesita la 3.11 o posterior, TypeScript necesita Node.js 24 o posterior y Go necesita la 1.25 o posterior. El paquete de Python se instala como `nn-webhooks-sdk` y se importa como `nn_webhooks`.

## 2 · Autenticación {#auth}

Crea una clave de Webhooks en la [consola de tu cuenta]({{ACCOUNT_BASE_URL}}/api-keys), en **API keys**: los detalles están en [Obtén una clave de API](/docs/setup/rest#key). Después crea un cliente con ella. Lee la clave del entorno en lugar de escribirla en tu código.

```python
import os
from nn_webhooks import Client

wh = Client("{{WEBHOOKS_BASE_URL}}", api_key=os.environ["WEBHOOKS_API_KEY"])
```

```ts
import { WebhooksClient } from '@nimbusnexus/webhooks-sdk'

const wh = new WebhooksClient({
  baseUrl: '{{WEBHOOKS_BASE_URL}}',
  apiKey: process.env.WEBHOOKS_API_KEY!,
})
```

```go
import nnwh "github.com/NimbusNexus/webhooks-go"

ctx := context.Background()
client := nnwh.New("{{WEBHOOKS_BASE_URL}}", os.Getenv("WEBHOOKS_API_KEY"))
```

## 3 · Haz una primera llamada {#first-call}

Lista tus entregas recientes. Solo lee, así que cualquier clave `admin` o `read` puede ejecutarlo.

```python
page = wh.list_deliveries()
for d in page["items"]:
    print(d["id"], d["status"], d["attempts"])
```

```ts
const page = await wh.listDeliveries()
for (const d of page.items) console.log(d.id, d.status, d.attempts)
```

```go
page, err := client.ListDeliveries(ctx, nil)
if err != nil {
    log.Fatal(err)
}
for _, d := range page.Items {
    fmt.Println(d.Id, d.Status)
}
```

Una lista vacía significa que la clave funciona y que todavía no se ha entregado nada. Para publicar tu primer evento, sigue el [Inicio rápido de Webhooks](/docs/product-webhooks/quickstart).

## Próximos pasos {#next-steps}

- [SDKs de Webhooks](/docs/product-webhooks/sdks): verificación de firmas, publicación, el outbox duradero y la gestión de endpoints.
- [Referencia de la API de Webhooks](/docs/reference/webhooks): todas las operaciones, con la llamada del SDK cuando el SDK la tiene.
- [CLI](/docs/setup/cli): las mismas operaciones desde un shell.
