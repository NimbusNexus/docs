---
title: "Патерни розгортання контейнерів"
description: "Одна VM, Docker під керуванням systemd, за плаваючим IP. Патерн для 80 % випадків."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Патерни розгортання контейнерів

NimbusNexus (поки що) не пропонує керованого сервісу Kubernetes. Патерн, якого у 80 % випадків вистачає, щоб запускати тут невелику кількість контейнеризованих сервісів: одна VM на сервіс, Docker як середовище виконання контейнерів, systemd як супервізор, плаваючий IP як публічна адреса. Простий, спостережуваний, зручний для налагодження.

Ця інструкція покроково описує типовий патерн. Для масштабованих сервісів, яким справді потрібна оркестрація (>10 сервісів, що взаємодіють між собою, складна маршрутизація трафіку, автомасштабування), використовуйте власний Kubernetes (k3s або k0s на невеликому кластері VM чи керований сервіс деінде); це виходить за межі цієї сторінки.

## Що ви отримаєте в результаті {#overview}

- Одна VM, на якій ваш контейнер працює під systemd
- [Плаваючий IP](/docs/api/floating-ips), що вказує на неї
- Логи, що надходять у journald (а звідти — куди забажаєте)
- Зрозумілий процес розгортання нових версій коду

## 1 · Розгорніть VM {#vm}

Виберіть розмір, що підходить вашому сервісу. Для більшості навантажень API/веб без стану `gp-1-2` (1 vCPU, 2 GB RAM) — добра відправна точка; якщо потрібно більше, збільште розмір.

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "api-prod",
    "size": "gp-1-2",
    "region": "us-east-1",
    "image": "ubuntu-24.04",
    "user_data": "#!/bin/bash\napt-get update && apt-get install -y docker.io"
  }'
