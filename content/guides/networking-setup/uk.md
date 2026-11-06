---
title: "Налаштування мережі проєкту"
description: "Мережі, підмережі, маршрутизатори й групи безпеки — типова схема для багаторівневого застосунку."
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: guide
---

# Налаштування мережі проєкту

Типова мережева схема NimbusNexus для багаторівневого застосунку: окрема приватна мережа для кожного рівня (публічного та лише для бази даних), маршрутизатор, що зʼєднує їх між собою та з інтернетом, і групи безпеки, що обмежують трафік між рівнями. Ця інструкція проводить через усе налаштування від початку до кінця й пояснює, навіщо потрібна кожна частина.

У результаті у вас буде:

- Дві мережі, кожна з однією підмережею (`10.0.1.0/24` для вебу, `10.0.2.0/24` для бази даних)
- Маршрутизатор із зовнішнім шлюзом, підʼєднаний до обох підмереж
- Дві групи безпеки: `web-sg` (HTTPS відкритий для інтернету) і `db-sg` (порт 5432 лише з `web-sg`)
- Спосіб перевірити, що ізоляція працює

## Чому така схема {#why}

Застосункам з однією VM нічого з цього не потрібно — VM у зовнішній мережі має публічну адресу безпосередньо. Ця схема — для застосунків, які:

- Мають кілька компонентів (вебрівень + база даних, вебрівень + рівень воркерів + кеш, ...)
- Мають тримати частину стеку поза публічним інтернетом
- Хочуть забезпечити правило «вебрівень може звертатися до рівня БД; більше ніхто не може»

Для застосунку, що справді працює на одній VM, натомість див. сторінку [Патерни розгортання контейнерів](/docs/guides/container-deploy).

## Що знадобиться {#prereqs}

