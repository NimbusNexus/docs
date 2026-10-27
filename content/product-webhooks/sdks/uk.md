---
title: "SDK Webhooks"
description: "Типізовані клієнти для Python, TypeScript і Go: перевіряйте вхідні вебхуки, публікуйте події й керуйте ендпоінтами з коду."
publishedAt: 2026-08-05
updatedAt: 2026-10-20
kind: sdk
---

# SDK Webhooks

> **Статус: опубліковано.** SDK для Python, TypeScript і Go доступні в публічних реєстрах у версії {{WEBHOOKS_SDK_VERSION}}. SDK для Java і PHP написано й протестовано, але ще не опубліковано — див. [поточний стан](#status).

Офіційні клієнти для [NimbusNexus Webhooks](/docs/product-webhooks). Кожен виконує ті самі чотири завдання, тож команда, яка використовує дві мови, отримує однакову поведінку в обох. Виберіть мову вгорі сторінки, і всі приклади перемкнуться на неї; [Налаштування SDK](/docs/setup/sdk) — коротка версія: встановлення, автентифікація й перший виклик.

> **Це клієнти для Webhooks.** SDK для Інфраструктури (VM, сховище, мережа) поки що недоступні; викликайте той API [через REST](/docs/setup/rest). У прикладах на Go імпорт має псевдонім `nnwh`, щоб було видно, звідки він.

Найцінніша частина — `verify`. Перевірка підпису критична для безпеки, у ній легко припуститися непомітної помилки, і така помилка проходить усі функціональні тести, — тож SDK реалізують [повний контракт](/docs/product-webhooks/signatures), включно з порівнянням за сталий час і replay-вікном.

## Встановлення {#install}

```bash tab=python
pip install nn-webhooks-sdk
```

```bash tab=typescript
npm install @nimbusnexus/webhooks-sdk
```

```bash tab=go
go get github.com/NimbusNexus/webhooks-go@v{{WEBHOOKS_SDK_VERSION}}
```

## Перевірте вхідний вебхук {#verify}

Для всіх, хто *отримує* вебхуки. Передавайте сирі байти тіла — ніколи не повторно серіалізований обʼєкт.

```python
from nn_webhooks import verify

ok = verify(
    secret=ENDPOINT_SIGNING_SECRET,
    raw_body=request.body,
    signature=request.headers["X-Webhook-Signature"],
    timestamp=request.headers["X-Webhook-Timestamp"],
)
if not ok:
    return Response(status_code=400)   # forged, tampered, or outside the 300s window
```

```ts
import { verify } from "@nimbusnexus/webhooks-sdk";

const ok = verify(secret, rawBody, req.headers["x-webhook-signature"], {
  timestamp: req.headers["x-webhook-timestamp"],
});
if (!ok) return res.status(400).end();
```

```go
import nnwh "github.com/NimbusNexus/webhooks-go"

ts, _ := strconv.ParseInt(r.Header.Get("X-Webhook-Timestamp"), 10, 64)
ok := nnwh.Verify(secret, body, r.Header.Get("X-Webhook-Signature"),
    &nnwh.VerifyOptions{Timestamp: &ts})
```

Завжди передавайте timestamp. Без нього підпис обчислюється лише по тілу, а це ніколи не збігається з тим, що надсилаємо ми, — тож перевірка провалюється для *всього*, а не лише для реплеїв. Якщо `verify` повертає false для доставок, які ви вважаєте справжніми, першим перевірте, чи передано timestamp.

## Опублікуйте подію {#publish}

Для *продюсерів*. Тимчасові збої — помилки зʼєднання, `429`, `5xx` — повторюються з backoff, а для `429` враховується `Retry-After`. Інші `4xx` викидають виняток.

Ключ випускається в консолі акаунта NimbusNexus — див. [Як отримати доступ](/docs/product-webhooks#access). Ключ `whsk_…`, створений до цієї зміни, відхиляється як нерозпізнані облікові дані, а жоден SDK не перевіряє формат ключа, тож збій проявляється як `403` `invalid_credential` від API, а не як помилка під час створення клієнта.

```python
from nn_webhooks import Client, WebhooksAPIError

with Client("{{WEBHOOKS_BASE_URL}}", api_key=WEBHOOKS_API_KEY) as wh:
    try:
        event = wh.publish(
            "order.created",
            {"order_id": "ord_123", "total": 4200},
            idempotency_key="order-123",     # makes the publish safe to retry
        )
        print(event.event_uid, event.deliveries_created)
    except WebhooksAPIError as e:
        print(e.status_code, e.code, e.message)
```

```ts
import { WebhooksClient } from "@nimbusnexus/webhooks-sdk";

const wh = new WebhooksClient({ baseUrl: "{{WEBHOOKS_BASE_URL}}", apiKey: WEBHOOKS_API_KEY });
const event = await wh.publish(
  "order.created",
  { order_id: "ord_123", total: 4200 },
  { idempotencyKey: "order-123" },   // makes the publish safe to retry
);
console.log(event.eventUid, event.deliveriesCreated);
```

```go
client := nnwh.New("{{WEBHOOKS_BASE_URL}}", webhooksAPIKey)
event, err := client.Publish(ctx, "order.created",
    map[string]any{"order_id": "ord_123", "total": 4200},
    &nnwh.PublishOptions{IdempotencyKey: "order-123"})
```

## Надійна буферизація {#outbox}

`publish()` синхронний: якщо API недоступний, він викидає виняток, і подію втрачено. Outbox із записом спершу розділяє ці дві речі: `enqueue()` зберігає подію у сховищі й одразу повертається без мережевого виклику, а `drain()` пізніше надсилає накопичене.

```python
from nn_webhooks import Client, SQLiteStore

store = SQLiteStore("outbox.db")

# Construct for the process lifetime — NOT in a `with` block. Closing the client stops the
# drainer, so a `with` that exits immediately would shut down the thread you just started.
wh = Client("{{WEBHOOKS_BASE_URL}}", api_key=WEBHOOKS_API_KEY, store=store)
wh.start_drainer(interval_seconds=5)          # ships in the background

wh.enqueue("order.created", {"order_id": "ord_123"})   # returns at once, no network
...
wh.close()                                     # at shutdown; also stops the drainer
```

Кожне надсилання містить `Idempotency-Key = record.id`, тож повторний розбір після збою ніколи не публікує подію двічі. Запис, який постійно не вдається надіслати, повторюється з обмеженим експоненційним backoff до `max_attempts` (за замовчуванням 10), а потім позначається як мертвий і передається в необовʼязковий колбек `on_dead`.

| Сховище | Надійне | Додаткова залежність |
|---|---|---|
| `MemoryStore` | Ні — у памʼяті процесу | немає |
| `FileStore(dir)` | Так | немає |
| `SQLiteStore(path)` | Так, транзакційне | немає |
| `RedisStore(url)` | Так | `pip install 'nn-webhooks-sdk[redis]'` |
| `PostgresStore(dsn)` | Так | `pip install 'nn-webhooks-sdk[postgres]'` |

Жодне сховище не потребує залежностей поза самим SDK — у Python єдина залежність під час виконання — це `httpx`, — а сховища Redis і Postgres імпортують свій драйвер ліниво, лише під час створення.

## Керуйте ендпоінтами {#manage}

Той самий клієнт охоплює й площину керування — з ключем з областю дії `admin`:

```python
ep = wh.create_endpoint(
    "https://your-app.example/webhooks",
    subscriptions=[{"match_kind": "prefix", "pattern": "order."}],
)
endpoint_id, signing_secret = ep["id"], ep["secret"]   # secret returned once

wh.replace_subscriptions(endpoint_id, [                # replaces the whole set
    {"match_kind": "exact", "pattern": "order.paid"},
])
wh.rotate_endpoint_secret(endpoint_id)
wh.enable_endpoint(endpoint_id)                        # recover an auto-disabled endpoint

for d in wh.list_deliveries(status="dead")["items"]:   # drain the dead-letter queue
    wh.redeliver(d["id"])
```

Методи списків повертають `{"items": [...], "next_offset": int | None}`; методи видалення на `204` нічого не повертають.

`update_endpoint` не може змінювати підписки, бо webhookd ігнорує їх у PATCH: `replace_subscriptions` (`replaceSubscriptions` у TypeScript, `ReplaceSubscriptions` у Go) задає весь список одразу, а порожній список відписує ендпоінт від усього.

Методи керування ключами — `create_api_key`/`revoke_api_key` у Python, `createApiKey`/`revokeApiKey` у TypeScript, Java і PHP, `CreateAPIKey`/`RevokeAPIKey` у Go — досі є в клієнті, але маршрути `/v1/api-keys`, які вони викликають, видалено, тож виклик будь-якого з них тепер завершується з `404`; натомість випускайте ключі в консолі акаунта.

## Вибір проєкту {#projects}

До проєкту звертаються за ідентифікатором (`prj_3f9a…`) — slug-а чи короткої назви немає. Не задавайте `project_id`, щоб працювати з проєктом робочого простору за замовчуванням, — саме це завжди потрібно робочому простору з одним проєктом:

```python
wh.publish("order.created", {...})                          # default project
wh.publish("order.created", {...}, project_id="prj_3f9a…")  # a specific one
```

Лише сервер може визначити «проєкт за замовчуванням», тож пропустити поле — це і є спосіб попросити саме його. Передача вигаданого рядка — `"default"` або відображуваної назви проєкту — дає `404`. Справжній ідентифікатор є в будь-якій відповіді, або його можна отримати через `GET /v1/projects`.

## Як SDK тримаються контракту {#contract}

Усі клієнти реалізують один контракт підпису: `HMAC-SHA256(secret, "<timestamp>." + raw_body)`, що надсилається як `X-Webhook-Signature: sha256=<hex>` з вікном 300 секунд. Їх привʼязує до нього спільна фікстура тестових векторів, згенерована власним підписувачем сервера, тож жоден клієнт не може розійтися ні із сервером, ні з іншими клієнтами, — зокрема й у CI, де серверний пакет не встановлено.

## Поточний стан {#status}

| Мова | Пакет | Статус |
|---|---|---|
| Python | `nn-webhooks-sdk` | Опубліковано — [PyPI](https://pypi.org/project/nn-webhooks-sdk/), {{WEBHOOKS_SDK_VERSION}} |
| TypeScript | `@nimbusnexus/webhooks-sdk` | Опубліковано — [npm](https://www.npmjs.com/package/@nimbusnexus/webhooks-sdk), {{WEBHOOKS_SDK_VERSION}} |
| Go | `github.com/NimbusNexus/webhooks-go` | Опубліковано — [GitHub](https://github.com/NimbusNexus/webhooks-go), v{{WEBHOOKS_SDK_VERSION}} |
| Java | `net.nimbusnexus:webhooks-sdk` | Написано й протестовано; ще немає в Maven Central |
| PHP | `nimbusnexus/webhooks-sdk` | Написано й протестовано; ще немає в Packagist |

Доки SDK для Java і PHP не опубліковано, викликайте REST API напряму: на [сторінці про підпис](/docs/product-webhooks/signatures) є все потрібне, щоб перевіряти доставки будь-якою мовою, і це приблизно двадцять рядків.

## Що далі {#next-steps}

- [CLI](/docs/product-webhooks/cli) — ті самі операції з оболонки.
- [Перевірка підпису](/docs/product-webhooks/signatures) — що реалізує `verify`.
- [Швидкий старт](/docs/product-webhooks/quickstart) — процес, який охоплюють ці клієнти.
- [Ідемпотентність](/docs/idempotency) — загальноплатформний підхід, що стоїть за `idempotency_key`.
