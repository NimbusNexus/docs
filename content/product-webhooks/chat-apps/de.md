---
title: "Slack, Teams und Discord"
description: "Events an einen Kanal in Slack, Microsoft Teams oder Discord senden — mit einer Vorlage, die jedes Event in eine Nachricht umwandelt, die der Kanal annimmt."
publishedAt: 2026-10-30
updatedAt: 2026-11-03
kind: guide
---

# Slack, Teams und Discord

Slack, Microsoft Teams und Discord geben einem Kanal jeweils eine Webhook-URL, die alles postet, was sie empfängt — aber nur in ihrem eigenen Nachrichtenformat. Den Event-Envelope, den wir normalerweise senden, lehnen sie deshalb ab. Eine [Transformation](/docs/product-webhooks/transformations) schließt diese Lücke. Am Ende dieser Anleitung haben Sie:

- einen Endpoint, der auf die Webhook-URL Ihres Kanals zeigt;
- die Vorlage für diese App, die jedes Event in eine Nachricht umwandelt, die sie annimmt;
- ein Test-Event, das im Kanal gepostet wurde.

Gesamtdauer: etwa 10 Minuten.

## Voraussetzungen {#prereqs}

- Ein Webhooks-Workspace in einem beliebigen Tarif: Die Chat-Vorlagen sind Pipelines, und die sind in jedem Tarif enthalten.
- Das Recht, dem Kanal einen Webhook hinzuzufügen: in Slack, eine App im Workspace zu installieren; in Teams, einen Workflow zu erstellen; in Discord die Berechtigung **Manage Webhooks**.
- Ausgeschaltete [Endpoint-Verifizierung](/docs/product-webhooks/endpoint-verification#cannot-echo) für das Projekt, in dem Sie den Endpoint anlegen. Diese Kanäle nehmen nur ihre eigenen Nachrichten an und können die Challenge der Verifizierung deshalb nie beantworten; ein Endpoint, der sie bestehen muss, empfängt nichts. In bezahlten Tarifen lässt sich die Verifizierung ausschalten; in einem Tarif, der sie verlangt, lassen sich diese Kanäle nicht nutzen.

## 1 · Webhook-URL des Kanals abrufen {#webhook-url}

### Slack {#slack}

Erstellen Sie eine Slack-App für Ihren Workspace und schalten Sie in den Einstellungen der App **Incoming Webhooks** ein. Wählen Sie **Add New Webhook to Workspace**, legen Sie den Kanal fest und autorisieren Sie den Webhook. Kopieren Sie die URL, die etwa so aussieht: `https://hooks.slack.com/services/T…/B…/…`. Die Anleitung von Slack selbst finden Sie unter [Nachrichten über Incoming Webhooks senden](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks).

### Microsoft Teams {#teams}

Öffnen Sie in Teams **Workflows** und starten Sie mit der Vorlage **Send webhook alerts to a channel**. Wählen Sie das Team und den Kanal, speichern Sie den Workflow und kopieren Sie die Webhook-URL aus seinen Details. Die Anleitung von Microsoft selbst finden Sie unter [Eingehende Webhooks mit Workflows für Microsoft Teams erstellen](https://support.microsoft.com/en-us/office/create-incoming-webhooks-with-workflows-for-microsoft-teams-8ae491c7-0394-4861-ba59-055e33f75498).

### Discord {#discord}

Öffnen Sie in Discord **Server Settings → Integrations → Webhooks** und erstellen Sie einen Webhook. Wählen Sie den Kanal, in den er postet, und dann **Copy Webhook URL**; die URL sieht etwa so aus: `https://discord.com/api/webhooks/…/…`. Die Anleitung von Discord selbst finden Sie unter [Einführung in Webhooks](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks).

Behandeln Sie die URL wie ein Secret: Diese Kanäle prüfen unsere Signatur nicht, daher kann jeder, der die URL hat, in den Kanal posten.

## 2 · Endpoint hinzufügen {#endpoint}

Wählen Sie in der Konsole **New endpoint** auf der Seite **Endpoints**, fügen Sie die URL ein und lassen Sie den Endpoint die Events abonnieren, die der Kanal sehen soll. Halten Sie die Liste kurz: Einen Kanal lesen Menschen, und jedes passende Event wird zu einer Nachricht.

Über die API:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://hooks.slack.com/services/T…/B…/…", "project_id": "prj_…",
       "subscriptions": [{"match_kind": "exact", "pattern": "invoice.paid"}]}'
```

## 3 · Mit der Vorlage beginnen {#preset}

Öffnen Sie auf der Seite **Endpoints** das Menü des Endpoints und wählen Sie **Transformation**. Wählen Sie **Pipeline** und unter **Start from a template** die Vorlage Ihrer App — **Use Slack message**, **Use Microsoft Teams card** oder **Use Discord message** — und speichern Sie mit **Save**. Ab jetzt wird jede Zustellung an diesen Endpoint als Nachricht gesendet:

| Vorlage | Was der Kanal zeigt |
|---|---|
| Slack message | Den Event-Typ als Überschrift, ID und Zeitpunkt des Events und seine Daten in einem Codeblock. |
| Microsoft Teams card | Eine Adaptive Card mit Event-Typ, ID und Zeitpunkt und den Daten in Festbreitenschrift. |
| Discord message | Ein Embed mit dem Event-Typ als Titel, den Daten in einem JSON-Codeblock und darunter ID und Zeitpunkt. Es erwähnt niemanden. |

Jede Vorlage kürzt die Daten auf die Limits der App, und nichts im Event kann die Nachricht formatieren, jemanden erwähnen oder den Codeblock vorzeitig beenden. Beim Speichern wird die Pipeline zu Ihrer eigenen: Sie ändert sich nicht, wenn sich die Vorlage ändert.

Über die API liefert `GET /v1/transformations/templates` jede Vorlage mit ihrer `pipeline`: [Legen Sie mit diesem Dokument eine Transformation an](/docs/product-webhooks/transformations#set-up) und setzen Sie dann die `transformation_id` des Endpoints auf sie.

Ein Endpoint, der bereits eines der früheren Presets ausführt, also ein Skript, führt es unverändert weiter aus.

## 4 · Testen {#test}

Wählen Sie unter **Test** auf derselben Seite **Run test**. Der Test führt die Pipeline im Editor mit einem Event aus den letzten Zustellungen des Endpoints aus, oder mit einem, das Sie einfügen, und zeigt die Nachricht, die sie senden würde. Gesendet wird nichts.

Senden Sie dann ein echtes Event: Wählen Sie **Send test event** auf der Seite Overview der Konsole, oder veröffentlichen Sie ein Event, das der Endpoint abonniert hat:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "invoice.paid", "project_id": "prj_…", "payload": {"id": "in_123", "amount": 125000, "currency": "usd"}}'
```

Die Nachricht erscheint innerhalb weniger Sekunden im Kanal. **Send test ping** am Endpoint hilft hier nicht: Diese Funktion sendet den festen Ping ohne Transformation, und der Kanal weist ihn ab.

## Zusammenfassung {#summary}

Jedes Event, das der Endpoint abonniert hat, postet jetzt eine Nachricht in Ihren Kanal. Öffnen Sie auf der Seite **Deliveries** eine Zustellung, um die gesendete Nachricht zu sehen; hat die App mit einem Fehler geantwortet, steht er ebenfalls dort, unter den Versuchen der Zustellung.

## Anpassen {#customize}

Die Schritte der Vorlage gehören jetzt zu Ihrer Pipeline; Sie können sie wie alle anderen ändern. Um den Kanal den Events vorzubehalten, die seine Leser brauchen, fügen Sie einen Schritt **Filter** mit **Send only matching events** und zwei Bedingungen hinzu, `type` **is** `invoice.paid` und `data.amount` **is at least** `100000`, und schieben Sie ihn ganz nach oben, damit er das Event prüft, bevor die Nachricht gebaut wird. Als JSON:

```json
{ "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } } }
```

Eine vom Filter verworfene Zustellung wird nicht gesendet und zählt nicht als fehlgeschlagen. Um zu ändern, was in der Nachricht steht, bearbeiten Sie den Schritt **Reshape the body**, der sie baut; die Konsole zeigt ihn als JSON, das Sie dort ändern und mit **Apply** übernehmen. Seine Werte lesen das Event über [Pfade und Filter](/docs/product-webhooks/transformations#values), etwa `{{ data.amount | money(data.currency) }}`. Testen Sie vor dem Speichern: Eine fehlgeschlagene Ausführung schickt die Zustellung in die Dead-Letter-Queue, nie das ursprüngliche Event an den Kanal.

## Nächste Schritte {#next-steps}

- [Transformationen](/docs/product-webhooks/transformations#templates) — Vorlagen, Pipeline-Schritte, Tests und was geschieht, wenn eine Ausführung fehlschlägt.
- [Endpoint-Verifizierung](/docs/product-webhooks/endpoint-verification#cannot-echo) — Empfänger, die die Challenge nicht beantworten können.
- [Zustellungen und Retries](/docs/product-webhooks/deliveries) — Status, Retries und erneutes Senden.
