---
title: "Notificações"
description: "Suas notificações no app — liste, marque como lidas, exclua e receba ao vivo por um WebSocket."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: notifications
---

# Notificações

Uma notificação é uma mensagem no app endereçada a um usuário, por exemplo um convite para um workspace ou a resposta a uma solicitação de cota. Cada uma tem um `title` e uma `message`, um `delivery_status` (`pending`, `unread` ou `read`), um `visual_type` (`info`, `system`, `invite`, `payment`, `billing`, `warning`, `critical` ou `resize`) e, opcionalmente, `meta_data` sobre o objeto a que ela se refere.

`GET /api/v1/notifications/list` retorna as notificações de quem chama, das mais novas para as mais antigas, com um `total` e um `unread_count`. Filtre com `statuses`, `workspace_id`, `meta_data_key` e `meta_data_value`, e pagine com `offset` e `limit` (até 200). Marque uma como lida com `PATCH /api/v1/notifications/`, ou várias de uma vez com `PATCH /api/v1/notifications/bulk`. `DELETE` nesses mesmos dois caminhos as remove.

Para a entrega ao vivo, abra um WebSocket para `/api/v1/ws` com o token da sua sessão nos headers do handshake. `GET /api/v1/notifications/websocket-info` descreve a conexão.

## Próximos passos {#next-steps}

- [Workspaces](/docs/api/workspaces) — os convites para workspaces chegam como notificações.
- [Cotas](/docs/api/quotas) — as respostas a solicitações de cota também.
- [Faturamento](/docs/api/invoices) — os endereços de e-mail que recebem extratos e recibos.
