---
title: "Kontingente"
description: "Limits pro Projekt für VMs, vCPU, RAM, Speicher, Floating-IPs und weitere Ressourcen."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Kontingente

Kontingente sind Limits pro Projekt, die begrenzen, wie viel einer Ressource ein Projekt haben kann. Sie verhindern ausufernde Kosten durch versehentliche Schleifen und stellen sicher, dass der Verbrauch eines Projekts nicht die Kapazität einer Region aufbraucht.

## Wofür es Kontingente gibt {#what}

Die Kontingent-Endpoints decken vier Dienste ab. Jeder antwortet mit seinen eigenen Kontingentnamen, zum Beispiel:

| Dienst | Was er begrenzt | Beispiele für Kontingentnamen |
| --- | --- | --- |
| `nova` | VMs | `instances`, `cores`, `ram` (in MB) |
| `cinder` | Blockspeicher | `volumes`, `gigabytes`, `snapshots`, `backups` |
| `neutron` | Netzwerk | `network`, `subnet`, `port`, `router`, `floatingip`, `security_group` |
| `projects` | Projekte in Ihrem Workspace | `max_projects` |

Die Standardwerte lesen Sie mit `GET /api/v1/quota/{service}?defaults=true`. `max_projects` ist `-1`, also ohne Limit, es sei denn, für Ihren Workspace wurde ein Limit festgelegt.

## Kontingent vs. Verbrauch {#quota-vs-usage}

Die Endpoints liefern beides:

- `GET /api/v1/quota/{service}` — die **Limits**, als Map von Kontingentnamen auf Zahlen.
- `GET /api/v1/quota/{service}/usage` — den **aktuellen Verbrauch**: `used`, `reserved` und `limit` für jeden Kontingentnamen.

`{service}` ist `nova`, `cinder`, `neutron` oder `projects`.

Prüfen Sie immer den Verbrauch, bevor Sie Ressourcen in großer Zahl erstellen; ein Request, der Sie über das Kontingent bringen würde, schlägt fehl (da das Kontingent nicht zeitlich begrenzt ist, hilft Wiederholen nicht — Sie müssen etwas löschen oder das Kontingent erhöhen).

## Kontingent erhöhen {#raising}

Beantragen Sie eine Erhöhung mit `POST /api/v1/quota-request/`: Geben Sie den `service_name`, den `quota_name` und den `new_value` an, und begründen Sie sie in `reason`. Die Anfrage gilt für Ihr aktuelles Projekt oder, wenn der Dienst `projects` ist, für Ihren Workspace. Sie erfordert die Rolle `manager` oder `admin`, und für jedes Kontingent kann jeweils nur eine Anfrage offen sein.

Ein Admin von NimbusNexus prüft jede Anfrage von Hand. Mit der Genehmigung gilt das neue Limit; eine Anfrage kann auch abgelehnt oder Ihnen zur Überarbeitung zurückgeschickt werden. So oder so kommt die Antwort als [Benachrichtigung](/docs/api/notifications) an. `GET /api/v1/quota-request/list` listet Ihre Anfragen auf, und `PATCH` oder `DELETE /api/v1/quota-request/` ändert eine offene Anfrage oder zieht sie zurück.

## Kontingente über Regionen hinweg {#regions}

Die Werte für `nova`, `cinder` und `neutron` gelten für die Region, in der sich Ihre Sitzung befindet; wechseln Sie die Region mit `GET /api/v1/account/rescope?region=<region_name>`. Das Kontingent `projects` zählt die Projekte in Ihrem gesamten Workspace. Die Antworten sind einfache Maps von Kontingentnamen auf Zahlen, ohne Feld für Region oder Scope.

## Nächste Schritte {#next-steps}

- [Projekte](/docs/api/projects) — der Container, für den Kontingente gelten.
- [Authentifizierung](/docs/authentication) — wie Sie diese Endpoints aufrufen.
- [Benachrichtigungen](/docs/api/notifications) — wo die Antwort auf eine Kontingentanfrage ankommt.
