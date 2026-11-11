---
title: "Швидкий старт Transforms"
description: "Протестуйте конвеєр на запиті, збережіть його, запустіть, подивіться, як запит відкидається, і збережіть нову версію — через API."
publishedAt: 2026-11-06
updatedAt: 2026-11-11
kind: quickstart
---

# Швидкий старт Transforms

Від нуля до конвеєра з версіями за кілька хвилин. Ви протестуєте конвеєр на запиті, збережете його, запустите, побачите, як запит відкидається, і збережете нову версію. Щоб побачити, що робить конвеєр, ще до входу в акаунт, спробуйте [playground](/transforms/playground).

## Перш ніж почати {#before}

Створіть API-ключ у [консолі акаунта]({{ACCOUNT_BASE_URL}}/api-keys?product=transforms) для продукту **Transforms** з дозволом **Read & write**. Для всього, що описано тут, достатньо Free. Потім збережіть ключ у змінній середовища:

```bash
export TRANSFORMS_API_KEY="<your-api-key>"
```

Усі шляхи нижче відносні до `https://transforms.nimbusnexus.net`, і кожен запит містить `Authorization: Bearer <your key>`.

## 1. Протестуйте конвеєр {#test}

Цей конвеєр залишає оплачені рахунки на суму від $1,000, вилучає email клієнта й будь-які номери телефону, а також додає два поля й заголовок. `POST /v1/pipelines/test` один раз виконує документ на запиті, який ви надсилаєте, і нічого не зберігає й не рахує:

```bash
curl -X POST https://transforms.nimbusnexus.net/v1/pipelines/test \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } },
        { "headers": { "set": { "X-Event-Type": "{{ type }}" } } }
      ]
    },
    "body": {
      "type": "invoice.paid",
      "data": {
        "id": "in_42",
        "amount": 150000,
        "currency": "usd",
        "customer": { "name": "Ana Silva", "email": "ana@example.com", "phone": "+1 202 555 0142" }
      }
    }
  }'
```

```json
{
  "status": "ok",
  "version": null,
  "body": {
    "type": "invoice.paid",
    "data": {
      "id": "in_42",
      "amount": 150000,
      "currency": "usd",
      "customer": { "name": "Ana Silva" }
    },
    "event_type": "invoice.paid",
    "amount_display": "1,500.00 USD"
  },
  "body_changed": true,
  "headers": { "X-Event-Type": "invoice.paid" },
  "query": {},
  "step": null,
  "note": null,
  "reason": null,
  "error": null,
  "duration_ms": 0.4
}
```

`status` дорівнює `ok`, тож `body` і `headers` — це те, що треба надіслати. `version` дорівнює `null`, бо ще нічого не збережено.

## 2. Збережіть його {#save}

Збережіть той самий документ як конвеєр, із назвою:

```bash
curl -X POST https://transforms.nimbusnexus.net/v1/pipelines \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Paid invoices",
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } },
        { "headers": { "set": { "X-Event-Type": "{{ type }}" } } }
      ]
    }
  }'
```

Відповідь — `201` з [конвеєром](/docs/product-transforms/reference#pipeline); тут її скорочено:

```json
{
  "id": "pipe_8e27d40b19c3f6a5e0d71b42",
  "name": "Paid invoices",
  "status": "enabled",
  "current_version": 1,
  "destinations": [],
  "consumers": []
}
```

Збережіть `id`: його приймають усі подальші виклики.

```bash
export PIPELINE_ID="pipe_8e27d40b19c3f6a5e0d71b42"
```

## 3. Запустіть його {#run}

Надішліть запит на збережений конвеєр. Запуск приймає `body`, а також, за бажанням, `headers` і `meta`, і відповідає, що зробив конвеєр:

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body": {"type": "invoice.paid", "data": {"id": "in_42", "amount": 150000, "currency": "usd"}}}'
```

Відповідь має той самий формат, що й у тесті, із `"version": 1`. Про запит нічого не зберігається, а запуск додає одиницю до кількості за місяць у `GET /v1/usage`. Надсилати результат далі — уже ваше завдання: сам Transforms нічого не надсилає.

## 4. Подивіться, як запит відкидається {#dropped}

Надішліть рахунок на суму, меншу за вказану у фільтрі:

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body": {"type": "invoice.paid", "data": {"id": "in_43", "amount": 99999, "currency": "usd"}}}'
```

```json
{
  "status": "dropped",
  "version": 1,
  "body": null,
  "body_changed": false,
  "headers": {},
  "query": {},
  "step": 0,
  "note": "Paid invoices of $1,000 or more",
  "reason": "no_match",
  "error": "dropped by step 0 (Paid invoices of $1,000 or more)",
  "duration_ms": 0.1
}
```

Це все одно `200`, бо конвеєр виконався. `step` рахується з 0, а `reason` дорівнює `no_match`, коли запит не збігся з фільтром. У такому разі нічого не надсилайте.

## 5. Збережіть нову версію {#version}

Змініть конвеєр через `PATCH`, передавши новий документ — тут без кроку заголовків:

```bash
curl -X PATCH "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } }
      ]
    }
  }'
```

Тепер `current_version` дорівнює `2`, і запуски використовують цю версію. Версія 1 не змінилася: `GET /v1/pipelines/{id}/versions` перелічує збережені версії, а запуск і далі може вказати одну з них:

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"version": 1, "body": {"type": "invoice.paid", "data": {"id": "in_42", "amount": 150000, "currency": "usd"}}}'
```

Щоб повернутися до версії 1, збережіть її вміст ще раз: так вона стане версією 3.

## У консолі {#console}

Консоль за адресою `https://transforms.nimbusnexus.net` робить усе це за допомогою форми для кожного кроку: **Filter**, **Remove fields**, **Set fields**, **Reshape the body**, **Headers** і **Credential**. **Start from a template** пропонує повідомлення Slack, Discord і Teams, Keep only these fields і Drop personal data, а **JSON** показує весь документ. Протестуйте те, що в редакторі, перш ніж зберегти.

## Прибирання {#cleanup}

Кожен план обмежує кількість конвеєрів, які можна мати, тож видаліть цей, коли закінчите:

```bash
curl -X DELETE "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY"
```

Видалення **остаточне** — і для конвеєра, і для кожної його версії. Щоб натомість тимчасово зупинити його виконання, змініть його через `PATCH` на `{"status": "disabled"}`, а пізніше — назад на `{"status": "enabled"}`. Вимкнений конвеєр відповідає на запуск `409` `conflict`, `pipeline_disabled`.

## Що далі {#next-steps}

- [Конвеєри](/docs/product-transforms/pipelines) — усі кроки, шляхи, фільтри й шаблони.
- [Довідник Transforms](/docs/product-transforms/reference) — усі маршрути й поля, ролі, ліміти й помилки.
- [API Transforms](/docs/reference/transforms) — усі операції із запитом у curl, TypeScript, Python або Go.
- [Огляд продукту](/docs/product-transforms) — облікові дані, плани і чого Transforms не робить.