- API-ключ, який може робити ці виклики: `unrestricted` або правила доступу, що їх називають ([Що може ключ](/docs/authentication#scopes)).
- Приблизне уявлення, які VM / сервіси мають бути на якому рівні.

Усе, що ви тут створите, потрапляє в [регіон](/docs/api/regions) вашої сесії.

```bash
export NIMBUS_KEY="<your-api-key>"
```

## 1 · Створіть мережі {#network}

Мережа — це широкомовний L2-домен: усі VM і ресурси, підʼєднані до однієї мережі, можуть звертатися одне до одного (з урахуванням груп безпеки). Створіть по одній на кожен рівень: VM приєднується до мережі, а не до підмережі, тож у мережі з двома підмережами ви не змогли б вибрати, у яку підмережу вона потрапить.

```bash
curl -X POST {{API_BASE_URL}}/api/v1/network/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web-network" }'

curl -X POST {{API_BASE_URL}}/api/v1/network/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "db-network" }'
```

Кожна відповідь містить `id` нової мережі в `data`. Збережіть обидва:

```bash
export WEB_NET_ID="<web-network-id>"
export DB_NET_ID="<db-network-id>"
```

## 2 · Створіть дві підмережі {#subnets}

Задайте кожній мережі блок адрес. Виберіть діапазон, що не перетинається з офісним VPN, домашньою мережею чи будь-якою іншою мережею, до якої ви згодом можете підʼєднатися (тож `192.168.0.0/16` зазвичай невдалий вибір — він надто поширений). Блоки всередині `10.0.0.0/16` підходять для більшості конфігурацій; `172.16.0.0/12` теж годиться.

```bash
# Web subnet
curl -X POST {{API_BASE_URL}}/api/v1/subnet/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web\",
    \"network_id\": \"$WEB_NET_ID\",
    \"ip_version\": 4,
    \"cidr\": \"10.0.1.0/24\",
    \"gateway_ip\": \"10.0.1.1\"
  }"

# Database subnet
curl -X POST {{API_BASE_URL}}/api/v1/subnet/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db\",
    \"network_id\": \"$DB_NET_ID\",
    \"ip_version\": 4,
    \"cidr\": \"10.0.2.0/24\",
    \"gateway_ip\": \"10.0.2.1\"
  }"
```

IP шлюзу — це адреса інтерфейсу маршрутизатора в цій підмережі. VM використовують його як маршрут за замовчуванням.

Збережіть `id` обох підмереж:

```bash
export WEB_SUBNET_ID="<web-subnet-id>"
export DB_SUBNET_ID="<db-subnet-id>"
```

## 3 · Створіть маршрутизатор і підʼєднайте його до обох підмереж {#router}

Саме маршрутизатор виводить трафік із підмереж в інтернет (і назад), а також передає його з однієї підмережі в іншу. `GET /api/v1/router/artifacts` перелічує зовнішні мережі, до яких він може підʼєднатися:

```bash
curl -s {{API_BASE_URL}}/api/v1/router/artifacts \
  -H "X-API-Key: $NIMBUS_KEY" | jq '.data.external_networks.data'
```

```bash
export EXTERNAL_NET_ID="<external-network-id>"

curl -X POST {{API_BASE_URL}}/api/v1/router/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"app-router\",
    \"external_gateway_info\": { \"network_id\": \"$EXTERNAL_NET_ID\" },
    \"bandwidth_subscription\": \"Monthly\",
    \"bandwidth_mbps\": 100
  }"
```

`external_gateway_info` виділяє маршрутизатору публічний IP і вмикає SNAT для вихідного трафіку з підʼєднаних до нього підмереж. Для нього потрібні також `bandwidth_subscription` і `bandwidth_mbps` (кратне 10): пропускна здатність шлюзу обмежується цим значенням, а сама пропускна здатність тарифікується ([Дані про ціни](/docs/api/pricing-data)).

Збережіть ідентифікатор маршрутизатора й підʼєднайте його до обох підмереж:

```bash
export ROUTER_ID="<router-id>"

curl -X PUT {{API_BASE_URL}}/api/v1/router/$ROUTER_ID/interface \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"subnet_id\": \"$WEB_SUBNET_ID\" }"

curl -X PUT {{API_BASE_URL}}/api/v1/router/$ROUTER_ID/interface \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"subnet_id\": \"$DB_SUBNET_ID\" }"
```

Тепер вебрівень може звертатися до рівня бази даних, а VM бази даних можуть виходити в інтернет (напр., для оновлення пакетів). З інтернету ніщо не може дістатися VM без плаваючого IP — так рівень бази даних лишається поза публічним інтернетом.

## 4 · Створіть групи безпеки {#security-groups}

Групи безпеки — це фаєрволи з відстеженням стану, що застосовуються до мережевих інтерфейсів VM. Вони контролюють, який трафік входить (ingress) і який виходить (egress). «З відстеженням стану» означає, що відповідь на зʼєднання, ініційоване зсередини, автоматично пропускається назад — правила потрібні лише для зʼєднань, ініційованих ззовні. Нова група дозволяє весь вихідний трафік і забороняє весь вхідний, тож цим двом групам потрібні лише правила ingress.

```bash
curl -X POST {{API_BASE_URL}}/api/v1/security_group/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web-sg", "description": "Web tier" }'

curl -X POST {{API_BASE_URL}}/api/v1/security_group/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "db-sg", "description": "Database tier" }'
```

Збережіть `id` обох груп, а потім додавайте по одному правилу за виклик:

```bash
export WEB_SG_ID="<web-sg-id>"
export DB_SG_ID="<db-sg-id>"

# Web security group — HTTPS open to the internet
curl -X POST {{API_BASE_URL}}/api/v1/security_group/rule \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"security_group_id\": \"$WEB_SG_ID\",
    \"direction\": \"ingress\",
    \"ether\": \"IPv4\",
    \"protocol\": \"tcp\",
    \"port_min\": 443,
    \"remote_cidr\": \"0.0.0.0/0\",
    \"description\": \"HTTPS\"
  }"

# Web security group — SSH from your office
curl -X POST {{API_BASE_URL}}/api/v1/security_group/rule \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"security_group_id\": \"$WEB_SG_ID\",
    \"direction\": \"ingress\",
    \"ether\": \"IPv4\",
    \"protocol\": \"tcp\",
    \"port_min\": 22,
    \"remote_cidr\": \"203.0.113.5/32\",
    \"description\": \"SSH from office\"
  }"

# DB security group — port 5432 only from the web SG
curl -X POST {{API_BASE_URL}}/api/v1/security_group/rule \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"security_group_id\": \"$DB_SG_ID\",
    \"direction\": \"ingress\",
    \"ether\": \"IPv4\",
    \"protocol\": \"tcp\",
    \"port_min\": 5432,
    \"remote_sec_grp\": \"$WEB_SG_ID\",
    \"description\": \"Postgres from web tier\"
  }"
```

Саме `remote_sec_grp` у правилі SG бази даних забезпечує «підключатися може лише вебрівень»: замість статичного CIDR правило посилається на саму SG. Будь-яка VM у `web-sg` може дістатися БД. Додавайте VM до `web-sg` або вилучайте їх — і список доступу оновлюється автоматично.

SG вебрівня відкриває порт 22 (SSH) лише для конкретного офісного IP, а не для всього світу. Не відкривайте SSH для `0.0.0.0/0` — у кожній хмарі працюють сканери, що перевіряють порт 22 на слабкі паролі.

## 5 · Підʼєднайте VM {#attach}

Під час створення VM вкажіть мережу й групи безпеки. На сторінці [Швидкий старт](/docs/quickstart#region) показано, звідки беруться образ і значення `spec`. `sshs` вказує зареєстрований вами [SSH-ключ](/docs/api/ssh-keys).

```bash
export SSH_KEY_NAME="<ssh-key-name>"

# Web tier VM
curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web-01\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 2,
      \"ram\": 4096,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 25,
    \"network\": [\"$WEB_NET_ID\"],
    \"security_group\": [\"$WEB_SG_ID\"],
    \"sshs\": \"$SSH_KEY_NAME\"
  }"

# Database tier VM (if running DB on your own VM)
curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db-01\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 4,
      \"ram\": 8192,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 50,
    \"network\": [\"$DB_NET_ID\"],
    \"security_group\": [\"$DB_SG_ID\"],
    \"sshs\": \"$SSH_KEY_NAME\"
  }"
```

Для зовнішнього доступу до VM вебрівня виділіть [плаваючий IP](/docs/api/floating-ips) і підʼєднайте його. VM бази даних ніколи не отримує плаваючого IP — саме так і працює мережева ізоляція.

## 6 · Перевірте ізоляцію {#verify}

Перевірте, що схема справді забезпечує те, що ви задумали. Знайдіть адресу VM бази даних у `nics` із `GET /api/v1/instance/`; припустімо, що це `10.0.2.10`.

```bash
# From the web VM, can we reach the DB on 5432? (Should: yes)
nc -v -w 3 10.0.2.10 5432

# From the web VM, can we reach the DB on 22 (SSH)? (Should: no — DB SG only opens 5432)
nc -v -w 3 10.0.2.10 22

# From your laptop, can we reach the DB directly? (Should: no — the DB VM has no public IP)
nc -v -w 3 10.0.2.10 5432
```

Якщо щось поводиться не так, як очікувалося, помилка в правилах груп безпеки або в підʼєднанні до мережі/підмережі. Перевірте ще раз.

## Чим це не є {#not}

- **Не VPC-піринг.** Це внутрішня мережа одного проєкту. Мережі двох проєктів NimbusNexus не зʼєднуються пірингом — так задумано (див. сторінку [Модель безпеки](/docs/security#network)).
- **Не повноцінний WAF чи захист від DDoS.** Групи безпеки працюють на L3/L4 — вони не можуть аналізувати тіла HTTP-запитів. Для фільтрації на рівні застосунку запустіть WAF (напр., ModSecurity за nginx) на вебрівні.
- **Не автомасштабування.** Ви керуєте VM вручну. Для парків з автомасштабуванням працюють ті самі мережеві примітиви, але для керування ними в масштабі вам знадобиться інфраструктура як код (Terraform, Pulumi).

## Наступні кроки {#next-steps}

- [Довідник мереж](/docs/api/networks) — усі параметри виклику створення.
- [Довідник підмереж](/docs/api/subnets) — налаштування IPv6, параметри DHCP, перевизначення серверів імен DNS.
- [Довідник груп безпеки](/docs/api/security-groups) — повний синтаксис правил.
- [Довідник маршрутизаторів](/docs/api/routers) — статичні маршрути й те, як працює NAT.
- [Плаваючі IP](/docs/api/floating-ips) — примітив публічного IP, що зʼєднує все це із зовнішнім світом.
