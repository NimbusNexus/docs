---
title: "SDK para TypeScript"
description: "Cliente tipado para a API REST da NimbusNexus. ESM + CJS, Node 20+, compatível com navegadores."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: sdk
---

# SDK para TypeScript

> **Status: pré-lançamento.** O SDK está em desenvolvimento ativo. Esta página documenta o formato da v1.0; até o pacote ser publicado, use a API REST diretamente, conforme [Autenticação](/docs/authentication) e [Convenções](/docs/conventions).

Um cliente TypeScript tipado que encapsula a API REST v1. Publicação dupla ESM + CJS, Node 20+, roda no navegador. Gerado a partir da especificação OpenAPI em produção, então os tipos ficam sincronizados com a API por construção.

> **Quer enviar webhooks para os seus próprios clientes?** Isso é o [produto Webhooks](/docs/product-webhooks), que é separado e tem o próprio SDK para TypeScript publicado — [`@nimbusnexus/webhooks-sdk`](/docs/product-webhooks/sdks). Esta página trata do cliente para a API de nuvem da NimbusNexus.

## Instalar (quando for lançado) {#install}

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

## Princípios de design {#design}

- **Tipado de ponta a ponta.** Corpos de requisição, parâmetros de query, formatos de resposta — todo endpoint expõe o schema OpenAPI completo como um tipo TypeScript. Sem `any` e sem casts com `as` no seu código.
- **Espelha a API REST.** `nn.vms.list()` é `GET /v1/vms`. `nn.databases.snapshots.list(dbId)` é `GET /v1/databases/{dbId}/snapshots`. Sem métodos de conveniência sob medida que se afastam da API.
- **Idempotência por padrão.** Toda chamada que altera dados gera um `Idempotency-Key` automaticamente (UUID v4). Substitua com `{ idempotencyKey: '...' }` se precisar de uma chave estável entre retentativas do seu lado.
- **Repete em 429 + 5xx.** A configuração padrão tenta de novo com backoff exponencial + jitter em `429`, `502`, `503`, `504`. Desative com `{ retries: 0 }` se quiser tratar isso você mesmo.
- **Sem dependências de runtime no bundle do navegador.** No lado do servidor, entra o `node:crypto` para os helpers de verificação HMAC; o bundle do navegador não tem dependências.

## Configuração {#config}

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

## Helper de verificação de webhooks {#webhooks}

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

O verificador cuida do HMAC + comparação em tempo constante + verificação da janela de replay. Não implemente o seu próprio — errar qualquer uma dessas partes é o padrão clássico de falsificação de webhooks.

## Helper de paginação {#pagination}

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

`listPages()` e `listAll()` são iteradores assíncronos que percorrem o cursor por você. Veja [Paginação](/docs/pagination) para entender o mecanismo por trás.

## Situação atual {#status}

O SDK está sendo gerado a partir da especificação OpenAPI, mas ainda não foi publicado. Enquanto isso:

- Use a API REST diretamente. A autenticação + as convenções estão documentadas e estáveis.
- O formato do SDK nesta página é o design de API com o qual estamos nos comprometendo; ele não vai mudar antes da v1.0.
- Inscreva-se no changelog em [{{BASE_URL}}/changelog]({{BASE_URL}}/changelog) para receber o anúncio do lançamento.

## Próximos passos {#next-steps}

- [Autenticação](/docs/authentication) — o que o `apiKey` faz no nível do HTTP.
- [Webhooks da plataforma](/docs/webhooks) — o que o `verifyWebhook` está verificando.
- [Paginação](/docs/pagination) — o que o `listAll` e o `listPages` estão percorrendo.
