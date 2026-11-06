---
title: "Налаштування REST API"
description: "Отримайте API-ключ, надішліть його в одному заголовку та зробіть перший виклик API продукту NimbusNexus з curl, TypeScript, Python або Go."
publishedAt: 2026-10-19
updatedAt: 2026-11-06
kind: quickstart
---

# Налаштування REST API

Кожен продукт NimbusNexus — це REST API: JSON через HTTPS з вашим API-ключем у заголовку. Ця сторінка проведе вас від відсутності ключа до першого успішного виклику. Виберіть мову вгорі сторінки, і приклади перемкнуться на неї. REST означає `curl`; для TypeScript, Python і Go використовується звичайний HTTP-клієнт кожної мови, SDK не потрібен.

## 1 · Отримайте API-ключ {#key}

**Застосунки: Webhooks, Inboxes, QR-коди та Request Bins.** Відкрийте **API keys** у [консолі акаунта]({{ACCOUNT_BASE_URL}}/api-keys) і створіть ключ для продукту, який хочете викликати. Кожен ключ належить одному продукту. Там само виберіть його область дії: `admin`, `read`, а для Webhooks ще й `publish`. Скопіюйте ключ, щойно він зʼявиться, бо він показується лише один раз. Ключ застосунку — це JWT, тому він починається з `eyJ`.

**Інфраструктура: VM, сховище, мережа й DNS.** Створіть ключ у дашборді в розділі **Безпека → API-токени** з областю дії **Адміністрування** і скопіюйте значення з підписом **API-ключ** ([Швидкий старт](/docs/quickstart#api-key)). Він привʼязаний до одного проєкту. Ролі, правила доступу й заміну ключа описано на сторінці [Автентифікація](/docs/authentication).

Не тримайте ключ у вихідному коді. Експортуйте його в оболонці або зберігайте у сховищі секретів:

```bash
export WEBHOOKS_API_KEY="<your-api-key>"
```

## 2 · Надсилайте його в кожному запиті {#auth}

В API застосунків надсилайте ключ як bearer-токен. Вони також приймають його як `X-API-Key: <key>`.

```http
Authorization: Bearer <your-api-key>
```

В API інфраструктури надсилайте ключ у заголовку `X-API-Key`. Bearer-токен там — це сесія, у яку ви ввійшли, а не API-ключ.

```http
X-API-Key: <your-api-key>
```

Кожен продукт має власний базовий URL:

| Продукт | Базовий URL |
| --- | --- |
| Webhooks | `{{WEBHOOKS_BASE_URL}}/v1` |
| Inboxes | `{{INBOXES_BASE_URL}}/v1` |
| QR-коди | `{{QR_BASE_URL}}/v1` |
| Request Bins | `https://bins.nimbusnexus.net/v1` |
| Інфраструктура | `{{API_BASE_URL}}/api/v1` |

## 3 · Перший виклик {#first-call}

`GET /v1/auth/me` у Webhooks повертає дані про надісланий ключ: його область дії та робочий простір, якому він належить. Більше нічого він не читає, тому викликати його може будь-який дійсний ключ.

```bash
curl {{WEBHOOKS_BASE_URL}}/v1/auth/me \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY"
```

```ts
const res = await fetch('{{WEBHOOKS_BASE_URL}}/v1/auth/me', {
  headers: { Authorization: `Bearer ${process.env.WEBHOOKS_API_KEY}` },
})
console.log(await res.json())
```

```python
import os
import requests

res = requests.get(
    "{{WEBHOOKS_BASE_URL}}/v1/auth/me",
    headers={"Authorization": f"Bearer {os.environ['WEBHOOKS_API_KEY']}"},
)
print(res.json())
```

```go
req, err := http.NewRequest("GET", "{{WEBHOOKS_BASE_URL}}/v1/auth/me", nil)
if err != nil {
    log.Fatal(err)
}
req.Header.Set("Authorization", "Bearer "+os.Getenv("WEBHOOKS_API_KEY"))
res, err := http.DefaultClient.Do(req)
if err != nil {
    log.Fatal(err)
}
defer res.Body.Close()
```

У відповіді вказано ваш робочий простір:

```json
{
  "scope": "admin",
  "workspace_id": "{{WORKSPACE_ID}}"
}
```

Інші поля вказують, який це тип облікових даних. Для API-ключа `email` і `created_at` дорівнюють `null`.

В API інфраструктури те саме робить `GET /api/v1/account/get_session_auth_data`: його може викликати будь-який дійсний ключ, незалежно від його правил доступу. Далі [Швидкий старт](/docs/quickstart) проведе вас до першої VM.

```bash
export NIMBUS_KEY="<your-api-key>"

curl {{API_BASE_URL}}/api/v1/account/get_session_auth_data \
  -H "X-API-Key: $NIMBUS_KEY"
```

## 4 · Розбирайте помилки {#errors}

API застосунків відповідають на невдалий запит статусом 4xx або 5xx і єдиним форматом помилки:

```json
{
  "error": {
    "code": "unauthorized",
    "message": "…",
    "details": { "reason": "missing" },
    "request_id": "…"
  }
}
```

Розгалужуйте обробку за `code`, а не за статусом чи повідомленням. `unauthorized` означає, що ключ не надійшов або його відкликано. `invalid_credential` означає, що ключ недійсний: випустіть новий, бо повтор не допоможе. `forbidden` означає, що ключ дійсний, але не може виконати цю дію: бракує області дії чи ролі або продукт не ввімкнено для вашого робочого простору. Усі коди перелічено на сторінках [Автентифікація](/docs/authentication#errors) і [Помилки](/docs/errors). Звертаючись у підтримку, вказуйте `request_id`.

API інфраструктури відповідає інакше: із `success: false` і `message`, без кодів. Там розгалужуйте обробку за статусом ([Угоди](/docs/conventions#errors)).

## Що далі {#next-steps}

- [Довідник API](/docs/reference): усі операції всіх продуктів із викликом вашою мовою.
- [SDK](/docs/setup/sdk) і [CLI](/docs/setup/cli): ті самі виклики, але повтори, перевірку підписів і пагінацію вони беруть на себе.
- Швидкий старт для продуктів: [Webhooks](/docs/product-webhooks/quickstart), [Inboxes](/docs/product-inboxes/quickstart), [Request Bins](/docs/product-bins/quickstart), [ваша перша VM](/docs/quickstart).
