---
title: "Налаштування мережі проєкту"
description: "Мережі, підмережі, маршрутизатори й групи безпеки — типова схема для багаторівневого застосунку."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Налаштування мережі проєкту

Типова мережева схема NimbusNexus для багаторівневого застосунку: приватна мережа з двома підмережами (публічною та лише для бази даних), маршрутизатор, що зʼєднує публічну підмережу з інтернетом, і групи безпеки, що обмежують трафік між рівнями. Ця інструкція проводить через усе налаштування від початку до кінця й пояснює, навіщо потрібна кожна частина.

У результаті у вас буде:

- Мережа з двома підмережами (`10.0.1.0/24` для вебу, `10.0.2.0/24` для бази даних)
- Маршрутизатор із зовнішнім шлюзом, підʼєднаний до вебпідмережі
- Дві групи безпеки: `web-sg` (HTTPS відкритий для інтернету) і `db-sg` (порт 5432 лише з `web-sg`)
- Спосіб перевірити, що ізоляція працює

## Чому така схема {#why}

Застосункам з однією VM нічого з цього не потрібно — VM із плаваючим IP без жодної мережевої конфігурації чудово працює. Ця схема — для застосунків, які:

- Мають кілька компонентів (вебрівень + база даних, вебрівень + рівень воркерів + кеш, ...)
- Мають тримати частину стеку поза публічним інтернетом
- Хочуть забезпечити правило «вебрівень може звертатися до рівня БД; більше ніхто не може»

Для застосунку, що справді працює на одній VM, натомість див. сторінку [Патерни розгортання контейнерів](/docs/guides/container-deploy).

## Що знадобиться {#prereqs}

