---
title: "Швидкий старт Webhooks"
description: "Зареєструйте ендпоінт, опублікуйте подію й перевірте підписану доставку — три запити й обробник."
publishedAt: 2026-08-05
updatedAt: 2026-10-19
kind: quickstart
---

# Швидкий старт Webhooks

Від нуля до перевіреної доставки. Ви зареєструєте ендпоінт для отримання, опублікуєте на нього подію й перевірите підпис вебхука, що надійде.

## Перш ніж почати {#before}

Вам знадобляться дві речі:

- **API-ключ з областю дії `admin`.** Випустіть його в консолі акаунта NimbusNexus у розділі **API keys**, вибравши продукт **Webhooks** та область дії `admin`. Області дії описано в [огляді продукту](/docs/product-webhooks#access). Збережіть ключ у змінній оболонки:

  ```bash
  export ADMIN_KEY="eyJ…"
  ```

- **Публічний HTTPS URL, на якому працює ваш обробник.** Ми доставляємо через інтернет, тож `localhost` не підійде. Для першого тесту підійде тунель до вашого ноутбука (`cloudflared tunnel --url http://localhost:3000` або ngrok).

Усі шляхи нижче відносні до `{{WEBHOOKS_BASE_URL}}`.

## 1. Зареєструйте ендпоінт {#endpoint}

Ендпоінт — це HTTPS URL, на який ми доставляємо, плюс підписки, які визначають, які типи подій він отримує. Цей ендпоінт отримує все, що починається з `order.`:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "url": "https://your-app.example/webhooks",
        "subscriptions": [{"match_kind": "prefix", "pattern": "order."}]
      }'
```

Відповідь містить ендпоінт і його **секрет підпису**:

```json
{
  "id": "ep_3f9a…",
  "url": "https://your-app.example/webhooks",
  "status": "enabled",
  "health": "healthy",
  "subscriptions": [{ "match_kind": "prefix", "pattern": "order." }],
  "secret": "whsec_…"
}
```

Секрет показується **один раз**. Збережіть його в менеджері секретів одразу: саме ним ви перевіряєте доставки, і прочитати його повторно неможливо. Якщо ви його втратите, ротуйте секрет і оновіть обробник.

`match_kind` приймає `exact`, `prefix`, `suffix` або `all`. Починайте з вузьких підписок: підписка `all` на отримувачі, який розуміє лише два типи подій, означає, що вам доведеться писати в обробнику фільтр, який за вас могла б зробити підписка.

**Якщо ваш робочий простір вимагає верифікації ендпоінтів**, ендпоінт нічого не отримує, доки не пройде одноразовий challenge: ми надсилаємо POST-запит `webhook.verify` з токеном, а ваш обробник відповідає 2xx з цим токеном у тілі. Цього може вимагати план, а ввімкнути це може будь-який робочий простір; сторінка **Settings** у консолі показує, чи вимагає цього ваш. Додайте до обробника кілька рядків зі сторінки [Верифікація ендпоінтів](/docs/product-webhooks/endpoint-verification#handler), а потім:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a…/verify \
  -H "Authorization: Bearer $ADMIN_KEY"
```

`"verified": true` у відповіді означає, що верифікацію пройдено.

## 2. Опублікуйте подію {#publish}

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123-created" \
  -d '{
        "event_type": "order.created",
        "payload": {"order_id": "ord_123", "total": 4200}
      }'
