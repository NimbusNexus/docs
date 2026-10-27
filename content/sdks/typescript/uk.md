---
title: "SDK для TypeScript"
description: "Типізований клієнт для REST API NimbusNexus. ESM + CJS, Node 20+, працює і в браузері."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: sdk
---

# SDK для TypeScript

> **Статус: попередня версія.** SDK активно розробляється. Ця сторінка описує форму v1.0; доки пакет не опубліковано, використовуйте REST API напряму, як описано на сторінках [Автентифікація](/docs/authentication) і [Угоди](/docs/conventions).

Типізований клієнт для TypeScript — обгортка над REST API v1. Подвійна публікація ESM + CJS, Node 20+, працює в браузері. Згенерований з актуальної специфікації OpenAPI, тож типи синхронізовані з API за самою побудовою.

> **Надсилаєте вебхуки своїм клієнтам?** Для цього є окремий [продукт Webhooks](/docs/product-webhooks) із власним опублікованим SDK для TypeScript — [`@nimbusnexus/webhooks-sdk`](/docs/product-webhooks/sdks). Ця сторінка — про клієнт для хмарного API NimbusNexus.

## Встановлення (після випуску) {#install}

```bash
npm install @nimbusnexus/sdk
# or
pnpm add @nimbusnexus/sdk
# or
yarn add @nimbusnexus/sdk
```

## Швидкий приклад {#quick}

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

## Принципи дизайну {#design}

- **Типізація від початку до кінця.** Тіла запитів, параметри query, форми відповідей — кожен ендпоінт надає свою повну схему OpenAPI як тип TypeScript. Жодних `any`, жодних приведень `as` у вашому коді.
- **Віддзеркалює REST API.** `nn.vms.list()` — це `GET /v1/vms`. `nn.databases.snapshots.list(dbId)` — це `GET /v1/databases/{dbId}/snapshots`. Жодних власних зручних методів, що розходяться з API.
- **Ідемпотентність за замовчуванням.** Кожен виклик, що змінює дані, автоматично генерує `Idempotency-Key` (UUID v4). Перевизначте через `{ idempotencyKey: '...' }`, якщо вам потрібен стабільний ключ між повторами на вашому боці.
- **Повтори для 429 + 5xx.** Конфігурація за замовчуванням повторює запити з експоненційним backoff + jitter на `429`, `502`, `503`, `504`. Вимкніть через `{ retries: 0 }`, якщо хочете обробляти це самостійно.
- **Жодних залежностей під час виконання в браузерному бандлі.** На сервері додається `node:crypto` для хелперів перевірки HMAC; браузерний бандл не має залежностей.

## Налаштування {#config}

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

## Хелпер перевірки вебхуків {#webhooks}

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

Функція перевірки бере на себе HMAC, порівняння за сталий час і перевірку replay-вікна. Не пишіть власну реалізацію — помилка в будь-якому з цих пунктів і є типовим сценарієм підробки вебхуків.

## Хелпер пагінації {#pagination}

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

`listPages()` і `listAll()` — асинхронні ітератори, які самі обходять сторінки за курсором. Як це працює всередині, див. на сторінці [Пагінація](/docs/pagination).

## Поточний стан {#status}

SDK генерується зі специфікації OpenAPI, але ще не опублікований. Поки що:

- Використовуйте REST API напряму. Автентифікація й угоди задокументовані та стабільні.
- Форма SDK на цій сторінці — це дизайн API, якого ми зобовʼязуємося дотримуватися; до v1.0 вона не зміниться.
- Підпишіться на журнал змін за адресою [{{BASE_URL}}/changelog]({{BASE_URL}}/changelog), щоб отримати оголошення про реліз.

## Що далі {#next-steps}

- [Автентифікація](/docs/authentication) — що `apiKey` робить на рівні запитів.
- [Вебхуки платформи](/docs/webhooks) — що саме перевіряє `verifyWebhook`.
- [Пагінація](/docs/pagination) — що саме обходять `listAll` і `listPages`.