- API-ключ з областями дії `networks:write` і `vms:write`.
- Обраний регіон (ми використовуємо `us-east-1`).
- Приблизне уявлення, які VM / сервіси мають бути на якому рівні.

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · Створіть мережу {#network}

Мережа — це широкомовний L2-домен: усі VM і ресурси, підʼєднані до однієї мережі, можуть маршрутизувати трафік одне до одного (з урахуванням груп безпеки).

```bash
curl -X POST {{API_BASE_URL}}/v1/networks \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "app-network",
    "region": "us-east-1",
    "cidr": "10.0.0.0/16"
  }'
```

Блок `10.0.0.0/16` — це адресний простір для всього всередині цієї мережі. Виберіть діапазон, що не перетинається з офісним VPN, домашньою мережею чи будь-якою іншою мережею, з якою ви згодом можете налаштувати пірінг (тож `192.168.0.0/16` зазвичай невдалий вибір — він надто поширений). `10.0.0.0/16` підходить для більшості конфігурацій; `172.16.0.0/12` теж годиться.

Збережіть ідентифікатор мережі:

```bash
export NET_ID="net_01HG7Y3..."
```

## 2 · Створіть дві підмережі {#subnets}

Розділіть мережу на дві підмережі — одну для того, що має бути доступним із публічного інтернету, другу для того, що не має.

```bash
# Web subnet — VMs that need internet access
curl -X POST {{API_BASE_URL}}/v1/subnets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web\",
    \"network_id\": \"$NET_ID\",
    \"cidr\": \"10.0.1.0/24\",
    \"gateway_ip\": \"10.0.1.1\"
  }"

# Database subnet — for tier-2 resources
curl -X POST {{API_BASE_URL}}/v1/subnets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db\",
    \"network_id\": \"$NET_ID\",
    \"cidr\": \"10.0.2.0/24\",
    \"gateway_ip\": \"10.0.2.1\"
  }"
```

IP шлюзу — це адреса інтерфейсу маршрутизатора в цій підмережі. VM використовують його як маршрут за замовчуванням.

## 3 · Створіть маршрутизатор і підʼєднайте його до вебпідмережі {#router}

Саме маршрутизатор виводить трафік із вебпідмережі в інтернет (і назад). Підмережу бази даних до маршрутизатора не підʼєднують — так вона лишається поза публічним інтернетом.

```bash
curl -X POST {{API_BASE_URL}}/v1/routers \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"app-router\",
    \"region\": \"us-east-1\",
    \"external_gateway\": true
  }"
```

`external_gateway: true` виділяє маршрутизатору публічний IP і вмикає SNAT для вихідного трафіку з підʼєднаних до нього підмереж.

Збережіть ідентифікатор маршрутизатора й підʼєднайте його до вебпідмережі:

```bash
export ROUTER_ID="rtr_01HG7Y3..."

curl -X POST {{API_BASE_URL}}/v1/routers/$ROUTER_ID/interfaces \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"subnet_id\": \"$WEB_SUBNET_ID\" }"
```

Підмережа БД лишається не підʼєднаною до маршрутизатора. Усе в підмережі БД може дістатися лише того, що доступне через L2-мережу, — тобто інших ресурсів у тій самій мережі, і це контролюють групи безпеки.

## 4 · Створіть групи безпеки {#security-groups}

Групи безпеки — це фаєрволи з відстеженням стану, що застосовуються до мережевих інтерфейсів VM. Вони контролюють, який трафік входить (ingress) і який виходить (egress). «З відстеженням стану» означає, що відповідь на зʼєднання, ініційоване зсередини, автоматично пропускається назад — правила потрібні лише для зʼєднань, ініційованих ззовні.

```bash
# Web security group — HTTPS open to the internet
curl -X POST {{API_BASE_URL}}/v1/security-groups \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "web-sg",
    "region": "us-east-1",
    "ingress_rules": [
      { "protocol": "tcp", "port": 443, "source_cidr": "0.0.0.0/0", "description": "HTTPS" },
      { "protocol": "tcp", "port": 22, "source_cidr": "203.0.113.5/32", "description": "SSH from office" }
    ],
    "egress_rules": [
      { "protocol": "any", "destination_cidr": "0.0.0.0/0", "description": "anywhere" }
    ]
  }'

# DB security group — port 5432 only from the web SG
curl -X POST {{API_BASE_URL}}/v1/security-groups \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "db-sg",
    "region": "us-east-1",
    "ingress_rules": [
      { "protocol": "tcp", "port": 5432, "source_security_group": "web-sg", "description": "Postgres from web tier" }
    ],
    "egress_rules": [
      { "protocol": "any", "destination_cidr": "0.0.0.0/0", "description": "anywhere" }
    ]
  }'
```

Саме `source_security_group` у правилі SG бази даних забезпечує «підключатися може лише вебрівень»: замість статичного CIDR правило посилається на саму SG. Будь-яка VM, якій призначено `web-sg`, може дістатися БД. Додавайте VM до `web-sg` або вилучайте їх — і список доступу оновлюється автоматично.

SG вебрівня відкриває порт 22 (SSH) лише для конкретного офісного IP, а не для всього світу. Не відкривайте SSH для `0.0.0.0/0` — у кожній хмарі працюють сканери, що перевіряють порт 22 на слабкі паролі.

## 5 · Підʼєднайте VM {#attach}

Під час створення VM вкажіть мережу, підмережу й групи безпеки:

```bash
# Web tier VM
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web-01\",
    \"size\": \"gp-2-4\",
    \"region\": \"us-east-1\",
    \"image\": \"ubuntu-24.04\",
    \"network_interfaces\": [
      { \"subnet_id\": \"$WEB_SUBNET_ID\", \"security_groups\": [\"web-sg\"] }
    ]
  }"

# Database tier VM (if running DB on your own VM rather than managed DB)
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db-01\",
    \"size\": \"gp-4-8\",
    \"region\": \"us-east-1\",
    \"image\": \"ubuntu-24.04\",
    \"network_interfaces\": [
      { \"subnet_id\": \"$DB_SUBNET_ID\", \"security_groups\": [\"db-sg\"] }
    ]
  }"
```

Для зовнішнього доступу до VM вебрівня виділіть [плаваючий IP](/docs/api/floating-ips) і підʼєднайте його. VM бази даних ніколи не отримує плаваючого IP — саме так і працює мережева ізоляція.

## 6 · Перевірте ізоляцію {#verify}

Перевірте, що схема справді забезпечує те, що ви задумали:

```bash
# From the web VM, can we reach the DB on 5432? (Should: yes)
nc -v -w 3 10.0.2.10 5432

# From the web VM, can we reach the DB on 22 (SSH)? (Should: no — DB SG only opens 5432)
nc -v -w 3 10.0.2.10 22

# From your laptop, can we reach the DB directly? (Should: no — DB subnet isn't routable from internet)
nc -v -w 3 <DB_PUBLIC_IP> 5432  # there's no public IP, this fails
```

Якщо щось поводиться не так, як очікувалося, помилка в правилах груп безпеки або в підʼєднанні до мережі/підмережі. Перевірте ще раз.

## Чим це не є {#not}

- **Не VPC-пірінг.** Це внутрішня мережа одного проєкту. Мережі двох проєктів NimbusNexus не зʼєднуються пірінгом — так задумано (див. сторінку [Модель безпеки](/docs/security#network)).
- **Не повноцінний WAF чи захист від DDoS.** Групи безпеки працюють на L3/L4 — вони не можуть аналізувати тіла HTTP-запитів. Для фільтрації на рівні застосунку запустіть WAF (напр., ModSecurity за nginx) на вебрівні.
- **Не автомасштабування.** Ви керуєте VM вручну. Для парків з автомасштабуванням працюють ті самі мережеві примітиви, але для керування ними в масштабі вам знадобиться інфраструктура як код (Terraform, Pulumi).

## Наступні кроки {#next-steps}

- [Довідник мереж](/docs/api/networks) — усі параметри виклику створення.
- [Довідник підмереж](/docs/api/subnets) — налаштування IPv6, параметри DHCP, перевизначення серверів імен DNS.
- [Довідник груп безпеки](/docs/api/security-groups) — повний синтаксис правил.
- [Довідник маршрутизаторів](/docs/api/routers) — статичні маршрути, анонсування BGP, складніші схеми зʼєднань.
- [Плаваючі IP](/docs/api/floating-ips) — примітив публічного IP, що зʼєднує все це із зовнішнім світом.
