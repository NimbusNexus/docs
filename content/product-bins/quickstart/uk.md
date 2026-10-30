---
title: "Швидкий старт Request Bins"
description: "Створіть bin, надішліть на нього запит через curl і прочитайте, що він записав, — спершу в консолі, потім через API."
publishedAt: 2026-10-22
updatedAt: 2026-10-30
kind: quickstart
---

# Швидкий старт Request Bins

Від нуля до записаного запиту за кілька хвилин. Ви створите bin, надішлете на нього запит через `curl` і прочитаєте, що саме надійшло: спершу в консолі, потім через API.

## Перш ніж почати {#before}

- **У консолі, на будь-якому плані.** Відкрийте `https://bins.nimbusnexus.net` і увійдіть зі своїм акаунтом NimbusNexus. Для кроків 1–3 більше нічого не потрібно, навіть на Free.
- **Через API, з ключем.** Для кроку 4 потрібен API-ключ, створений у [консолі акаунта]({{ACCOUNT_BASE_URL}}/api-keys?product=bins) для продукту **Request Bins** з дозволом **Read & write**. Ключ може створювати bin-и на будь-якому плані; щоб читати записане ключем, потрібен Starter або вищий план, а на Free ці маршрути відповідають `402` `not_entitled`.

## 1. Створіть bin {#create}

У консолі виберіть **Create a bin** (або **New bin**, коли bin у вас уже є). Мітка необовʼязкова, і відправники її ніколи не бачать. **Lifetime** спершу має значення вашого плану за замовчуванням: 24 години на Free і до видалення на платних планах; можна вибрати коротший час життя або ввести власний через **Custom…**, але не довший, ніж дозволяє ваш план. Згодом його не можна змінити. Виберіть **Create bin**.

Відкриється сторінка bin-а. Угорі — його **Bin URL**, напр. `https://nnbin.net/b/k7xq2mbn9tfa`, і команда **Try it**, кожен із кнопкою копіювання.

## 2. Надішліть на нього запит {#send}

З будь-якого термінала надішліть на bin `POST` зі шляхом і query після slug-а. Використайте URL свого bin-а:

```bash
curl -X POST "https://nnbin.net/b/k7xq2mbn9tfa/orders?source=quickstart" \
  -H "Content-Type: application/json" \
  -d '{"order_id": 1042, "status": "paid"}'
```

```json
{"status":"accepted"}
```

Ця відповідь однакова для кожного запиту на URL bin-а, записаного чи ні, тож відправнику вона нічого не каже про ваш bin. Що саме надійшло, показує консоль.

Підходить будь-який метод, шлях, заголовок чи тіло. У реальній роботі вставте URL bin-а туди, де застосунок, налаштування вебхуків провайдера, скрипт чи CI-задача очікують URL, і нехай вони надсилають.

## 3. Перегляньте його в консолі {#console}

Поверніться на сторінку bin-а: за кілька секунд запит зʼявиться вгорі списку; список оновлюється кожні 3 секунди. Виберіть запит, щоб побачити:

- метод і шлях після slug-а: `POST /orders`;
- query в декодованому вигляді: `source=quickstart`;
- заголовки в порядку надходження;
- тіло, відформатоване як JSON, а сирий текст — за один клік;
- адресу, з якої прийшов запит, його розмір і час надходження.

На Free на цьому все: консоль читає записане bin-ами на будь-якому плані.

## 4. Зробіть те саме через API {#api}

Збережіть ключ у змінній середовища:

```bash
export BINS_API_KEY="<your-api-key>"
```

Усі шляхи нижче відносні до `https://bins.nimbusnexus.net`, і кожен запит містить `Authorization: Bearer <your key>`. Спершу створіть bin:

```bash
curl -X POST https://bins.nimbusnexus.net/v1/bins \
  -H "Authorization: Bearer $BINS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"label": "Quickstart"}'
```

```json
{
  "id": "bin_3f9a1c7e5b2d8f4a6c0e9b17",
  "slug": "w4tz8hcv2qnd",
  "url": "https://nnbin.net/b/w4tz8hcv2qnd",
  "label": "Quickstart",
  "status": "enabled",
  "expires_at": null,
  "created_at": "2026-10-22T09:12:01Z",
  "request_count": 0
}
```

