---
title: "Zustellungen und Retries"
description: "Was mit jedem Event nach der Verteilung geschieht — Zustellstatus, der Retry-Zeitplan, die Dead-Letter-Queue und wie Sie erneut senden."
publishedAt: 2026-10-19
updatedAt: 2026-10-30
kind: concept
---

# Zustellungen und Retries

Wenn Sie ein Event veröffentlichen, entsteht eine **Zustellung** für jeden Endpoint, der seinen Typ abonniert hat. Eine Zustellung ist die Einheit, die wir senden, wiederholen und aufzeichnen: Sie sehen jeden ihrer Versuche und was zurückkam, und Sie können sie jederzeit erneut senden.

## Zustellstatus {#states}

| Status | Bedeutung |
|---|---|
| `queued` | Wartet auf den ersten Versuch. |
| `sending` | Ein Versuch läuft. |
| `sent` | Der Endpoint hat mit 2xx geantwortet. Erledigt. Eine Zustellung, die von der [Transformation](/docs/product-webhooks/transformations#dropped) ihres Endpoints verworfen wurde, hat ebenfalls den Status `sent`, mit `"dropped": true`. |
| `failed` | Der letzte Versuch ist fehlgeschlagen, und ein weiterer ist geplant (`next_attempt_at`). Ebenso eine Zustellung, die auf die [pausierte Transformation](/docs/product-webhooks/transformations#versions) ihres Endpoints wartet. |
| `dead` | Keine Versuche mehr übrig, ungesendet zurückgehalten, weil ihr Endpoint zuerst die [Verifizierung](/docs/product-webhooks/endpoint-verification#gated) bestehen muss, oder an der [Transformation](/docs/product-webhooks/transformations#failures) ihres Endpoints gescheitert. Bleibt in der Dead-Letter-Queue, bis Sie sie erneut senden. |

Alles außer 2xx zählt als Fehlschlag: ein Status 4xx oder 5xx, ein Timeout, ein Verbindungs- oder TLS-Fehler. Jeder Versuch wartet bis zu 10 Sekunden auf eine Antwort oder so lange, wie `delivery_timeout_ms` des Endpoints festlegt (100 ms bis 60 s).

## Der Retry-Zeitplan {#retries}

Eine fehlgeschlagene Zustellung wird nach 30 Sekunden wiederholt, dann nach 1, 2, 4 und 8 Minuten, wobei sich der Abstand jedes Mal verdoppelt, bis zu einer Stunde zwischen zwei Versuchen, bis `max_attempts` des Endpoints erreicht ist. Ihr Tarif begrenzt `max_attempts` (5 in Free, 8 in Starter, 10 in Pro).

Wenn die Standardkurve nicht zum Empfänger passt, geben Sie dem Endpoint einen `retry_schedule` — die Verzögerung in Sekunden vor jedem Retry:

```bash
curl -sX PATCH {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a… \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"retry_schedule": [10, 60, 300, 1800]}'
```

Jeder Versuch sendet dieselben Bytes, neu signiert mit einem frischen Timestamp, sodass sich auch eine Zustellung, die eine Stunde zu spät ankommt, noch verifizieren lässt.

## Wenn ein Endpoint wiederholt fehlschlägt {#auto-disable}

Nach 20 Fehlschlägen in Folge wird ein Endpoint automatisch deaktiviert, der Grund wird festgehalten, und wir senden einen [Betriebs-Webhook](#operational) `endpoint.disabled`, damit Sie davon erfahren. Neue Events werden nicht mehr an ihn verteilt. Beheben Sie das Problem beim Empfänger, aktivieren Sie dann den Endpoint (`POST /v1/endpoints/{id}/enable` oder **Enable** in der Konsole) und stellen Sie erneut zu, was er verpasst hat.

## Nachvollziehen, was passiert ist {#attempts}

In der Konsole listet **Deliveries** jede Zustellung mit Status, Versuchen und letztem Fehler auf; öffnen Sie eine, um jeden Versuch zu sehen — Statuscode, Fehler, Dauer — sowie die gesendete Payload. Über die API:

```bash
curl -s "{{WEBHOOKS_BASE_URL}}/v1/deliveries?status=failed&endpoint_id=ep_3f9a…" \
  -H "Authorization: Bearer $READ_KEY"

curl -s {{WEBHOOKS_BASE_URL}}/v1/deliveries/dlv_…/attempts \
  -H "Authorization: Bearer $READ_KEY"
```

Wo das Deployment sie aufzeichnet, enthält ein Versuch außerdem den Anfang des Response-Bodys des Endpoints und die Header, die wir gesendet haben (mit maskierten Credentials).

Wenn der Endpoint eine [Transformation](/docs/product-webhooks/transformations#deliveries) hat, zeigt die Zustellung außerdem die Ausführung, die sie geformt hat — die Version, den gesendeten Body, die Logs oder den Fehler —, und `GET /v1/deliveries/{id}/transform` liefert sie.

## Erneut senden {#replay}

| Was | Wie |
|---|---|
| Eine Zustellung | `POST /v1/deliveries/{id}/redeliver` — aus `dead`, `failed` oder `sent`. |
| Jede Zustellung im Status `dead` (oder `failed`) | `POST /v1/deliveries/redeliver` mit `{"status": "dead"}`, optional eingegrenzt mit `endpoint_id` oder `project_id`. |
| Zustellungen in einem Zeitfenster | `POST /v1/deliveries/replay` mit `from`, `to` und `status` — für „der Empfänger war von 02:00 bis 04:00 Uhr ausgefallen“. Nur mit Admin-Keys; höchstens 10.000 pro Aufruf. |
| Ein Event an einen Endpoint Ihrer Wahl | `POST /v1/events/{id}/replay` mit `{"endpoint_id": "ep_…"}` — auch an einen, der es nicht abonniert hatte. Nur mit Admin-Keys. |

Alle vier erzeugen neue Versuche des gespeicherten Events; sie veröffentlichen kein neues Event, daher bleibt die Event-ID, anhand derer Ihr Endpoint dedupliziert, dieselbe. Ein Endpoint, der die [Verifizierung](/docs/product-webhooks/endpoint-verification#gated) bestehen muss und das noch nicht getan hat, wird abgewiesen (`409 endpoint_not_verified`) oder bei den beiden Sammelvarianten ausgelassen und in `skipped_unverified` gezählt.

## Betriebs-Webhooks {#operational}

Um von Zustellproblemen zu erfahren, ohne die Konsole zu beobachten, lassen Sie einen eigenen Endpoint unsere Betriebs-Events abonnieren: `endpoint.disabled`, `endpoint.degraded`, `endpoint.recovered`, `message.attempt.exhausted` (eine Zustellung ging in den Status `dead`) und `transformation.disabled` (eine [Transformation](/docs/product-webhooks/transformations#failures) wurde nach Fehlschlägen ausgeschaltet). Fügen Sie einen in der Konsole unter **Operational webhooks** hinzu oder mit `POST /v1/operational-endpoints`. Sie werden wie jede andere Zustellung signiert.

## Wie lange Zustellungen aufbewahrt werden {#retention}

Events, ihre Zustellungen und deren Versuche werden 90 Tage lang aufbewahrt.

## Nächste Schritte {#next-steps}

- [Endpoint-Verifizierung](/docs/product-webhooks/endpoint-verification) — warum ein passender Endpoint womöglich gar keine Zustellung erhält.
- [Signaturprüfung](/docs/product-webhooks/signatures) — jede Zustellung auf Ihrer Seite prüfen.
- [Überblick über Webhooks](/docs/product-webhooks) — Events, Endpoints und Abos.
