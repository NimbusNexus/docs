---
title: "Notificaciones"
description: "Tus notificaciones en la app — lístalas, márcalas como leídas, bórralas y recíbelas en directo por un WebSocket."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: notifications
---

# Notificaciones

Una notificación es un mensaje en la app dirigido a un solo usuario, por ejemplo una invitación a un workspace o la respuesta a una solicitud de cuota. Cada una tiene un `title` y un `message`, un `delivery_status` (`pending`, `unread` o `read`), un `visual_type` (`info`, `system`, `invite`, `payment`, `billing`, `warning`, `critical` o `resize`) y, de forma opcional, `meta_data` sobre el objeto al que se refiere.

`GET /api/v1/notifications/list` devuelve las notificaciones de quien llama, de la más reciente a la más antigua, con un `total` y un `unread_count`. Filtra con `statuses`, `workspace_id`, `meta_data_key` y `meta_data_value`, y pagina con `offset` y `limit` (hasta 200). Marca una como leída con `PATCH /api/v1/notifications/`, o varias a la vez con `PATCH /api/v1/notifications/bulk`. `DELETE` en esas mismas dos rutas las borra.

Para la entrega en directo, abre un WebSocket a `/api/v1/ws` con tu token de sesión en las cabeceras del handshake. `GET /api/v1/notifications/websocket-info` describe la conexión.

## Próximos pasos {#next-steps}

- [Workspaces](/docs/api/workspaces) — las invitaciones a un workspace llegan como notificaciones.
- [Cuotas](/docs/api/quotas) — también las respuestas a las solicitudes de cuota.
- [Facturación](/docs/api/invoices) — las direcciones de email que reciben los extractos y los recibos.
