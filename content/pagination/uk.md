---
title: "Пагінація"
description: "Як кожен API розбиває списки на сторінки: limit з offset або marker, і як зрозуміти, що ви дійшли до кінця."
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: concept
---

# Пагінація

NimbusNexus має два види API, і вони по-різному розбивають списки на сторінки. API застосунків використовують `limit` і `offset`. В API інфраструктури більшість ендпоінтів списків відповідають усім списком одразу, а кілька приймають `limit` разом із `marker` або `offset`.

## API застосунків {#shape}

Більшість ендпоінтів списків у Webhooks, Inboxes, Request Bins і Transforms приймають два параметри query:

- `limit` — розмір сторінки. За замовчуванням 50, максимум 200. Понад 200 запит не проходить валідацію: `422` `validation_error` ([Помилки](/docs/errors#codes-validation)).
- `offset` — скільки елементів пропустити. За замовчуванням 0, максимум 10 000.

Кожен список відповідає своїми елементами й наступним зсувом:

```json
{
  "items": [],
  "next_offset": 50
}
```

Щоб отримати наступну сторінку, передайте `next_offset` назад як `offset`. Якщо він дорівнює `null`, ви на останній сторінці.

Зсув рахує позиції, тож якщо під час обходу списку елемент створять або видалять, ви можете побачити інший елемент двічі або якийсь пропустити. Якщо це важливо, порівнюйте ідентифікатори. Протягом усього обходу використовуйте ті самі фільтри, а якщо змінюєте їх, починайте знову зі зсуву 0.

Є два винятки:

- **Пошук** в Inboxes і Request Bins натомість ділиться на сторінки за `next_until`: див. [Пошук повідомлень](/docs/product-inboxes#search) і [Перехоплені запити](/docs/product-bins/reference#requests).
- **QR-коди** віддають більшість списків однією відповіддю. Список сканувань коду (`GET /v1/qr-tracked/codes/{code_id}/scans`) приймає лише `limit`, а список доставок вебхука (`GET /v1/qr-tracked/webhooks/{webhook_id}/deliveries`) ділиться на сторінки за `limit` і `cursor`, і наступний курсор міститься в `nextCursor`.

## API інфраструктури {#infrastructure}

Більшість ендпоінтів списків, як-от `GET /api/v1/instance/`, відповідають цілим списком і не приймають параметрів пагінації. Ті, що розбивають список на сторінки, роблять це одним із двох способів.

### `limit` і `marker` {#marker}

`marker` — це останній елемент, який ви бачили: його ідентифікатор, а в обʼєктному сховищі — його назва. Відповідь починається після нього.

- Образи VM: `GET /api/v1/image/`.
- DNS: `GET /api/v1/zones/`, `GET /api/v1/recordsets/`, `GET /api/v1/zones/{zone_id}/recordsets/`, `GET /api/v1/zones/{zone_id}/ptr/` і `GET /api/v1/zones/{zone_id}/shares/`.
- Обʼєктне сховище: `GET /api/v1/object_storage/` для контейнерів і `GET /api/v1/object_storage/{container_name}/objects` для обʼєктів. Для обʼєктів `full_listing=true` повертає їх усі однією відповіддю.

Ці відповіді містять лише `data`, і нічого в них не вказує, чи лишилося ще щось. Продовжуйте, доки не отримаєте сторінку, коротшу за ваш `limit`.

### `limit` і `offset` {#offset}

`offset` — це скільки елементів пропустити.

- Бекапи томів: `GET /api/v1/backup_restore/volume_backups/`, `limit` за замовчуванням — 10.
- Розклади бекапів: `GET /api/v1/backup_restore/backup_scheduler/list` і `GET /api/v1/backup_restore/volume_scheduler/list`.
- Підключення до зовнішніх сховищ: `GET /api/v1/external/connections/`.
- Сповіщення: `GET /api/v1/notifications/list`, `limit` за замовчуванням — 50, максимум — 200.

Ці відповіді також містять `total` — кількість елементів на всіх сторінках, тож ви дійшли до кінця, коли прочитали стільки елементів.

## Обхід сторінок {#walking}

В API застосунків переходьте далі за `next_offset`:

```ts
async function listAllEndpoints() {
  const all = []
  let offset = 0

  while (offset !== null) {
    const url = new URL('{{WEBHOOKS_BASE_URL}}/v1/endpoints')
    url.searchParams.set('limit', '200')
    url.searchParams.set('offset', String(offset))

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.WEBHOOKS_API_KEY}` },
    })
    const page = await res.json()

    all.push(...page.items)
    offset = page.next_offset
  }

  return all
}
```

В API інфраструктури переходьте далі за останнім ідентифікатором, доки не отримаєте неповну сторінку:

```ts
async function listAllZones() {
  const all = []
  const limit = 100
  let marker

  while (true) {
    const url = new URL('{{API_BASE_URL}}/api/v1/zones/')
    url.searchParams.set('limit', String(limit))
    if (marker) url.searchParams.set('marker', marker)

    const res = await fetch(url, {
      headers: { 'X-API-Key': process.env.NIMBUS_KEY },
    })
    const { data } = await res.json()

    all.push(...data)
    if (data.length < limit) return all
    marker = data.at(-1).id
  }
}
```

Кожна сторінка — це запит, і він зараховується в [ліміт запитів](/docs/rate-limiting).

## Порядок сортування {#sort}

Якщо список можна сортувати, параметри сортування вказано на його сторінці в довіднику. В API інфраструктури це `sort_by` і `sort_desc` у списках з `offset`, які можна сортувати, та `sort_key` і `sort_dir` в образах VM і наборах DNS-записів. Протягом усього обходу використовуйте те саме сортування.

## Що далі {#next-steps}

- [Угоди](/docs/conventions) — решта формату запиту: ідентифікатори, коди статусу, помилки.
- [Ліміти запитів](/docs/rate-limiting) — скільки запитів може зробити обхід.
- [Помилки](/docs/errors) — що повертає відхилений запит.
