---
title: "Transformationen"
description: "Jede Zustellung mit einer kurzen JavaScript-Funktion, die in einer Sandbox läuft, umformen, filtern oder verwerfen, bevor die Zustellung signiert und gesendet wird."
publishedAt: 2026-10-30
updatedAt: 2026-10-30
kind: concept
---

# Transformationen

Eine Transformation ist eine kurze JavaScript-Funktion an einem Endpoint. Sie erhält jedes Event, bevor wir es zustellen, und gibt stattdessen den Request zurück, der gesendet werden soll, oder `null`, damit nichts gesendet wird. Sie läuft einmal pro Zustellung in einer Sandbox ohne Netzwerkzugriff und mit einem festen Budget für CPU und Speicher; was sie zurückgibt, wird mit dem Secret des Endpoints signiert und wie jede andere Zustellung gesendet.

## Wofür sie gedacht ist {#what-for}

- **Empfänger, die ein eigenes Format brauchen.** Slack, Microsoft Teams und Discord nehmen nur ihre eigenen Nachrichtenformate an und lehnen unseren Envelope ab. Eine Transformation wandelt jedes Event in eine Nachricht um, die sie annehmen; die [Presets](#presets) erledigen das für Sie.
- **Ein anderes Format für jeden Empfänger.** Ihr eigener Dienst erhält die ganze Payload, ein CRM drei Felder, ein Analytics-Anbieter nichts, was personenbezogene Daten enthält.
- **Filtern nach der Payload.** Ein [Abo](/docs/product-webhooks#objects) gleicht nur den Event-Typ ab. „Nur `invoice.paid` über $1.000“ braucht die Payload, und die kann ein Skript lesen.

## Das Skript {#script}

Eine Transformation ist eine einzelne Funktion namens `transform`:

```js
function transform(event, context) {
  // event:   { id, type, created_at, data, version }, the envelope we would otherwise send
  // context: { endpoint: { id, description }, attempt }
  if (event.type === "invoice.paid" && event.data.amount < 100000) {
    return null; // send nothing for small invoices
  }
  return {
    body: { text: `Invoice ${event.data.id} paid: ${event.data.amount / 100} ${event.data.currency}` },
    headers: { "X-Team": "billing" },
  };
}
```

Was sie zurückgibt, bestimmt, was gesendet wird:

| Rückgabe | Gesendet wird |
|---|---|
| `{ body: { … } }` oder `{ body: [ … ] }` | Der Body als JSON, mit `Content-Type: application/json`. |
| `{ body: "…" }` | Der String unverändert, mit `Content-Type: text/plain; charset=utf-8`. |
| `{ body: …, contentType: "…" }` | Der Body mit diesem Content-Type. |
| `{ body: …, headers: { … } }` | Der Body mit diesen zusätzlichen Headern, für die dieselben Regeln gelten wie für die Custom-Header eines Endpoints. Setzen Sie `contentType` statt eines Headers `Content-Type`. |
| `null` | Nichts. Die Zustellung wird [verworfen](#dropped). |

URL und Methode bleiben die des Endpoints: Die URL ist die, die registriert, geprüft und, sofern verlangt, [verifiziert](/docs/product-webhooks/endpoint-verification) wurde. Was das Skript mit `console.log` ausgibt, wird mit der Zustellung aufbewahrt, bis zu 4 KiB.

Das Skript ist schlichtes modernes JavaScript in einer einzigen Datei. Es hat keinen Netzwerkzugriff, kein Dateisystem und keine Timer, und es kann keine Module importieren; eine Bibliothek, die es braucht, muss daher in das Skript gebündelt werden.

## Presets {#presets}

Presets sind Skripte, die wir schreiben und pflegen, für die Empfänger, nach denen am häufigsten gefragt wird:

| Preset | Sendet |
|---|---|
| **Slack message** | Typ, ID und Daten des Events als Slack-Nachricht, für einen Incoming Webhook von Slack. |
| **Microsoft Teams card** | Das Event als Adaptive Card, für einen Workflow-Webhook in Teams. |
| **Discord message** | Typ, ID und Daten des Events als Discord-Nachricht, für den Webhook eines Discord-Kanals. |
| **Keep only these fields** | Den Envelope nur mit den Feldern von `data`, die Sie angeben. Ein Name mit Punkten wie `customer.id` greift auf verschachtelte Felder zu. |

Wenn Sie ein Preset wählen, wird sein Skript als Ihre eigene Transformation gespeichert, die Sie wie jede andere öffnen und ändern können. [Slack, Teams und Discord](/docs/product-webhooks/chat-apps) führt für jeden dieser Empfänger von Anfang an durch die Einrichtung.

## Transformation einrichten {#set-up}

Öffnen Sie in der Konsole auf der Seite **Endpoints** das Menü des Endpoints und wählen Sie **Transformation**. Entscheiden Sie sich für **Preset** oder **Script**, [testen Sie die Transformation](#test) und speichern Sie mit **Save**: Ab der nächsten Zustellung des Endpoints läuft sie. Mit **Off** entfernen Sie sie wieder.

Über die API legen Sie die Transformation im Projekt des Endpoints an und verknüpfen den Endpoint dann mit ihr:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "CRM fields", "project_id": "prj_…", "code": "function transform(event) { return { body: { id: event.id, total: event.data.total } }; }"}'

curl -sX PATCH {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a… \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"transformation_id": "tr_…"}'
```

Bevor wir das Skript speichern, laden wir es in der Sandbox, ohne es aufzurufen: Ein Syntaxfehler, eine fehlende Funktion `transform` oder Code auf oberster Ebene, der fehlschlägt, wird mit `422 invalid_transformation` abgewiesen, und es wird nichts gespeichert. Ein Endpoint führt höchstens eine Transformation aus; eine Transformation kann mehreren Endpoints ihres Projekts dienen. `{"transformation_id": null}` trennt sie wieder vom Endpoint.

## Skript testen {#test}

**Test** führt das Skript im Editor aus, ob gespeichert oder nicht, in derselben Sandbox, die auch Zustellungen nutzen, mit einem Event aus den letzten Zustellungen des Endpoints oder einem, das Sie einfügen. Der Test zeigt, was gesendet würde, die Header, die Logs und wie lange die Ausführung gedauert hat. Es wird nichts gesendet und nichts gespeichert.

Über die API:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations/test \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"code": "function transform(event) { return { body: { text: event.type } }; }",
       "event": {"id": "evt_1", "type": "invoice.paid", "created_at": "2026-10-30T12:00:00+00:00", "data": {}, "version": "1"}}'
```

```json
{ "status": "ok", "body": "{\"text\":\"invoice.paid\"}", "content_type": "application/json", "headers": {}, "logs": "", "reason": null, "error": null, "fuel": 2764502, "duration_ms": 3.6 }
```

`status` ist `ok`, `dropped` (das Skript hat `null` zurückgegeben) oder `failed`, wobei `reason` und `error` den Grund nennen. Auch wenn ein Skript fehlschlägt, antwortet der Aufruf mit `200`. Tests und die Prüfungen beim Speichern teilen sich ein Kontingent von 60 pro Minute und Workspace, mit Bursts von bis zu 10.

**Send test ping** an einem Endpoint sendet weiterhin den festen Ping-Body, ohne Transformation; mit **Test** sehen Sie, was Ihr Empfänger erhalten wird.

## Was eine Zustellung festhält {#deliveries}

Das Skript läuft einmal pro Zustellung, beim ersten Versuch. Was es zurückgibt, wird mit der Zustellung gespeichert und wie jeder andere Body mit dem Secret des Endpoints signiert, und jeder Retry sendet genau diese Bytes erneut, ohne das Skript noch einmal auszuführen, sodass ein Retry nicht ändern kann, was der Empfänger erhält. Eine [erneute Zustellung](/docs/product-webhooks/deliveries#replay) führt die aktuelle Version der Transformation erneut aus.

Öffnen Sie in der Konsole auf der Seite **Deliveries** eine Zustellung, um die Transformation und die Version zu sehen, die sie geformt haben, die Dauer der Ausführung, den gesendeten Body und die Logs oder den Fehler. Über die API liefert `GET /v1/deliveries/{id}/transform` diese Ausführung oder `null`, wenn keine Transformation gelaufen ist.

### Verworfene Zustellungen {#dropped}

Wenn das Skript `null` zurückgibt, wird nichts gesendet und kein Versuch unternommen. Die Zustellung endet im Status `sent` mit `"dropped": true`, die Konsole zeigt sie als **dropped**, und die Statistiken von Endpoint und Workspace zählen sie getrennt von den zugestellten: Eine Erfolgsquote wird über das berechnet, was gesendet werden sollte.

## Wenn ein Skript fehlschlägt {#failures}

Eine Ausführung schlägt fehl, wenn das Skript eine Ausnahme wirft, sein Zeit- oder Speicherlimit überschreitet, zu tief rekursiert oder etwas zurückgibt, das kein Request ist (ein Objekt mit einem `body` oder `null`). Die Zustellung geht dann direkt in die Dead-Letter-Queue, mit einem `last_error`, das mit `transform_failed:` beginnt. Das ursprüngliche Event senden wir stattdessen nie: Der Empfänger kann ein Dritter sein, von dem das Skript Daten fernhalten soll.

Jede fehlgeschlagene Ausführung wird der Transformation angerechnet, so wie fehlgeschlagene Zustellungen einem Endpoint. Nach 20 Fehlschlägen in Folge wird die Transformation automatisch ausgeschaltet, die Zustellungen an ihre Endpoints warten, und wir benachrichtigen den Owner des Workspaces per E-Mail und senden einen [Betriebs-Webhook](/docs/product-webhooks/deliveries#operational) `transformation.disabled`. Korrigieren Sie das Skript, testen Sie es und aktivieren Sie die Transformation wieder (**Resume** in der Konsole oder `PATCH /v1/transformations/{id}` mit `{"status": "enabled"}`): Die wartenden Zustellungen werden gesendet, und die in der Dead-Letter-Queue lassen sich [erneut zustellen](/docs/product-webhooks/deliveries#replay).

## Pausieren und Versionen {#versions}

**Pause** (`{"status": "disabled"}`) hält eine Transformation an, ohne sie von ihren Endpoints zu trennen. Die Zustellungen an ihre Endpoints warten, statt ohne Transformation gesendet zu werden: Sie erscheinen als `failed`, mit dem `last_error` „paused: the endpoint's transformation is not running“, und werden gesendet, sobald Sie die Transformation fortsetzen.

Jedes Speichern von neuem Code erzeugt eine neue Version. Die letzten 50 Versionen werden aufbewahrt (`GET /v1/transformations/{id}/versions`), und jede Zustellung hält fest, welche Version sie geformt hat. Um zu einer früheren Version zurückzukehren, laden Sie sie in den Editor und speichern Sie sie: Sie wird dann zur neuesten Version.

## Limits {#limits}

Jede Ausführung erhält:

| Limit | Wert |
|---|---|
| CPU | Etwa 50 ms Skriptzeit, in Instruktionen gezählt statt gemessen, sodass dasselbe Skript dasselbe Budget erhält, unabhängig davon, wie ausgelastet wir sind |
| Gesamtlaufzeit | 1 Sekunde |
| Speicher | 64 MiB |
| Skriptgröße | 1 MiB |
| Ausgabe | 256 KiB |
| Logs | 4 KiB |

Skripte laufen in einem eigenen Dienst, getrennt von der Zustellung, und jeder Workspace kann nur wenige gleichzeitig ausführen, sodass ein langsames oder fehlerhaftes Skript nur seine eigenen Zustellungen trifft, nicht die von anderen. Ein typisches Skript braucht wenige Millisekunden.

## Tarife {#plans}

Transformationen, ob Preset oder Skript, sind in jedem bezahlten Tarif enthalten: Starter, Pro und Custom. Free enthält sie nicht. Die Tarife unterscheiden sich darin, wie viele Skripte eines Workspaces gleichzeitig laufen: 2 in Starter, 4 in Pro und in Custom so viele, wie der Vertrag vorsieht. Die Tarifkarte auf der Seite Overview der Konsole zählt die Ausführungen dieses Monats. Ausführungen werden gezählt, nicht abgerechnet.

Ein Workspace, der seinen bezahlten Tarif verlässt, behält seine Transformationen und kann sie weiterhin umbenennen, pausieren, von Endpoints trennen und löschen, aber weder neuen Code speichern noch eine Transformation testen oder fortsetzen. Zustellungen an einen Endpoint, der noch eine Transformation hat, warten, bis der Tarif wieder Transformationen enthält oder Sie sie vom Endpoint trennen.

## Fehler {#errors}

| Status | Code | Wann |
|---|---|---|
| `402` | `not_entitled` (`feature: transformations`) | Beim Anlegen einer Transformation, beim Speichern von neuem Code, beim Aktivieren oder beim Testen in einem Tarif ohne Transformationen. |
| `422` | `invalid_transformation` | Das Skript ließ sich nicht laden: `syntax_error`, `no_transform`, `code_too_large` oder `load_failed`, mit der Ursache. |
| `409` | `conflict` (`transformation_in_use`) | Beim Löschen einer Transformation, die ein Endpoint noch ausführt. Trennen Sie sie zuerst vom Endpoint. |
| `404` | `not_found` (`transformation`, `transformation_version`) | Die Transformation existiert nicht mehr, oder diese Version wird nicht mehr aufbewahrt. |
| `429` | `rate_limited` | Mehr als die 60 Tests und Prüfungen beim Speichern pro Minute. |
| `503` | `unavailable` (`transform`) | Die Sandbox konnte das Skript gerade nicht ausführen. Es wurde nichts gespeichert; versuchen Sie es erneut. |

## Nächste Schritte {#next-steps}

- [Slack, Teams und Discord](/docs/product-webhooks/chat-apps) — Events mit einem Preset an einen Kanal senden.
- [Zustellungen und Retries](/docs/product-webhooks/deliveries) — was mit einer Zustellung geschieht, nachdem ihr Skript gelaufen ist.
- [Endpoint-Verifizierung](/docs/product-webhooks/endpoint-verification) — warum für Chat-Empfänger die Verifizierung ausgeschaltet sein muss.
- [Überblick über Webhooks](/docs/product-webhooks) — Events, Endpoints und Abos.
