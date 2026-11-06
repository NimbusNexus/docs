---
title: "Оптимізація місячного рахунку"
description: "На що йде рахунок за інфраструктуру і як знайти ресурси, за які можна більше не платити."
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: guide
---

# Оптимізація місячного рахунку

У NimbusNexus ви здебільшого платите за те, що виділили, незалежно від того, чи використовуєте це: VM, томи, плаваючі IP, публічні порти з їхньою пропускною здатністю та власні образи. Тож коли рахунок більший, ніж ви очікували, спершу шукайте те, що досі виділено, але вже не потрібно. Ця інструкція розглядає ці місця й показує виклики, які знаходять кожне з них.

Ціни наведено на сторінці [Дані про ціни](/docs/api/pricing-data). Білінг ведеться на рівні робочого простору, а API-ключ працює в одному проєкті, тож повторіть ці виклики для кожного проєкту в робочому просторі.

## Що знадобиться {#prereqs}

- `curl` і `jq`, а в `$NIMBUS_KEY` — [API-ключ](/docs/authentication), який може робити ці виклики.

```bash
export NIMBUS_KEY="<your-api-key>"
```

Виклики нижче, що щось видаляють або змінюють, використовують ідентифікатори, які виводять списки, як `$VM_ID`, `$FLOATING_IP_ID`, `$VOLUME_ID` і `$PORT_ID`.

## 1 · Забуті зупинені VM {#stopped-vms}

