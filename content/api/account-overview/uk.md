---
title: "Огляд акаунта"
description: "Вхід і сесія: реєстрація, вхід і вихід, скидання чи зміна пароля, перемикання проєкту, робочого простору або регіону."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: account-overview
---

# Огляд акаунта

Ці ендпоінти керують вашим входом і сесією, яку він відкриває. Реєстрація створює [робочий простір](/docs/api/workspaces), названий за вашою електронною адресою, і ви стаєте його першим користувачем. Білінг належить цьому робочому простору; див. [Білінг](/docs/api/invoices).

Кожен виклик стосується власного входу, сесії чи пароля того, хто його здійснює:

- **Реєстрація** — `POST /api/v1/account/registration` надсилає на електронну пошту токен підтвердження. `POST /api/v1/account/reset_password` з `type: register`, `token` і `new_password` (щонайменше 8 символів, з повтором у `confirm_password`) завершує реєстрацію.
- **Вхід і вихід** — `POST /api/v1/account/login` приймає `email` і `password` та повертає `access_token` разом із його `expires_at`. Користувач, створений усередині робочого простору, надсилає також `domain` — назву робочого простору. `GET /api/v1/account/logout` завершує сесію.
- **Паролі** — `POST /api/v1/account/forgot_password_request` надсилає на електронну пошту одноразовий токен для скидання пароля, а `POST /api/v1/account/reset_password` з `type: reset` встановлює новий пароль. `POST /api/v1/account/change_password` приймає `current_password` і новий пароль.
- **Область дії й регіон** — `GET /api/v1/account/rescope` перемикає сесію на `project` або `domain` (робочий простір) і може також змінити її `region`. `GET /api/v1/account/get_scope_choices` перелічує робочі простори, проєкти й регіони, на які можна перемкнутися, `GET /api/v1/account/datacenters` перелічує регіони та їхній стан, а `GET /api/v1/account/un_scope` скидає область дії.

## Що далі {#next-steps}

- [Робочі простори](/docs/api/workspaces) — те, що створює реєстрація; у ньому містяться проєкти.
- [Автентифікація](/docs/authentication) — як працюють API-ключі.
- [Запити на регіони](/docs/api/region-requests) — попросіть NimbusNexus відкрити регіон, якого ще немає.
