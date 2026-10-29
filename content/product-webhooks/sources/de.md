---
title: "Quellen"
description: "Webhooks von Stripe, GitHub, Clerk, Resend oder jedem Absender, der mit HMAC signiert, empfangen und als Events an Ihre Endpoints zustellen."
publishedAt: 2026-10-19
updatedAt: 2026-10-29
kind: concept
---

# Quellen

Eine Quelle ist eine URL, die Sie einem Anbieter geben — Stripe, GitHub, Clerk, Resend oder jedem anderen Absender, der seine Webhooks signiert —, damit er an uns senden kann. Wir prüfen die Signatur jedes Requests, machen daraus ein Event und stellen es an Ihre Endpoints zu, genau wie ein Event, das Sie [selbst veröffentlicht](/docs/product-webhooks/quickstart#publish) haben: dieselben Abos, dieselben Retries, dieselbe Dead-Letter-Queue.

Nutzen Sie eine Quelle, wenn Sie einen zentralen Ort für Webhook-Traffic in beide Richtungen wollen oder wenn mehrere Ihrer Dienste die Events eines Anbieters empfangen sollen, ohne dass jeder einzeln die Signatur von Stripe prüft.

## Wie aus einem Request Zustellungen werden {#flow}

1. Der Anbieter sendet per POST an die Ingest-URL der Quelle, `{{WEBHOOKS_BASE_URL}}/v1/ingest/{source_id}`.
2. Wir prüfen die Signatur über genau die empfangenen Bytes, gegen das Signatur-Secret der Quelle.
3. Der Body muss ein JSON-Objekt sein. Wir lesen daraus den Event-Typ (siehe [Event-Typen aus einer Quelle](#event-types)).
4. Das Event wird im Projekt der Quelle veröffentlicht und mit den Abos Ihrer Endpoints abgeglichen, wodurch pro passendem Endpoint eine Zustellung entsteht.
5. Der Anbieter erhält `202`. Ihre Endpoints erhalten das Event, signiert mit *ihrem* Secret, nicht mit dem des Anbieters.

Die Ingest-URL ist der einzige Teil von Webhooks, der Requests ohne API-Key annimmt: Die Signatur des Anbieters ist das Credential.

## Anbieter und ihre Signaturen {#providers}

| Anbieter | Geprüfter Header | Signierte Bytes | Replay-Fenster |
|---|---|---|---|
| `stripe` | `Stripe-Signature: t=…,v1=…` | `{t}.{body}` | 5 Minuten |
| `github` | `X-Hub-Signature-256: sha256=…` | `{body}` | keines (GitHub sendet keinen Timestamp) |
| `standard` | `webhook-signature: v1,…` mit `webhook-id` und `webhook-timestamp` oder dieselben drei als `svix-*` | `{id}.{timestamp}.{body}` | 5 Minuten |
| `standard` | oder `X-Webhook-Signature: sha256=…` mit `X-Webhook-Timestamp` | `{timestamp}.{body}` | 5 Minuten |

Alle drei verwenden HMAC-SHA256. Eine Quelle vom Typ `standard` nimmt zwei Formate an und unterscheidet sie an den Headern: Ein Request mit `X-Webhook-Signature` wird als unser eigenes Format geprüft, jeder andere nach dem Verfahren [Standard](https://www.standardwebhooks.com/). Das Standard-Verfahren verwendet jeder Absender auf Basis von Svix, darunter Clerk und Resend. Unser eigenes Format ist dasselbe Verfahren, mit dem wir unsere Zustellungen signieren, sodass der Endpoint eines Webhooks-Workspaces die Quelle eines anderen speisen kann und jeder Absender, den Sie kontrollieren, mit wenigen Zeilen auf diese Weise signieren kann.

## Quelle anlegen {#create}

In der Konsole: **Sources → New source** (auch auf der Seite Overview). Oder über die API:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/sources \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "provider": "stripe",
        "name": "Stripe live",
        "secret": "whsec_…",
        "event_type_prefix": "stripe."
      }'
```

- **Stripe und GitHub**: Fügen Sie das Signatur-Secret ein, das Ihnen der Anbieter anzeigt. Eine Quelle, die ohne Secret angelegt wird, ist zunächst deaktiviert; fügen Sie das Secret später mit `rotate-secret` hinzu und aktivieren Sie die Quelle.
- **Standard**: Fügen Sie das Secret `whsec_…` ein, das Ihr Absender in seinen Webhook-Einstellungen anzeigt (Clerk, Resend), oder lassen Sie `secret` weg, dann erzeugen wir eines und geben es einmal in dieser Antwort zurück. Ein erzeugtes Secret signiert in beiden Formaten.

Die Antwort enthält `ingest_url`. Tragen Sie die URL in die Webhook-Einstellungen des Anbieters ein und fügen Sie einen Endpoint hinzu, der die erwarteten Typen abonniert (oben `prefix` `stripe.`).

## Event-Typen aus einer Quelle {#event-types}

Jeder Request braucht einen Event-Typ, den Endpoints abonnieren können. Eine Quelle ermittelt ihn in dieser Reihenfolge:

1. Dort, wo sie laut Ihrer Vorgabe suchen soll: in einem **Header** des Requests oder in einem **JSON-Pfad** mit Punkten im Body (`data.object.type`).
2. Andernfalls an der eigenen Stelle des Anbieters: `type` im Body bei Stripe und Standard, der Header `X-GitHub-Event` bei GitHub.
3. Liefert keines von beiden einen Wert: der **Standardtyp** der Quelle und, falls es keinen gibt, `webhook.received`.

Das **Präfix** der Quelle wird vorangestellt (`stripe.` + `invoice.paid` → `stripe.invoice.paid`), was die Typen zweier Anbieter in einem Projekt auseinanderhält. Wenn Ihre Liste der Event-Typen `webhook.received` zeigt, hat eine Quelle Requests ohne lesbaren Typ empfangen: Legen Sie für diese Quelle einen Standardtyp oder einen JSON-Pfad fest.

Die eigene Event-ID des Anbieters (`evt_…` bei Stripe, die Delivery-ID bei GitHub, der Header `webhook-id` bei einem Request im Standard-Format, die `id` im Body bei unserem eigenen Format) ist der Idempotency-Key. Wenn ein Anbieter ein Event wiederholt, das wir bereits angenommen haben, erhält er also erneut `202`, und nichts wird doppelt zugestellt.

## Was der Anbieter sieht {#responses}

| Status | Wann |
|---|---|
| `202` | Angenommen und veröffentlicht. |
| `400` | Der Body ist kein JSON oder kein JSON-Objekt. |
| `401` | Die Signatur ließ sich nicht verifizieren — sie fehlt, ist fehlerhaft, passt nicht zum Secret oder liegt außerhalb des Replay-Fensters. Absichtlich eine Antwort für alle diese Fälle. |
| `402` | Der Workspace hat sein monatliches Kontingent für Zustellungen aufgebraucht. |
| `404` | Keine solche Quelle, oder die Quelle ist deaktiviert. |
| `409` | Die Event-ID des Anbieters wurde bereits mit einem anderen Body angenommen. |
| `413` | Der Request ist größer als 512 KiB oder die Payload größer als 256 KiB. |
| `422` | Der Typ ist nicht registriert, und die [Richtlinie für Event-Typen](/docs/product-webhooks/event-types#policy) steht auf Strict, oder die Payload entspricht nicht dem JSON Schema des Typs. |
| `429` | Zu viele Requests: 600 pro Minute und Quelle vor der Signaturprüfung, danach die Publish-Rate Ihres Tarifs. |

Anbieter wiederholen bei allem außer 2xx, eine Abweisung geht auf ihrer Seite also nicht verloren — um aber zu sehen, *warum* wir abgewiesen haben, schalten Sie die Aufzeichnung für die Quelle ein und lesen Sie [Erfasste Requests](/docs/product-webhooks/captured-requests).

## Secret rotieren {#rotate}

Wenn der Anbieter sein Secret wechselt, senden Sie das neue:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/sources/src_…/rotate-secret \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"secret": "whsec_new…"}'
```

Das vorherige Secret verifiziert noch 24 Stunden lang weiter, sodass Requests, die mit dem einen oder dem anderen signiert sind, angenommen werden, während der Anbieter umstellt. Bei einer Quelle vom Typ standard senden Sie das neue Secret des Absenders oder einen leeren Body, dann erzeugen wir eines.

## Nächste Schritte {#next-steps}

- [Erfasste Requests](/docs/product-webhooks/captured-requests) — die Requests sehen, wie eine Quelle sie empfangen hat, Abweisungen eingeschlossen.
- [Quellen in der API-Referenz](/docs/reference/webhooks#ref-sources) — jede Operation für Quellen, mit den Aufrufen für SDK und CLI.
- [Event-Typen](/docs/product-webhooks/event-types) — der Katalog der Typen und was mit einem unbekannten geschieht.
- [Zustellungen und Retries](/docs/product-webhooks/deliveries) — was geschieht, nachdem ein Event veröffentlicht wurde.
- [Überblick über Webhooks](/docs/product-webhooks) — die Objekte und wie sie zusammenpassen.