```

`user_data` виконується під час першого завантаження — тут він встановлює Docker. Коли VM переходить у стан `running`, Docker уже готовий.

## 2 · Виділіть плаваючий IP {#floating-ip}

```bash
curl -X POST {{API_BASE_URL}}/v1/floating-ips \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"region\": \"us-east-1\", \"vm_id\": \"$VM_ID\" }"
```

IP підʼєднується до VM і стає її публічною адресою. Збережіть IPv4-адресу:

```bash
export PUBLIC_IP=$(curl -s {{API_BASE_URL}}/v1/floating-ips/$FLOATING_IP_ID \
  -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.ipv4')
```

Націльте на нього свій DNS ([DNS-записи](/docs/api/dns-records) або ваш наявний реєстратор).

## 3 · Зберіть образ контейнера й завантажте його в реєстр {#image}

Зберіть образ контейнера будь-де (локально, у CI). Завантажте його в реєстр, який вам до вподоби:

- **Docker Hub** — безкоштовно для публічних образів.
- **GitHub Container Registry** (`ghcr.io`) — безкоштовно для публічних репозиторіїв, входить у GitHub.
- **Обʼєктне сховище NimbusNexus** — якщо волієте хостити самі, завантажуйте tar-архіви в приватний bucket і стягуйте їх у юніті systemd (керувати тегами трохи складніше).

У цій інструкції ми використовуємо `ghcr.io/yourorg/api:v1.4.2`.

## 4 · Налаштуйте юніт systemd на VM {#systemd}

Підключіться до VM через SSH:

```bash
ssh ubuntu@$PUBLIC_IP
```

Створіть файл юніта `/etc/systemd/system/api.service`:

```ini
[Unit]
Description=API container
After=docker.service network-online.target
Requires=docker.service

[Service]
Restart=always
RestartSec=5
TimeoutStartSec=60

# Pull the image; ignore failures (we'll retry on next start)
ExecStartPre=-/usr/bin/docker pull ghcr.io/yourorg/api:v1.4.2
# Stop any existing container; ignore failure (no container = fine)
ExecStartPre=-/usr/bin/docker stop api
ExecStartPre=-/usr/bin/docker rm api

ExecStart=/usr/bin/docker run \
  --name api \
  --rm \
  --network host \
  --env-file /etc/api/env \
  ghcr.io/yourorg/api:v1.4.2

ExecStop=/usr/bin/docker stop api

[Install]
WantedBy=multi-user.target
```

Кілька зауважень:

- **`--network host`** — контейнер привʼязується безпосередньо до мережі VM. Простіше, ніж стандартна мережа bridge; підходить для конфігурації з одним контейнером. Не використовуйте цей режим, якщо у вас кілька контейнерів, яким треба спілкуватися між собою через приватні порти.
- **`--rm`** — прибирає контейнер після виходу. Разом із `Restart=always` systemd перезапускає його після збою.
- **`--env-file /etc/api/env`** — завантажує секрети й конфігурацію з файлу. Зробіть цей файл доступним для читання лише root (`chmod 600`).
- **`Restart=always`** — systemd повертає контейнер після збою. `RestartSec` у пʼять секунд запобігає швидким циклам збоїв.

Покладіть свої секрети в `/etc/api/env`:

```env
DATABASE_URL=postgresql://app:••••@{{DB_HOST_DEMO}}:6432/app?sslmode=verify-full
NIMBUS_KEY=nn_live_xxxxxxxxxxxxxxxx
JWT_SECRET=...
```

Увімкніть і запустіть:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now api.service
```

## 5 · Перевірте, що сервіс відповідає {#verify}

```bash
curl http://$PUBLIC_IP/healthz
```

Якщо бачите відповідь свого сервісу, усе готово.

## 6 · Розгортання нових версій {#deploys}

Щоб розгорнути нову версію, просто оновіть тег образу у файлі юніта й перезапустіть сервіс:

```bash
sudo sed -i 's|api:v1.4.2|api:v1.4.3|g' /etc/systemd/system/api.service
sudo systemctl daemon-reload
sudo systemctl restart api.service
```

Це перерва на 1–2 секунди (зупинка контейнера → завантаження образу → запуск нового контейнера).

Щоб обійтися без даунтайму, використовуйте [патерн blue/green](/docs/guides/blue-green): дві VM, два контейнери, під час cutover плаваючий IP перекидається між ними.

## 7 · Логи {#logs}

stdout/stderr контейнера автоматично потрапляють у journald:

```bash
sudo journalctl -u api.service -f
```

Для довшого зберігання логів пересилайте їх із journald туди, де ви зберігаєте логи:

- **systemd-journal-remote** — вбудоване вивантаження на іншу машину із systemd.
- **Vector** — кілька виходів, зокрема S3-сумісне обʼєктне сховище (надсилання в bucket NimbusNexus).
- **Promtail + Loki** — агрегація логів на стеку Grafana.

## Чому цей патерн, а не Kubernetes {#why}

**Для одного сервісу:** Kubernetes — це на 80 % накладні витрати. Площина керування, планувальник, YAML-маніфести — усе це, щоб запустити один контейнер. Systemd робить те саме у 30 рядках.

**Для двох сервісів:** усе ще ні. Дві VM, два юніти systemd. Трафік між сервісами йде через публічні плаваючі IP (або через приватну [мережу](/docs/api/networks), якщо хочете прибрати їх з інтернету).

**Для пʼяти й більше сервісів:** співвідношення витрат і користі змінюється на протилежне. На цьому етапі придивіться до Kubernetes (k3s на невеликому кластері VM — прагматична золота середина) або Nomad (легший за k8s, створений саме для такого масштабу).

## Чого цей патерн не робить {#limitations}

- **Без автомасштабування.** Масштабування вшир — вручну через `nimbus vms create`; скорочення — вручну через `nimbus vms delete`. Добре для стабільних навантажень; погано для тих, що коливаються разом із трафіком.
- **Без виявлення сервісів.** Сервіси знаходять одне одного за відомими публічними IP або через DNS — а не через пошук усередині кластера. Для конфігурацій із двох-трьох сервісів це нормально; для більших потрібен реєстр.
- **Без перезапусків за перевірками стану — лише за кодом виходу контейнера.** systemd перезапускає контейнер після збою, але не тоді, коли «процес працює, але несправний». Якщо вам це потрібно, додайте власний watchdog (sidecar, що звертається до `/healthz` і в разі збою надсилає контейнеру `kill -1`).

## Наступні кроки {#next-steps}

- [Blue/green-розгортання](/docs/guides/blue-green) — варіант описаного вище розгортання без даунтайму.
- [Віртуальні машини](/docs/api/vms) — усі параметри виклику створення.
- [Моніторинг парку VM](/docs/guides/monitoring-vms) — налаштування Prometheus + Grafana.
- [Інструкція для статичного сайту](/docs/guides/static-site) — для суто статичного контенту цей патерн надмірний; натомість використовуйте обʼєктне сховище.
