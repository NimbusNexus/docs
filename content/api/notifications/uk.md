---
title: "Сповіщення"
description: "Ваші сповіщення в застосунку: перелік, позначення прочитаними, видалення й отримання наживо через WebSocket."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: notifications
---

# Сповіщення

Сповіщення — це повідомлення в застосунку, адресоване одному користувачу, наприклад запрошення до робочого простору чи відповідь на запит щодо квоти. Кожне має `title` і `message`, `delivery_status` (`pending`, `unread` або `read`), `visual_type` (`info`, `system`, `invite`, `payment`, `billing`, `warning`, `critical` або `resize`) і необовʼязкові `meta_data` про обʼєкт, якого воно стосується.

`GET /api/v1/notifications/list` повертає сповіщення того, хто здійснює виклик, від найновіших, разом із `total` і `unread_count`. Фільтруйте їх за `statuses`, `workspace_id`, `meta_data_key` і `meta_data_value`, а для пагінації використовуйте `offset` і `limit` (до 200). Позначте одне сповіщення прочитаним через `PATCH /api/v1/notifications/` або кілька одразу — через `PATCH /api/v1/notifications/bulk`. `DELETE` за тими самими двома шляхами видаляє їх.

Щоб отримувати сповіщення наживо, відкрийте WebSocket до `/api/v1/ws` із токеном сесії в заголовках рукостискання. `GET /api/v1/notifications/websocket-info` описує це зʼєднання.

## Що далі {#next-steps}

- [Робочі простори](/docs/api/workspaces) — запрошення до робочого простору надходять як сповіщення.
- [Квоти](/docs/api/quotas) — так само надходять і відповіді на запити щодо квот.
- [Білінг](/docs/api/invoices) — адреси електронної пошти, на які надходять виписки й квитанції.
