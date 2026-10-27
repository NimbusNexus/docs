---
title: "SDK для Python"
description: "Типізований клієнт REST API NimbusNexus для Python. Python 3.11+, синхронний та асинхронний."
publishedAt: 2026-05-20
updatedAt: 2026-10-15
kind: sdk
---

# SDK для Python

> **Статус: попередня версія.** SDK активно розробляється. Ця сторінка описує форму v1.0; доки пакет не опубліковано, використовуйте REST API напряму, як описано на сторінках [Автентифікація](/docs/authentication) і [Угоди](/docs/conventions).

Типізований клієнт для Python. Синхронний + асинхронний (на базі httpx), Python 3.11+, повні моделі Pydantic для кожної форми відповіді.

> **Надсилаєте вебхуки своїм клієнтам?** Для цього є окремий [продукт Webhooks](/docs/product-webhooks) із власним опублікованим SDK для Python: пакет `nn-webhooks-sdk`, що імпортується як `nn_webhooks` ([SDK Webhooks](/docs/product-webhooks/sdks)). Ця сторінка — про клієнт для хмарного API NimbusNexus.

## Встановлення {#install}

Клієнт із цієї сторінки ще не опубліковано, і пакета `nimbusnexus` на PyPI немає, тож не встановлюйте пакет із такою назвою. (Попередні версії цієї сторінки показували `pip install nimbusnexus`.)

Пакет для Python, який ми публікуємо сьогодні, — це SDK Webhooks:

```bash
pip install nn-webhooks-sdk
# or
uv add nn-webhooks-sdk
# or
poetry add nn-webhooks-sdk
```

Він встановлює модуль `nn_webhooks` (`from nn_webhooks import Client`) для Python 3.11 і новіших версій.

## Швидкий приклад {#quick}

```python
import os
from nimbusnexus import NimbusNexus

nn = NimbusNexus(api_key=os.environ["NIMBUS_KEY"])

# List VMs in a region
page = nn.vms.list(region="us-east-1", limit=50)
for vm in page.items:
    print(vm.id, vm.name, vm.state)

# Create a VM
vm = nn.vms.create(
    name="web-01",
    size="gp-1-2",
    region="us-east-1",
    image="ubuntu-24.04",
)

# Poll until running
while vm.state != "running":
    time.sleep(1)
    vm = nn.vms.get(vm.id)
```

## Асинхронний клієнт {#async}

```python
import asyncio
from nimbusnexus import AsyncNimbusNexus

async def main():
    nn = AsyncNimbusNexus(api_key=os.environ["NIMBUS_KEY"])
    async with nn:
        vm = await nn.vms.create(
            name="web-01",
            size="gp-1-2",
            region="us-east-1",
            image="ubuntu-24.04",
        )
        print(vm.id)

asyncio.run(main())
```

Синхронний та асинхронний клієнти мають однаковий інтерфейс (усі назви методів і сигнатури збігаються); вибирайте той, що підходить вашому середовищу виконання. Асинхронний клієнт працює на httpx і рекомендований для будь-якого навантаження, обмеженого I/O.

## Принципи дизайну {#design}

- **Типізація через Pydantic.** Кожна відповідь — модель Pydantic; mypy/pyright бачать повні типи. Kwargs запиту проходять валідацію ще до надсилання — помилки в назвах полів дають збій у момент виклику, а не після відповіді 400.
- **Віддзеркалює REST API.** `nn.vms.list()` — це `GET /v1/vms`. `nn.databases.snapshots.list(db_id)` — це `GET /v1/databases/{db_id}/snapshots`. Жодних власних зручних методів, що розходяться з API.
- **Ідемпотентність за замовчуванням.** Кожен виклик, що змінює дані, генерує `Idempotency-Key` (UUID v4). Перевизначте через `idempotency_key="..."`, щоб ключ не змінювався між повторами.
- **Повтори для 429 + 5xx.** Налаштовувані backoff + jitter; за замовчуванням вимкнені для сирих запитів і ввімкнені для високорівневих методів ресурсів.
- **Синхронний клієнт не залежить від httpx.** Він працює на `urllib3`, без додаткових залежностей. Асинхронний клієнт залежить від httpx.

## Налаштування {#config}

```python
nn = NimbusNexus(
    api_key=os.environ["NIMBUS_KEY"],
    base_url="{{API_BASE_URL}}",  # defaults to canonical
    timeout=30,                    # seconds
    max_retries=3,
    retry_backoff=1.0,             # base; doubled per attempt with jitter
    user_agent="my-app/2.4",       # appended to the default UA
)
```

## Хелпер перевірки вебхуків {#webhooks}

```python
from nimbusnexus.webhooks import verify_webhook
from flask import request, abort

@app.route("/webhooks/nimbusnexus", methods=["POST"])
def webhook():
    if not verify_webhook(
        body=request.get_data(),
        timestamp=request.headers["NN-Timestamp"],
        signature=request.headers["NN-Signature"],
        secret=os.environ["NIMBUS_WEBHOOK_SECRET"],
    ):
        abort(401)

    event = request.get_json()
    # handle event...
    return "", 200
```

Функція перевірки бере на себе HMAC-SHA256, порівняння за сталий час і перевірку replay-вікна. Не пишіть власну реалізацію: саме там живе більшість багів, через які вебхуки можна підробити.

