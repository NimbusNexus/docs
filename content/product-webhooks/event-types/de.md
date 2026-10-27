---
title: "Event-Typen"
description: "Der Katalog der Event-Namen in einem Workspace, die Richtlinie für Namen, die er noch nicht kennt, und optionale JSON Schemas, denen Payloads entsprechen müssen."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: concept
---

# Event-Typen

Jedes Event hat einen Typ — `order.created`, `stripe.invoice.paid` —, und Endpoints [abonnieren](/docs/product-webhooks#objects) Typen über Muster. Der Event-Typ-Katalog ist die Liste der Namen, die Ihr Workspace verwendet, mit optionaler Beschreibung und optionalem JSON Schema für jeden. Dort legen Sie auch fest, was passiert, wenn ein Name auftaucht, den niemand registriert hat.

## Muss ich Typen registrieren? {#register}

Nein — nicht unter der Standardrichtlinie. Mit **Lenient** wird jeder Typ, den Sie veröffentlichen (oder den eine [Quelle](/docs/product-webhooks/sources) empfängt), angenommen und beim ersten Auftreten in den Katalog aufgenommen. Die meisten Workspaces registrieren nie einen Typ von Hand.

Registrieren Sie einen, wenn Sie:

- **ihn beschreiben** wollen, für alle, die gegen Ihre Webhooks entwickeln;
- **seine Payloads prüfen** wollen, gegen ein JSON Schema (siehe unten);
- oder zu **Strict** wechseln wollen, wo sich nur registrierte Typen veröffentlichen lassen.

Abos von Endpoints gleichen in beiden Fällen den Namen ab; ein Abo auf `order.` setzt nicht voraus, dass `order.created` im Katalog steht.

## Die Richtlinie für nicht registrierte Typen {#policy}

| Richtlinie | Ein nicht registrierter Typ … |
|---|---|
| **Lenient** (Standard) | wird angenommen und in den Katalog aufgenommen. |
| **Strict** | wird mit `422 unknown_event_type` abgewiesen. |

Strict eignet sich für einen Workspace, in dem die Menge der Typen ein Vertrag ist — ein Tippfehler in einem Publisher schlägt dann beim Veröffentlichen deutlich fehl, statt stillschweigend einen Typ zu erzeugen, den kein Endpoint abonniert. Ein Request einer Quelle, der so abgewiesen wird, erscheint in den [erfassten Requests](/docs/product-webhooks/captured-requests#outcomes) als `unknown_event_type`.

Die Richtlinie wird für den Workspace festgelegt und lässt sich pro Projekt festlegen (`PUT /v1/event-types/policy`, mit `?project_id=` für ein einzelnes Projekt). In der Konsole ist es das Steuerelement **When an unregistered type arrives** auf der Seite Event types, und es folgt der Projektauswahl.

## Payload-Schemas {#schemas}

Ein Typ kann ein [JSON Schema](https://json-schema.org/) (Draft 7) tragen. Sobald er eines hat, wird jeder Publish dieses Typs dagegen geprüft, und eine Payload, die nicht passt, wird mit `422 invalid_payload` abgewiesen, mit einer Liste dessen, was fehlgeschlagen ist.

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/event-types \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "name": "order.created",
        "description": "A customer placed an order",
        "payload_schema": {
          "type": "object",
          "required": ["order_id", "total"],
          "properties": {"order_id": {"type": "string"}, "total": {"type": "integer"}}
        }
      }'
```

Schemas werden beim Speichern geprüft: Eines, das kein gültiges JSON Schema ist oder dessen reguläre Ausdrücke den Abgleich extrem verlangsamen könnten, wird mit einer Erklärung abgewiesen.

## Typen für den ganzen Workspace und pro Projekt {#scope}

Ein Typ, der ohne Projekt registriert ist, gilt für jedes Projekt. Einer, der mit `project_id` registriert ist, gilt nur für dieses Projekt und hat dort Vorrang vor einem gleichnamigen Eintrag für den ganzen Workspace — so kann ein Projekt eine eigene Beschreibung oder ein strengeres Schema haben. Die Spalte **Applies to** in der Konsole zeigt, welcher Eintrag welcher ist.

## Woher ein Typ stammt {#origin}

| Herkunft | In der Konsole | Wie er dorthin kam |
|---|---|---|
| `manual` | added here | In der Konsole oder mit `POST /v1/event-types` registriert. |
| `ingest` | from a source | Zuerst über eine Quelle angekommen, unter Lenient. |
| `lenient` | auto-added | Zuerst über die API veröffentlicht, unter Lenient. |

## `webhook.received` {#webhook-received}

Wenn der Katalog `webhook.received` aufführt und Sie diesen Typ nie veröffentlicht haben: Eine Quelle hat Requests empfangen, aus denen sie keinen Typ lesen konnte, und hatte keinen Standardtyp als Rückfall. Geben Sie dieser Quelle einen Standardtyp oder verweisen Sie sie auf den Header oder JSON-Pfad, der den Typ enthält — siehe [Event-Typen aus einer Quelle](/docs/product-webhooks/sources#event-types).

## Nächste Schritte {#next-steps}

- [Quellen](/docs/product-webhooks/sources) — wie eine Quelle den Typ aus dem Request eines Anbieters liest.
- [Überblick über Webhooks](/docs/product-webhooks) — Abos und die anderen Objekte.
- [Fehler](/docs/errors) — `unknown_event_type`, `invalid_payload` und der Rest.