```

Поле називається `event_type`, а не `type`: `type` — це назва поля всередині *доставленого* конверта, а це інший обʼєкт. Якщо надіслати тут `type`, буде `422`.

Відповідь показує, що дала публікація:

```json
{
  "id": "evt_0b6e2c8f4a1d4e7b9c3f5a8d2e6b1c4f",
  "event_uid": "8f1c2e4a9b7d4c3e8a6f5b2d1c0e9a7b",
  "event_type": "order.created",
  "source": null,
  "project_id": "prj_5d2a9c7e1b4f4a8d9e3c6b1a7f2e8d4c",
  "deliveries_created": 1,
  "skipped_unverified": 0
}
```

`id` — ідентифікатор події в API (`GET /v1/events/{id}`). `event_uid` — ідентифікатор, який отримує ваш ендпоінт: як `id` конверта й у заголовку `X-Webhook-Event-Id`. Дедуплікуйте саме за ним.

`deliveries_created: 0` — найчастіша несподіванка під час першого запуску, і в неї дві причини:

- **Жоден ендпоінт не підписаний на цей тип.** Порівняйте шаблон підписки ендпоінта з типом, який ви надіслали.
- **Відповідні ендпоінти не верифіковано**, а ваш робочий простір вимагає верифікації. Їх рахує `skipped_unverified`; [верифікуйте ендпоінт](/docs/product-webhooks/endpoint-verification) і опублікуйте знову.

Саме заголовок `Idempotency-Key` дає змогу безпечно повторювати публікацію: повторний запит із тим самим ключем повертає початкову подію замість нового розгалуження.

## 3. Перевірте доставку {#verify}

Вебхук надходить на ваш URL як POST-запит, тіло якого — подія всередині конверта:

```json
{"created_at":"2026-10-19T15:04:12.483211+00:00","data":{"order_id":"ord_123","total":4200},"id":"8f1c2e4a9b7d4c3e8a6f5b2d1c0e9a7b","type":"order.created","version":"1"}
```

`data` — опублікований вами payload, `id` — `event_uid`, `type` — тип події. Перевіряйте підпис, перш ніж щось робити: обробник, який цього не робить, оброблятиме будь-що, що знайде ваш URL.

```python
import hashlib, hmac, time

def handle(request):
    secret = ENDPOINT_SIGNING_SECRET          # from step 1
    timestamp = request.headers["X-Webhook-Timestamp"]
    signature = request.headers["X-Webhook-Signature"]
    raw_body = request.body                   # RAW bytes — never re-serialize the JSON

    # 1. Reject anything outside the replay window.
    if abs(int(time.time()) - int(timestamp)) > 300:
        return Response(status_code=400)

    # 2. Recompute and compare in constant time. The header carries one token normally, but
    #    several comma-separated ones during a secret rotation — accept if ANY matches.
    expected = "sha256=" + hmac.new(
        secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()
    if not any(hmac.compare_digest(expected, t.strip()) for t in signature.split(",")):
        return Response(status_code=400)

    # 3. Only now is the payload trustworthy.
    process(request.json())
    return Response(status_code=200)          # 2xx = delivered; anything else retries
```

Підпис сирих байтів, а не повторно закодованого обʼєкта, — деталь, на якій часто спотикаються: розбір і повторна серіалізація JSON змінюють порядок ключів і пробіли, а підпис обчислено саме по тих байтах, які надіслали ми. Прочитайте тіло один раз, збережіть його, перевірте, а потім розбирайте.

Повний контракт — кожен заголовок і причину кожного правила — описано на сторінці [Перевірка підпису](/docs/product-webhooks/signatures). [SDK](/docs/product-webhooks/sdks) мають хелпер `verify`, який реалізує все це, — це рекомендований шлях.

## 4. Переконайтеся, що доставка дійшла {#confirm}

```bash
curl -s "{{WEBHOOKS_BASE_URL}}/v1/deliveries?status=dead" \
  -H "Authorization: Bearer $ADMIN_KEY"
```

Порожній масив `items` означає, що жодна доставка не вичерпала повторів. Якщо ваш обробник не працював під час кроку 2, доставка буде тут: виправте обробник, а потім переграйте її:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/deliveries/dlv_456/redeliver \
  -H "Authorization: Bearer $ADMIN_KEY"
```

## Що далі {#next-steps}

- [Перевірка підпису](/docs/product-webhooks/signatures) — повний контракт підпису.
- [Доставки та повтори](/docs/product-webhooks/deliveries) — що відбувається, коли ваш обробник не працює.
- [Джерела](/docs/product-webhooks/sources) — приймайте так само вебхуки від Stripe, GitHub та інших.
- [SDK](/docs/product-webhooks/sdks) — обійдіться без власноруч написаного HMAC.
- [CLI](/docs/product-webhooks/cli) — ті самі операції без curl.
- [Огляд Webhooks](/docs/product-webhooks) — обʼєкти, семантика доставки й ідемпотентність.
