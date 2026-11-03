---
title: "Benachrichtigungen"
description: "Ihre In-App-Benachrichtigungen — auflisten, als gelesen markieren, löschen und live über einen WebSocket empfangen."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: notifications
---

# Benachrichtigungen

Eine Benachrichtigung ist eine In-App-Nachricht an einen einzelnen Benutzer, zum Beispiel eine Einladung in einen Workspace oder die Antwort auf eine Kontingentanfrage. Jede hat einen `title` und eine `message`, einen `delivery_status` (`pending`, `unread` oder `read`), einen `visual_type` (`info`, `system`, `invite`, `payment`, `billing`, `warning`, `critical` oder `resize`) und optional `meta_data` zu dem Objekt, das sie betrifft.

`GET /api/v1/notifications/list` gibt die Benachrichtigungen des Aufrufers zurück, die neuesten zuerst, mit einem `total` und einem `unread_count`. Filtern Sie mit `statuses`, `workspace_id`, `meta_data_key` und `meta_data_value`, und blättern Sie mit `offset` und `limit` (bis zu 200). Markieren Sie eine mit `PATCH /api/v1/notifications/` als gelesen oder viele auf einmal mit `PATCH /api/v1/notifications/bulk`. `DELETE` auf denselben beiden Pfaden entfernt sie.

Für die Live-Zustellung öffnen Sie einen WebSocket zu `/api/v1/ws`, mit Ihrem Sitzungstoken in den Headern des Handshakes. `GET /api/v1/notifications/websocket-info` beschreibt die Verbindung.

## Nächste Schritte {#next-steps}

- [Workspaces](/docs/api/workspaces) — Einladungen in einen Workspace kommen als Benachrichtigungen an.
- [Kontingente](/docs/api/quotas) — ebenso die Antworten auf Kontingentanfragen.
- [Abrechnung](/docs/api/invoices) — die E-Mail-Adressen, die Kontoauszüge und Zahlungsbelege erhalten.
