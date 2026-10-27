---
title: "Продакшн-Postgres за 10 хвилин"
description: "Розгорніть керований Postgres із HA, бекапами й оновленнями без даунтайму — трьома викликами API."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Продакшн-Postgres за 10 хвилин

Наприкінці цієї інструкції у вас буде керований кластер Postgres 16, що має:

- Три вузли (один головний, дві репліки) у різних зонах доступності
- Автоматичні щоденні бекапи + відновлення на момент часу в межах 7 днів
- Увімкнений пулер зʼєднань
- Доступ лише через TLS з IP зі списку дозволених
- Рядок підключення, готовий для вставлення в застосунок

Загальний час: близько 10 хвилин (здебільшого на розгортання кластера).

## Що знадобиться {#prereqs}

- Акаунт NimbusNexus з API-ключем. Якщо ключа ще немає, див. сторінку [Швидкий старт](/docs/quickstart).
- Потрібний регіон — Вірджинія (`us-east-1`), Лос-Анджелес (`us-west-1`), Франкфурт (`eu-central-1`) або Сінгапур (`ap-southeast-1`).
- Локально встановлений `psql`, якщо хочете підключитися наприкінці.

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · Створіть кластер {#create}

```bash
curl -X POST {{API_BASE_URL}}/v1/databases \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "app-prod",
    "engine": "postgres",
    "engine_version": "16",
    "tier": "production-4-16",
    "region": "us-east-1",
    "high_availability": true,
    "backup_retention_days": 7,
    "connection_pooler": true,
    "tls_required": true
  }'
```

Що робить кожен параметр:

- `tier: 'production-4-16'` — 4 vCPU, 16 GB RAM, 200 GB SSD. Відповідний розмір для застосунків із низьким і середнім трафіком (~1 000 QPS). Повний список розмірів — у [таблиці рівнів](/docs/api/managed-databases).
- `high_availability: true` — головний вузол + дві репліки в різних AZ. Додає ~80 % до вартості; зате значно зменшує кількість інцидентів із терміновими викликами.
- `backup_retention_days: 7` — щоденний повний бекап + безперервна потокова передача WAL; відновлення можливе на будь-який момент за останні 7 днів.
- `connection_pooler: true` — PgBouncer, увімкнений на порту 6432. Використовуйте його з будь-якого застосунку, у якому ви контролюєте розмір пулу зʼєднань (таких більшість).
- `tls_required: true` — зʼєднання без TLS відхиляються на прослуховувачі. Завжди вмикайте цей параметр.

Відповідь містить `id` кластера. Збережіть його:

```bash
export DB_ID="db_01HG7..."
```

## 2 · Дочекайтеся готовності {#wait}

Розгортання триває 4–7 хвилин. Опитуйте, доки `state` не стане `running`:

```bash
while true; do
  state=$(curl -s {{API_BASE_URL}}/v1/databases/$DB_ID \
    -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.state')
  echo "state: $state"
  [ "$state" = "running" ] && break
  sleep 10
done
```

Або, якщо вам зручніше отримати вебхук, [підпишіться на `database.created`](/docs/webhooks#events) і обійдіться без циклу опитування.

## 3 · Додайте свій IP до списку дозволених {#allowlist}

За замовчуванням кластер приймає зʼєднання з будь-якого джерела, до якого він може маршрутизувати трафік. Для продакшну потрібен явний список дозволених:

```bash
MY_IP=$(curl -s ifconfig.me)/32

curl -X POST {{API_BASE_URL}}/v1/databases/$DB_ID/allowlist \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"cidr\": \"$MY_IP\", \"description\": \"my laptop\" }"
```

Додайте запис для кожного CIDR, який хочете пропускати. Для VM, якій потрібен доступ до цієї БД, додайте CIDR її плаваючого IP (або CIDR вихідного NAT, якщо VM за ним). Записи списку дозволених працюють із відстеженням стану — видалення запису блокує нові зʼєднання; наявні зʼєднання залишаються, доки не закриються через простій або доки ви не перезапустите кластер.

## 4 · Підключіться {#connect}

Отримайте параметри підключення:

```bash
curl -s {{API_BASE_URL}}/v1/databases/$DB_ID/connection \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Відповідь:

```json
{
  "host": "{{DB_HOST_DEMO}}",
  "port": 5432,
  "pooler_port": 6432,
  "database": "app",
  "username": "app",
  "password": "•••• (one-time view in dashboard)",
  "tls_root_cert_url": "{{BASE_URL}}/ca-certs/nimbusnexus-root.pem"
}
```

Один раз завантажте кореневий сертифікат:

```bash
curl -o ~/.postgresql/nn-root.crt {{BASE_URL}}/ca-certs/nimbusnexus-root.pem
```

Підключіться:

```bash
psql "postgresql://app:••••@{{DB_HOST_DEMO}}:6432/app?sslmode=verify-full&sslrootcert=~/.postgresql/nn-root.crt"
```

Із серверів застосунків використовуйте порт `6432` (пулер); порт `5432` — лише для інструментів адміністрування/міграцій, яким потрібен прямий доступ до головного вузла (напр., `pg_dump`, `pg_restore`, інструменти міграції схеми, що беруть advisory-блокування).

`sslmode=verify-full` звіряє сертифікат з іменем хоста — це правильне значення за замовчуванням. `verify-ca` теж прийнятний; `require` прийнятний поза продакшном, але пропускає перевірку імені хоста (а отже, не захищає від цілого класу атак MITM). Ніколи не використовуйте `prefer` чи `disable`.

## Що ви зробили {#summary}

Тепер у вас є кластер Postgres продакшн-рівня:

- Три вузли, автоматичний failover
- Щоденні бекапи + PITR за 7 днів
- Увімкнений пулер зʼєднань (порт 6432)
- Обовʼязковий TLS, список дозволених
- Вартість: близько $200/міс за рівень `production-4-16` з HA + бекапами за 7 днів у us-east-1

Та сама схема працює для MySQL, MongoDB, Redis, Kafka, OpenSearch — змініть `engine` і `engine_version`, а решта параметрів переноситься зі значеннями за замовчуванням, що відповідають рушію.

## Наступні кроки {#next-steps}

- [Довідник керованих баз даних](/docs/api/managed-databases) — усі параметри виклику створення, усі ендпоінти для керування кластером.
- [Інструкція з міграції з AWS RDS](/docs/guides/migrate-from-rds) — те саме налаштування з одноразовою міграцією даних з наявного кластера RDS.
- [Вебхуки платформи](/docs/webhooks) — підключіть події `database.created`, `database.upgrade_completed`, `backup.completed` до свого моніторингу.
- [Снапшоти](/docs/api/snapshots) — копії на певний момент часу на вимогу для перевірок безпеки перед розгортанням.
