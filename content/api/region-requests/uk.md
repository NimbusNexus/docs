---
title: "Запити на регіони"
description: "Попросіть NimbusNexus відкрити регіон, якого ще немає."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: region-requests
---

# Запити на регіони

Сесія, у яку ви ввійшли, може використовувати будь-який регіон, який обслуговує NimbusNexus: `GET /api/v1/account/datacenters` перелічує їх, а `GET /api/v1/account/rescope?region=<region_name>` перемикає на один із них (див. [Огляд акаунта](/docs/api/account-overview)). Запит на регіон потрібен для місця, якого NimbusNexus ще не обслуговує. Він повідомляє нам, де ви хотіли б побачити наш наступний регіон.

Запит на регіон не змінює квот. Щоб підвищити ліміт, надішліть запит щодо квоти через `POST /api/v1/quota-request/` (див. [Квоти](/docs/api/quotas)).

`POST /api/v1/account/region-requests` обслуговує форму «запросити регіон» на сайті NimbusNexus, тому входу не потребує. Надішліть `email` і `regionCode`: один із `ams`, `par`, `mad`, `sto`, `mil`, `waw`, `dxb`, `tlv`, `bom`, `icn`, `hkg`, `cgk`, `gru`, `mex`, `yyz` або `jnb`, або ж `__other` із назвою місця в `regionOtherText`. `company` і `note` необовʼязкові. Відповідь — лише `success`: нічого не схвалюється й не надається. Ми підраховуємо запити, щоб бачити, де є попит.

## Що далі {#next-steps}

- [Регіони](/docs/api/regions) — список доступних регіонів.
- [Квоти](/docs/api/quotas) — як попросити вищий ліміт.
- [Огляд акаунта](/docs/api/account-overview) — контекст акаунта для доступу до регіонів.
