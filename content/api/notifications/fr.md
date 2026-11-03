---
title: "Notifications"
description: "Vos notifications dans l’application — listez-les, marquez-les comme lues, supprimez-les et recevez-les en direct par un WebSocket."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: notifications
---

# Notifications

Une notification est un message dans l’application adressé à un seul utilisateur, par exemple une invitation à rejoindre un espace de travail ou la réponse à une demande de quota. Chacune a un `title` et un `message`, un `delivery_status` (`pending`, `unread` ou `read`), un `visual_type` (`info`, `system`, `invite`, `payment`, `billing`, `warning`, `critical` ou `resize`) et, en option, des `meta_data` sur l’objet qu’elle concerne.

`GET /api/v1/notifications/list` renvoie les notifications de l’appelant, de la plus récente à la plus ancienne, avec un `total` et un `unread_count`. Filtrez avec `statuses`, `workspace_id`, `meta_data_key` et `meta_data_value`, et paginez avec `offset` et `limit` (jusqu’à 200). Marquez-en une comme lue avec `PATCH /api/v1/notifications/`, ou plusieurs à la fois avec `PATCH /api/v1/notifications/bulk`. `DELETE` sur ces deux mêmes chemins les supprime.

Pour une livraison en direct, ouvrez un WebSocket vers `/api/v1/ws` avec votre token de session dans les headers du handshake. `GET /api/v1/notifications/websocket-info` décrit la connexion.

## Étapes suivantes {#next-steps}

- [Espaces de travail](/docs/api/workspaces) — les invitations à rejoindre un espace de travail arrivent sous forme de notifications.
- [Quotas](/docs/api/quotas) — tout comme les réponses aux demandes de quota.
- [Facturation](/docs/api/invoices) — les adresses e-mail qui reçoivent les relevés et les reçus.
