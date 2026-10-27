---
title: "Налаштування SDK"
description: "Встановіть SDK Webhooks для Python, TypeScript або Go, налаштуйте автентифікацію з API-ключем і зробіть перший виклик."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: sdk
---

# Налаштування SDK

У Webhooks є офіційні SDK для Python, TypeScript і Go, усі версії {{WEBHOOKS_SDK_VERSION}}. Вони повторюють запити після тимчасових збоїв, перевіряють підписи вебхуків і можуть буферизувати події, поки API недоступний. Виберіть мову вгорі сторінки, і всі приклади перемкнуться на неї.

Для Inboxes і QR-кодів SDK поки немає; викликайте їх [через REST](/docs/setup/rest). [Довідник API](/docs/reference) показує кожен їхній виклик через звичайний HTTP-клієнт вашої мови. SDK для інфраструктури (VM, сховище, бази даних) теж поки немає.

## 1 · Встановлення {#install}

```bash tab=python
pip install nn-webhooks-sdk
```

```bash tab=typescript
npm install @nimbusnexus/webhooks-sdk
```

```bash tab=go
go get github.com/NimbusNexus/webhooks-go@v{{WEBHOOKS_SDK_VERSION}}
```

Для Python потрібна версія 3.11 або новіша, для TypeScript — Node.js 24 або новіший, для Go — 1.25 або новіша. Пакет для Python встановлюється як `nn-webhooks-sdk`, а імпортується як `nn_webhooks`.

## 2 · Налаштуйте автентифікацію {#auth}

Створіть ключ Webhooks у [консолі акаунта]({{ACCOUNT_BASE_URL}}/api-keys) в розділі **API keys**: подробиці — у розділі [Отримайте API-ключ](/docs/setup/rest#key). Потім створіть із ним клієнт. Читайте ключ зі змінної середовища, а не записуйте його в код.

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

## 3 · Перший виклик {#first-call}

Отримайте список останніх доставок. Цей виклик лише читає дані, тож його може виконати будь-який ключ `admin` або `read`.

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

Порожній список означає, що ключ працює, а доставок ще не було. Щоб опублікувати першу подію, пройдіть [Швидкий старт Webhooks](/docs/product-webhooks/quickstart).

## Що далі {#next-steps}

- [SDK Webhooks](/docs/product-webhooks/sdks): перевірка підписів, публікація, надійний outbox, керування ендпоінтами.
- [Довідник API Webhooks](/docs/reference/webhooks): усі операції з викликом SDK, якщо SDK його має.
- [CLI](/docs/setup/cli): ті самі операції з командного рядка.