Зупинка VM не зупиняє її тарифікацію: VM тарифікується від створення до видалення ([Віртуальні машини](/docs/api/vms#lifecycle)). Знайдіть зупинені:

```bash
curl -s {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.status == "SHUTOFF") | { id, name, vcores, memory }'
```

Якийсь час зупинена VM — цілком слушний кандидат для відкату, як під час [blue/green-розгортання](/docs/guides/blue-green#stop-blue). Коли це вже не так, видаліть її:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/action \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"servers\": [\"$VM_ID\"], \"cmd\": \"delete\" }"
```

Видалення VM видаляє завантажувальний том, створений з її образу, і цього не скасувати, тож спершу скопіюйте все, що вам ще потрібно. Томи, які ви підʼєднали пізніше, залишаються, і їх знаходить крок 3.

## 2 · Плаваючі IP, за якими нічого немає {#unattached-ips}

Плаваючий IP тарифікується від моменту створення до видалення, незалежно від того, підʼєднаний він чи ні ([Плаваючі IP](/docs/api/floating-ips#billing)). Знайдіть непідʼєднані:

```bash
curl -s {{API_BASE_URL}}/api/v1/floating_ip/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.port_id == null) | { id, ip_address, description }'
```

Видаліть непотрібні, перелічивши їхні ідентифікатори в `ids`:

```bash
curl -X DELETE {{API_BASE_URL}}/api/v1/floating_ip/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"ids\": [\"$FLOATING_IP_ID\"] }"
```

Якщо адреса є десь у списку дозволених, спершу змініть це: видалену адресу ви можете вже не отримати назад.

## 3 · Томи, які не використовує жодна VM {#volumes}

Том тарифікується однаково, підʼєднаний він чи ні ([Блокове сховище](/docs/api/block-storage#lifecycle)). Про томи, що пережили свою VM, легко забути. Знайдіть їх:

```bash
curl -s {{API_BASE_URL}}/api/v1/storage/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.status == "available") | { id, name, size, type }'
```

Видалений том відновити неможливо, тож, якщо дані можуть знадобитися, спершу [зробіть його бекап](/docs/api/backups#create). Потім видаліть його:

```bash
curl -X DELETE {{API_BASE_URL}}/api/v1/storage/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"ids\": [\"$VOLUME_ID\"] }"
```

## 4 · VM із надлишковими ресурсами {#over-provisioned}

Ціна VM залежить від її `architecture`, `vm_class`, `cpu` і `ram`. Якщо використання CPU й памʼяті VM постійно низьке, вона може працювати в меншій конфігурації. Перш ніж вирішувати, виміряйте: як налаштувати метрики, показано на сторінці [Моніторинг парку VM](/docs/guides/monitoring-vms).

Змініть розмір, передавши новий `spec`; на сторінці [Швидкий старт](/docs/quickstart#region) показано, звідки беруться `$ARCHITECTURE` і `$VM_CLASS`. VM перезапускається в новій конфігурації й чекає в стані `VERIFY_RESIZE`:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/$VM_ID/resize \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 2,
      \"ram\": 4096
    }
  }"
```

Перевірте VM під реальним навантаженням, а потім залиште нову конфігурацію або поверніться до старої через `revert_resize`:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/$VM_ID/confirm_resize \
  -H "X-API-Key: $NIMBUS_KEY"
```

Подробиці наведено на сторінці [Розміри VM](/docs/api/vm-sizes#resizing).

## 5 · Публічні порти й пропускна здатність {#bandwidth}

Порт у зовнішній мережі тарифікується, доки ви його не видалите, а разом із ним — його пропускна здатність, як і пропускна здатність зовнішнього шлюзу маршрутизатора ([Мережеві порти](/docs/api/network-ports), [Маршрутизатори](/docs/api/routers)). VM, якій не потрібно бути доступною з інтернету, може натомість працювати в приватній мережі ([Налаштування мережі проєкту](/docs/guides/networking-setup)).

Отримайте список портів у зовнішній мережі; зовнішні мережі перелічує `GET /api/v1/floating_ip/artifacts`:

```bash
curl -s "{{API_BASE_URL}}/api/v1/portal/port/?network_id=$EXTERNAL_NETWORK_ID" \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | { id, name, device_id, status }'
```

Порт із порожнім `device_id` ні до чого не підʼєднаний. Видаліть його через `DELETE /api/v1/portal/port/{port_id}`.

Якщо порт потрібен, а вся його пропускна здатність — ні, зменште її через `POST /api/v1/bandwidth/resize`: цей виклик змінює ліміт порту, плаваючого IP або шлюзу маршрутизатора, а разом із ним і тарифікацію. `bandwidth_mbps` має бути кратним 10:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/bandwidth/resize \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"resource_type\": \"port\",
    \"resource_id\": \"$PORT_ID\",
    \"bandwidth_mbps\": 100,
    \"bandwidth_subscription\": \"Monthly\"
  }"
```

## 6 · Власні образи {#images}

Власний образ тарифікується за GB з округленням угору до цілого GB як окремий продукт ([Образи VM](/docs/api/vm-images)). Отримайте список своїх приватних образів, а потім через `DELETE /api/v1/image/` видаліть ті, з яких більше нічого не завантажується:

```bash
curl -s "{{API_BASE_URL}}/api/v1/image/?visibility=private" \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | { id, name, size, created_at }'
```

## Аналіз самого рахунку {#invoice}

`GET /api/v1/billing/public/balances` показує неоплачені нарахування вашого робочого простору, промокредит і баланс передоплати, а `GET /api/v1/billing/public/accrued_charges` — загальну суму нарахувань на цей момент, яку ще не сплачено. Ці виклики потребують сесії, у яку ви ввійшли, а не API-ключа, а самі рахунки через API недоступні ([Білінг](/docs/api/invoices)).

## Що далі {#next-steps}

- [Дані про ціни](/docs/api/pricing-data) — скільки коштує кожен із цих ресурсів.
- [Білінг](/docs/api/invoices) — ваші баланси й нарахування, які ще не сплачено.
- [Розміри VM](/docs/api/vm-sizes) — конфігурації та все про зміну розміру.
- [Бекапи](/docs/api/backups) — як скопіювати том перед видаленням і як довго розклади зберігають копії.
- [Квоти](/docs/api/quotas) — ліміти ресурсів на проєкт, окремі від білінгу.