Тут відповідь скорочено; усі поля перелічено в розділі [Обʼєкт bin](/docs/product-bins/reference#bin). Зараз важливі два:

- **`url`** — те, що ви даєте відправнику.
- **`id`** — те, що приймають усі подальші виклики. Збережіть його.

`expires_at` дорівнює `null`, бо на платному плані bin існує, доки ви його не видалите; на Free це 24 години після `created_at`. Free дозволяє лише один bin одночасно, тож там цей виклик відповідає `402` `quota_exceeded`, поки існує bin із кроку 1. Натомість знайдіть той bin за URL: `GET /v1/bins?url=https://nnbin.net/b/k7xq2mbn9tfa`.

Надішліть на новий bin запит із кроку 2, але з його власним URL, а потім виведіть список того, що він записав:

```bash
curl https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17/requests \
  -H "Authorization: Bearer $BINS_API_KEY"
```

```json
{
  "items": [
    {
      "id": "req_8d2e6b1f4a9c3e7d5b0f2a61",
      "bin_id": "bin_3f9a1c7e5b2d8f4a6c0e9b17",
      "method": "POST",
      "path": "/orders",
      "query": "source=quickstart",
      "source_ip": "203.0.113.24",
      "content_type": "application/json",
      "size_bytes": 36,
      "truncated": false,
      "seen_count": 1,
      "received_at": "2026-10-22T09:12:04Z",
      "expires_at": "2026-10-29T09:12:04Z"
    }
  ],
  "next_offset": null,
  "next_until": null
}
```

Найновіший запит іде першим. Його `expires_at` — момент, коли його буде видалено: тут через 7 днів, як передбачає строк зберігання на Starter.

Щоб прочитати один запит повністю, з query, заголовками й тілом:

```bash
curl https://bins.nimbusnexus.net/v1/requests/req_8d2e6b1f4a9c3e7d5b0f2a61 \
  -H "Authorization: Bearer $BINS_API_KEY"
```

```json
{
  "id": "req_8d2e6b1f4a9c3e7d5b0f2a61",
  "method": "POST",
  "path": "/orders",
  "query": "source=quickstart",
  "headers": [
    {"name": "user-agent", "value": "curl/8.7.1"},
    {"name": "accept", "value": "*/*"},
    {"name": "content-type", "value": "application/json"},
    {"name": "content-length", "value": "36"}
  ],
  "body_base64": "eyJvcmRlcl9pZCI6IDEwNDIsICJzdGF0dXMiOiAicGFpZCJ9",
  "size_bytes": 36,
  "truncated": false,
  "request_id": "4b8f2c1d9e7a46b3a0c5d8e2f1a7b9c3"
}
```

Цю відповідь теж скорочено: повна відповідь містить усі поля елемента списку. Тіло закодовано в base64, бо тіло не обовʼязково є текстом. Щоб вивести його:

```bash
curl -s https://bins.nimbusnexus.net/v1/requests/req_8d2e6b1f4a9c3e7d5b0f2a61 \
  -H "Authorization: Bearer $BINS_API_KEY" | jq -r .body_base64 | base64 --decode
```

```text
{"order_id": 1042, "status": "paid"}
```

## Опитування замість push {#polling}

Немає ні потоку, ні колбеку. Щоб дочекатися запиту, опитуйте список, задавши в `since` найновіше значення `received_at`, яке ви бачили; тоді список повертає лише запити, отримані після цього моменту:

```bash
curl -G https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17/requests \
  --data-urlencode "since=2026-10-22T09:12:04Z" \
  -H "Authorization: Bearer $BINS_API_KEY"
```

`-G` разом із `--data-urlencode` додає `since` до рядка query в закодованому вигляді, тож зсув на кшталт `+00:00` доходить без змін. Запит, надісланий знову, — це новий окремий рядок, тож він теж повертається в цьому списку, з власними `id` і `received_at`.

Не опитуйте фіксовану кількість разів, перевіряючи лише останню відповідь. Перевіряйте, що запит *зʼявляється*, з тайм-аутом, інакше повільний відправник виглядатиме як такий, що нічого не надіслав.

## Прибирання {#cleanup}

Платний bin існує, доки ви його не видалите, якщо тільки ви не створили його з `expires_in_minutes`, а кожен план обмежує, скільки bin-ів можна мати одночасно, тож видаліть bin, коли закінчите:

```bash
curl -X DELETE https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17 \
  -H "Authorization: Bearer $BINS_API_KEY"
```

Видалення **остаточне**: URL одразу перестає записувати, записане bin-ом видаляється, а його slug більше ніколи не видається ні вам, ні комусь іншому. Відправники й далі отримують від нього `200`. Щоб натомість тимчасово зупинити запис, змініть bin через `PATCH` на `{"status": "disabled"}`, а пізніше — назад на `{"status": "enabled"}`. Щоб зберегти bin і стерти те, що в ньому є, очистіть його через `DELETE /v1/bins/{id}/requests`. У консолі всі три дії — у меню ⋯ на сторінці bin-а: **Delete bin…**, **Disable** і **Empty bin…**. На Free bin спливає щонайпізніше через 24 години після створення, і це завершує його так само, як видалення.

## Що далі {#next-steps}

- [Огляд продукту](/docs/product-bins) — плани й ліміти, призупинені bin-и і чого Request Bins не робить.
- [Пересилання](/docs/product-bins/forwarding) — на платному плані надсилайте кожен запит ще й на власний сервер.
- [Довідник Request Bins](/docs/product-bins/reference) — усі маршрути й поля, що відповідає URL bin-а, ролі й області дії.
- [API Request Bins](/docs/reference/bins) — усі операції із запитом у curl, TypeScript, Python або Go.
