---
title: "Slack, Teams і Discord"
description: "Надсилайте події в канал Slack, Microsoft Teams чи Discord за допомогою пресету — трансформації, що перетворює кожну подію на повідомлення, яке приймає канал."
publishedAt: 2026-10-30
updatedAt: 2026-10-30
kind: guide
---

# Slack, Teams і Discord

Slack, Microsoft Teams і Discord дають каналу URL вебхука, що публікує в каналі все отримане, — але лише у власному форматі повідомлень, тож конверт події, який ми зазвичай надсилаємо, вони відхиляють. Цю розбіжність усуває [трансформація](/docs/product-webhooks/transformations). Наприкінці цієї інструкції у вас буде:

- ендпоінт, націлений на URL вебхука вашого каналу;
- пресет для цього застосунку, що перетворює кожну подію на повідомлення, яке той приймає;
- тестова подія, опублікована в каналі.

Загальний час: близько 10 хвилин.

## Що знадобиться {#prereqs}

- Робочий простір Webhooks на плані Starter, Pro або Custom. Free не включає трансформації.
- Право додати вебхук до каналу: у Slack — встановити застосунок у робочому просторі; у Teams — створити робочий процес; у Discord — дозвіл **Manage Webhooks**.
- Вимкнена [верифікація ендпоінтів](/docs/product-webhooks/endpoint-verification#cannot-echo) для проєкту, у якому буде ендпоінт. Ці канали приймають лише власні повідомлення, тож ніколи не зможуть відповісти на challenge верифікації, а ендпоінт, який має її пройти, нічого не отримує. На платних планах верифікацію можна вимкнути.

## 1 · Отримайте URL вебхука каналу {#webhook-url}

### Slack {#slack}

Створіть застосунок Slack для свого робочого простору й увімкніть у його налаштуваннях **Incoming Webhooks**. Виберіть **Add New Webhook to Workspace**, оберіть канал і підтвердьте доступ. Скопіюйте URL — він має вигляд `https://hooks.slack.com/services/T…/B…/…`. Власну інструкцію Slack наведено на сторінці [Надсилання повідомлень через вхідні вебхуки](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks).

### Microsoft Teams {#teams}

У Teams відкрийте **Workflows** і почніть із шаблону **Send webhook alerts to a channel**. Виберіть команду й канал, збережіть робочий процес і скопіюйте URL вебхука з відомостей про нього. Власну інструкцію Microsoft наведено на сторінці [Створення вхідних вебхуків за допомогою Workflows для Microsoft Teams](https://support.microsoft.com/en-us/office/create-incoming-webhooks-with-workflows-for-microsoft-teams-8ae491c7-0394-4861-ba59-055e33f75498).

### Discord {#discord}

У Discord відкрийте **Server Settings → Integrations → Webhooks** і створіть вебхук. Виберіть канал, у який він публікуватиме, а потім натисніть **Copy Webhook URL**. URL має вигляд `https://discord.com/api/webhooks/…/…`. Власну інструкцію Discord наведено на сторінці [Вступ до вебхуків](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks).

Тримайте URL у секреті: ці канали не перевіряють наш підпис, тож будь-хто, у кого він є, може публікувати в каналі.

## 2 · Додайте ендпоінт {#endpoint}

У консолі виберіть **New endpoint** на сторінці **Endpoints**, вставте URL і підпишіть ендпоінт на події, які має бачити канал. Обмежтеся коротким списком: канал читають люди, і кожна відповідна подія стає повідомленням.

Через API:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://hooks.slack.com/services/T…/B…/…", "project_id": "prj_…",
       "subscriptions": [{"match_kind": "exact", "pattern": "invoice.paid"}]}'
```

## 3 · Виберіть пресет {#preset}

Відкрийте меню ендпоінта на сторінці **Endpoints** і виберіть **Transformation**. Оберіть **Preset**, потім пресет для свого застосунку — **Slack message**, **Microsoft Teams card** або **Discord message** — і натисніть **Save**. Відтепер кожна доставка на цей ендпоінт надсилається як повідомлення:

| Пресет | Що показує канал |
|---|---|
| Slack message | Тип та ідентифікатор події, час, коли вона сталася, і її дані в блоці коду. |
| Microsoft Teams card | Adaptive Card з типом події, її ідентифікатором і часом, а також її даними. |
| Discord message | Тип та ідентифікатор події, а також її дані в блоці коду JSON. |

Кожен пресет обрізає дані відповідно до ліміту самого застосунку, як-от 3 000 символів у секції Slack чи 2 000 у повідомленні Discord.

Пресет — це звичайний скрипт, тож через API його не вибирають за назвою: [створіть трансформацію](/docs/product-webhooks/transformations#set-up) з потрібним скриптом. **Edit this script** у консолі показує код кожного пресету, з якого можна почати.

## 4 · Протестуйте {#test}

У розділі **Test** на тій самій сторінці виберіть **Run test**. Тест запускає пресет на нещодавній події з доставок ендпоінта або на події, яку ви вставите, і показує повідомлення, яке було б надіслано. Нічого не надсилається.

Потім надішліть справжню подію: натисніть **Send test event** на сторінці Overview у консолі або опублікуйте подію, на яку підписаний ендпоінт:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "invoice.paid", "project_id": "prj_…", "payload": {"id": "in_123", "amount": 125000, "currency": "usd"}}'
```

Повідомлення зʼявиться в каналі за кілька секунд. **Send test ping** ендпоінта тут не допоможе: він надсилає фіксований пінг без трансформації, і канал його відхиляє.

## Що ви зробили {#summary}

Тепер кожна подія, на яку підписаний ендпоінт, публікує повідомлення у вашому каналі. Відкрийте доставку на сторінці **Deliveries**, щоб побачити надіслане повідомлення; якщо застосунок відповів помилкою, вона теж там, серед спроб доставки.

## Налаштування під себе {#customize}

Виберіть **Edit this script**, щоб змінити текст повідомлення або те, які події його публікують. Якщо повернути `null`, нічого не буде надіслано, тож скрипт може залишити канал лише для тих подій, які потрібні людям. Для Slack:

```js
function transform(event) {
  if (event.type !== "invoice.paid" || event.data.amount < 100000) return null;
  return { body: { text: `Invoice ${event.data.id} paid: ${event.data.amount / 100} ${event.data.currency}` } };
}
```

Для Discord надсилайте `content` там, де Slack приймає `text`; для Teams залиште картку з пресету й змініть у ній текст. Доставка, яку скрипт відкидає, не надсилається й не вважається невдалою. Протестуйте скрипт, перш ніж зберегти його: невдалий запуск відправляє доставку в dead-letter чергу й ніколи не надсилає подію без трансформації.

## Наступні кроки {#next-steps}

- [Трансформації](/docs/product-webhooks/transformations) — контракт скрипту, ліміти й що відбувається, коли скрипт падає.
- [Верифікація ендпоінтів](/docs/product-webhooks/endpoint-verification#cannot-echo) — отримувачі, які не можуть відповісти на challenge.
- [Доставки та повтори](/docs/product-webhooks/deliveries) — стани, повтори й повторне надсилання.
