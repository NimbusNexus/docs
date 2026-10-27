---
title: "Розгортання статичного сайту"
description: "Обʼєктне сховище як хостинг: bucket, публічний доступ на читання, власний домен, ~5 хвилин."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Розгортання статичного сайту

S3-сумісне обʼєктне сховище водночас може бути хостингом статичних сайтів. Ви завантажуєте зібрані файли в bucket, відкриваєте їх для публічного читання, націлюєте свій домен на URL bucket-а — і маєте статичний сайт із CDN за кілька центів на місяць.

Ця інструкція проведе вас від зібраного каталогу `dist/` (результату роботи будь-якого сучасного генератора статичних сайтів — Next.js export, Astro, Hugo, звичайний HTML) до робочого сайту на вашому домені.

## Що знадобиться {#prereqs}

- Акаунт NimbusNexus з API-ключем.
- Зібраний сайт у локальному каталозі `dist/`.
- Домен, яким ви керуєте (або використайте піддомен, виданий NimbusNexus, і пропустіть крок із доменом).
- `awscli`, налаштований для роботи з обʼєктним сховищем NimbusNexus (або будь-який S3-сумісний клієнт — `rclone`, `mc`, `s3cmd`).

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export BUCKET="my-site"
export REGION="us-east-1"
```

## 1 · Створіть bucket {#create-bucket}

```bash
curl -X POST {{API_BASE_URL}}/v1/buckets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$BUCKET\",
    \"region\": \"$REGION\",
    \"storage_class\": \"standard\",
    \"public_read\": true,
    \"website\": {
      \"enabled\": true,
      \"index_document\": \"index.html\",
      \"error_document\": \"404.html\"
    }
  }"
```

Що робить кожен параметр:

- `public_read: true` — будь-хто в інтернеті може виконати `GET` для будь-якого обʼєкта в bucket-і. Обовʼязково для статичного хостингу; назва bucket-а зʼявляється в URL-адресах.
- `website.enabled: true` — вмикає режим статичного сайту. Bucket починає віддавати HTML із правильним `Content-Type`, для запитів до каталогів використовує `index_document`, а на 4xx показує `error_document`.

Відповідь містить URL bucket-а:

```json
{
  "id": "bkt_01HG7Y3...",
  "url": "https://my-site.{{S3_HOST_US_EAST_1}}",
  "website_endpoint": "https://my-site.{{S3_HOST_US_EAST_1}}"
}
```

## 2 · Налаштуйте S3 CLI {#configure-cli}

```bash
aws configure set aws_access_key_id $NIMBUS_KEY
aws configure set aws_secret_access_key $NIMBUS_SECRET
aws configure set region $REGION
aws configure set s3.endpoint_url {{S3_ENDPOINT_US_EAST_1}}
```

`$NIMBUS_SECRET` — секретна частина S3-сумісного ключа доступу, який генерується в дашборді в розділі **Settings → Object Storage Keys → New key**. Не плутайте його зі звичайним API-ключем — це різні ключі.

## 3 · Завантажте сайт {#upload}

```bash
aws s3 sync ./dist s3://$BUCKET \
  --delete \
  --cache-control "public, max-age=3600" \
  --endpoint-url {{S3_ENDPOINT_US_EAST_1}}
```

`--delete` видаляє з bucket-а файли, яких уже немає в `./dist`. `--cache-control` задає кожному обʼєкту заголовок кешування на 1 годину — достатньо довго, щоб браузери не завантажували файли заново під час кожного відкриття сторінки, і достатньо коротко, щоб не скидати кеш вручну після виправлення опечатки.

Для файлів, які НІКОЛИ не мають кешуватися (ваш `index.html`):

```bash
aws s3 cp ./dist/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache, max-age=0" \
  --endpoint-url {{S3_ENDPOINT_US_EAST_1}}
```

Патерн: довге кешування для ресурсів із хешем у назві (`/_app/[hash].js`), no-cache для вхідного HTML, який на них посилається. Той самий патерн під капотом використовують Vercel + Netlify + Cloudflare Pages.

## 4 · Перевірте, що все працює {#verify}

Відкрийте `https://my-site.{{S3_HOST_US_EAST_1}}` у браузері. Ви маєте побачити свій сайт.

Якщо замість нього бачите XML, ендпоінт сайту маршрутизує неправильно — найчастіше тому, що не задано `public_read` або `website.enabled`. Ще раз перевірте конфігурацію bucket-а:

```bash
curl {{API_BASE_URL}}/v1/buckets/$BUCKET \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

## 5 · Власний домен (необовʼязково) {#custom-domain}

Додайте в реєстратора DNS-запис, що спрямовує ваш домен на bucket:

```text
www.example.com   CNAME   my-site.{{S3_HOST_US_EAST_1}}
```

Для кореневого домену (`example.com` без `www.`) CNAME не працює — записи CNAME на корені домену заборонені RFC. Є два варіанти:

1. Використовуйте `www.example.com` як канонічний домен і перенаправляйте корінь → www
2. Додайте на корені запис A, що вказує на [плаваючий IP](/docs/api/floating-ips), підʼєднаний до маленької VM із перенаправленням (300 рядків конфігурації nginx, ~$5/міс)

Коли DNS-запис пошириться (від 1 хвилини до 24 годин залежно від TTL вашого реєстратора):

```bash
curl -X PATCH {{API_BASE_URL}}/v1/buckets/$BUCKET \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "custom_domains": ["www.example.com"]
  }'
```

Так bucket почне приймати запити з `Host: www.example.com` і випустить TLS-сертифікат для цього імені хоста (на базі Let's Encrypt, з автоматичним поновленням).

## 6 · Налаштуйте конвеєр розгортання {#cd}

Усе описане вище — це одноразове розгортання. Для CI/CD патерн той самий: `aws s3 sync` із GitHub Action (або будь-якого CI-раннера):

```yaml
# .github/workflows/deploy.yml (abbreviated)
- name: Deploy
  run: |
    aws s3 sync ./dist s3://$BUCKET --delete --endpoint-url $ENDPOINT
  env:
    AWS_ACCESS_KEY_ID:     ${{ secrets.NIMBUS_S3_KEY }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.NIMBUS_S3_SECRET }}
    BUCKET:                my-site
    ENDPOINT:              {{S3_ENDPOINT_US_EAST_1}}
```

У більшості CI-систем уже є дії розгортання для S3-сумісних сховищ; ви націлюєте їх на наш ендпоінт, і вони працюють без змін.

## Вартість {#cost}

Зберігання: $0,013 за GB·міс у класі standard. Сайт на 50 MB коштує близько цента на місяць.

Egress: безкоштовно для перших 100 GB на місяць, далі $0,01/GB. Сайт, що віддає 100 тис. переглядів сторінок по 200 KB на сторінку, — це 20 GB, тобто все ще в межах безкоштовного обсягу.

Порівняно з тим самим навантаженням на AWS CloudFront + S3: зазвичай 4–6× дешевше в позиції egress і приблизно стільки ж у позиції зберігання.

## Наступні кроки {#next-steps}

- [Довідник обʼєктного сховища](/docs/api/object-storage) — повний API bucket-ів.
- [DNS-зони](/docs/api/dns-zones) — розміщуйте DNS безпосередньо на NimbusNexus, а не в реєстратора.
- [Холодне сховище](/docs/api/cold-storage) — для тих даних, які ви майже ніколи не читаєте (артефакти збірок, старі релізи).