## Хелпер пагінації {#pagination}

```python
# Manual paging
for page in nn.vms.list_pages(region="us-east-1"):
    print(f"got {len(page.items)} VMs")

# Auto-flatten — yields one resource per iteration
for vm in nn.vms.list_all(region="us-east-1"):
    print(vm.name)
```

Обидва методи повертають ітератори, які самі обходять сторінки за курсором. Як це працює всередині, див. на сторінці [Пагінація](/docs/pagination).

## Помилки як винятки {#errors}

### В опублікованому SDK Webhooks {#errors-webhooks-sdk}

`nn-webhooks-sdk` має два класи винятків, обидва в `nn_webhooks.errors`:

| Клас | Коли виникає | Що містить |
|---|---|---|
| `WebhooksError` | Базовий клас. Сам виникає, якщо мережевий збій не зникає після повторів, і за неправильного використання, напр., виклику `enqueue()` на `Client`, створеному без сховища. | Повідомлення |
| `WebhooksAPIError` | API відповів статусом не 2xx. Підклас `WebhooksError`. | `status_code`, `code`, `message` |

Окремого класу для кожного коду немає. `code` — це `error.code` з API, переданий без змін, тож розгалужуйте обробку за ним, використовуючи коди зі сторінки [Помилки](/docs/errors). Якщо відповідь не має JSON-тіла помилки (скажімо, `502` від шлюзу), `code` дорівнює `"error"`, а `message` містить сирий текст відповіді. `details` не передається. Запити з відповіддю `429`, `500`, `502`, `503` або `504` повторюються до `max_retries` разів (за замовчуванням 2) з урахуванням `Retry-After`; після цього виникає `WebhooksAPIError`. Будь-який інший `4xx` чи `5xx`, зокрема `501`, одразу спричиняє виняток.

```python
from nn_webhooks import Client, WebhooksAPIError

with Client("{{WEBHOOKS_BASE_URL}}", api_key=WEBHOOKS_API_KEY) as wh:
    try:
        wh.publish("order.created", {"order_id": "ord_123"}, idempotency_key="order-123")
    except WebhooksAPIError as e:
        if e.code in ("validation_error", "unknown_event_type", "invalid_payload"):
            ...  # fix the request; sending it again won't help
        elif e.code == "quota_exceeded":
            ...  # monthly delivery quota: wait for the next period, or upgrade
        elif e.code == "invalid_credential":
            ...  # replace the key
        else:
            print(e.status_code, e.code, e.message)
```

Починаючи із запуску v1, перейменування коду відбувається за [політикою застарівання](/docs/versioning#deprecation): про перейменування оголошують у [журналі змін](/changelog), а старе написання й далі надходить у `code` щонайменше 12 місяців. Перейменування Webhooks, перелічені в розділі [Коли код перейменовують](/docs/errors#renames), набули чинності 2026-10-15, ще до запуску v1, без цього періоду.

### У клієнті хмарного API (заплановано) {#errors-planned}

Клієнт із цієї сторінки генеруватиме один клас винятків на кожну групу статусів. Кожен міститиме `status_code`, `code`, `message` і `details` саме так, як їх надсилає API:

```python
from nimbusnexus.errors import (
    NimbusError,                # base class
    AuthenticationError,        # 401 unauthorized, 403 invalid_credential
    PermissionError,            # 403 forbidden
    PlanError,                  # 402 quota_exceeded, not_entitled, workspace_frozen, ...
    ValidationError,            # 422 validation_error (carries .details)
    NotFoundError,              # 404 not_found
    ConflictError,              # 409 conflict
    RateLimitError,             # 429 rate_limited (carries .retry_after_seconds)
    ServerError,                # 5xx — retryable
)

try:
    vm = nn.vms.create(name="web-01", size="gp-1-2", region="us-east-1", image="ubuntu-24.04")
except ValidationError as e:
    for entry in e.details["errors"]:
        print(f"  {entry['loc']}: {entry['msg']}")
except RateLimitError as e:
    print(f"slow down — wait {e.retry_after_seconds}s")
```

Попередні версії цієї сторінки зіставляли ці класи з `invalid_credentials`, `expired_credentials`, `scope_required`, `wrong_project` і `400 validation_failed` з `.fields`. API ніколи їх не надсилали; у коментарях вище наведено коди, які API справді надсилають.

## Поточний стан {#status}

SDK генерується зі специфікації OpenAPI, але ще не опублікований. Поки що:

- Використовуйте REST API напряму. Автентифікація й угоди задокументовані та стабільні.
- Форма на цій сторінці — це дизайн API, якого ми зобовʼязуємося дотримуватися.
- Підпишіться на [журнал змін]({{BASE_URL}}/changelog), щоб отримати оголошення про реліз.

## Що далі {#next-steps}

- [Автентифікація](/docs/authentication) — що `api_key` робить на рівні запитів.
- [Вебхуки платформи](/docs/webhooks) — що саме перевіряє `verify_webhook`.
- [Пагінація](/docs/pagination) — що саме обходять `list_all` і `list_pages`.
- [Помилки](/docs/errors) — коди помилок, яким відповідають наведені вище класи винятків.
