---
title: "Erfasste Requests"
description: "Die Requests aufzeichnen, wie sie bei einer Quelle ankommen — Header, Body und unsere Antwort —, um die Integration eines Anbieters zu debuggen."
publishedAt: 2026-10-19
updatedAt: 2026-10-22
kind: concept
---

# Erfasste Requests

Wenn ein Anbieter sagt, er habe einen Webhook gesendet, und nichts bei Ihren Endpoints angekommen ist, zeigen erfasste Requests, was tatsächlich bei Ihrer [Quelle](/docs/product-webhooks/sources) ankam: jeden Header, den Roh-Body, woher der Request kam und was wir geantwortet haben — einschließlich der Requests, die wir abgewiesen haben und die sonst nirgends eine Spur hinterlassen.

## Aufzeichnung einschalten {#enable}

Die Aufzeichnung gilt pro Quelle und ist **standardmäßig ausgeschaltet**, weil ein erfasster Request den Roh-Body eines echten Webhooks enthält — bei einem Zahlungsanbieter echte Kundendaten. Schalten Sie sie für die eine Quelle ein, die Sie debuggen, beobachten Sie, was ankommt, und schalten Sie sie wieder aus.

- In der Konsole: **Captured requests** zeigt oben auf der Seite einen Schalter für jede Quelle.
- Über die API: `PATCH /v1/sources/{id}` mit `{"capture_enabled": true}`.

Ab dann wird jeder Request an die Ingest-URL dieser Quelle aufgezeichnet, ob angenommen oder nicht.

## Was eine Aufzeichnung enthält {#contents}

| Feld | Bedeutung |
|---|---|
| Methode, Pfad, Query | Die Request-Zeile wie empfangen. |
| Header | Roh, in der Reihenfolge des Eintreffens, Duplikate erhalten — bei einem Anbieter, der zwei Header `Stripe-Signature` sendet, sehen Sie beide. Credential-Header wie `Authorization` und `Cookie` werden geschwärzt; Signatur-Header bleiben erhalten, denn sie sind das, was Sie prüfen. |
| Body | Die ersten 64 KiB, genau wie empfangen. Ein längerer Body wird als *truncated* markiert, und mit einem gekürzten Body lässt sich eine Signatur nicht erneut prüfen. |
| Herkunft | Die IP-Adresse des Absenders. |
| Ergebnis | `accepted` oder der Grund, aus dem wir den Request abgewiesen haben (siehe unten). |
| Antwort an den Absender | Der Status, mit dem wir geantwortet haben; er entspricht dem, was das Dashboard des Anbieters zeigt. |
| Event | Bei einem angenommenen Request das Event, das daraus wurde. |

Wiederholungen werden zusammengefasst: Kommen dieselbe Methode, derselbe Pfad und derselbe Body erneut an, erhöht das den Zähler **times seen** der Aufzeichnung (allein Stripe wiederholt bis zu achtmal), statt eine Zeile hinzuzufügen.

## Ergebnisse {#outcomes}

| Ergebnis | Antwort an den Absender | Bedeutung |
|---|---|---|
| `accepted` | 202 | Geprüft und als Event veröffentlicht. |
| `bad_signature` | 401 | Die Signatur ließ sich mit dem Secret der Quelle nicht verifizieren. |
| `not_json` | 400 | Der Body ist kein JSON-Objekt. |
| `rate_limited` | 429 | Über der Publish-Rate des Workspaces. |
| `over_quota` | 402 | Der Workspace hat sein monatliches Kontingent für Zustellungen aufgebraucht. |
| `too_large` | 413 | Die Payload ist größer als 256 KiB. |
| `unknown_event_type` | 422 | Der Typ ist nicht registriert, und die [Richtlinie für Event-Typen](/docs/product-webhooks/event-types#policy) steht auf Strict. |
| `invalid_payload` | 422 | Die Payload entspricht nicht dem JSON Schema ihres Event-Typs. |
| `duplicate` | 409 | Die Event-ID des Anbieters wurde bereits mit einem anderen Body angenommen. |

`bad_signature` ist meist der erste Befund: das falsche Secret in der Quelle eingetragen oder ein Proxy vor Ihrem Anbieter, der den Body umgeschrieben hat. Vergleichen Sie die erfassten Header mit dem eigenen Zustellprotokoll des Anbieters.

Manche Abweisungen werden nicht aufgezeichnet: ein Request an eine unbekannte oder deaktivierte Quelle (es gibt keine Quelle, für die er aufbewahrt werden könnte), einer über dem Request-Limit von 512 KiB und einer, den das Flood-Limit pro Quelle abweist, bevor seine Signatur geprüft wird. Die [Statustabelle unter Quellen](/docs/product-webhooks/sources#responses) zeigt, was der Absender jeweils sieht.

## Wie lange Aufzeichnungen bleiben {#retention}

Eine Quelle behält ihre neuesten 500 Aufzeichnungen, und jede wird 7 Tage nach ihrem letzten Eintreffen gelöscht. Löschen Sie eine früher in der Konsole oder mit `DELETE /v1/captures/{id}`.

## Über die API lesen {#api}

```bash
# The latest captures for one source, refusals only
curl -s "{{WEBHOOKS_BASE_URL}}/v1/captures?source_id=src_…&outcome=bad_signature" \
  -H "Authorization: Bearer $READ_KEY"

# One capture with its headers and body (base64, since a body may not be UTF-8)
curl -s {{WEBHOOKS_BASE_URL}}/v1/captures/cap_… \
  -H "Authorization: Bearer $READ_KEY"
```

Die Liste lässt Bodys weg; rufen Sie eine Aufzeichnung über ihre ID ab, um `headers_raw` und `body_base64` zu erhalten. Alle Operationen für Aufzeichnungen stehen in der [API-Referenz](/docs/reference/webhooks#ref-captured-requests).

## Was das nicht ist {#not}

Erfasste Requests sind kein Request-Bin, den Sie anlegen und an den Sie beliebigen Traffic senden — sie zeichnen nur auf, was bei Ihren eigenen Quellen ankommt. Für eine URL, die jeden an sie gesendeten HTTP-Request aufzeichnet, nutzen Sie [Request Bins](/docs/product-bins).

## Nächste Schritte {#next-steps}

- [Quellen](/docs/product-webhooks/sources) — die Quelle anlegen und was jede Abweisung bedeutet.
- [Event-Typen](/docs/product-webhooks/event-types) — warum ein Request als `unknown_event_type` abgewiesen werden kann.
- [Zustellungen und Retries](/docs/product-webhooks/deliveries) — was danach mit einem angenommenen Request geschieht.
