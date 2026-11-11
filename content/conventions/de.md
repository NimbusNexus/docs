---
title: "Konventionen"
description: "Muster, denen die APIs folgen — Ressourcen-IDs, Paginierung, Fehler, Idempotenz, lang laufende Operationen."
publishedAt: 2026-05-19
updatedAt: 2026-11-11
kind: concept
---

# Konventionen

NimbusNexus hat zwei Arten von APIs, und sie teilen nicht jede Konvention. Die **Infrastruktur-API** unter `{{API_HOST}}` (VMs, Netzwerke, Speicher, DNS und Ihr Konto) hat ihre Routen unter `/api/v1/` und nimmt einen API-Key im Header `X-API-Key` entgegen ([Authentifizierung](/docs/authentication)). Die **APIs der Apps** (Webhooks, Inboxes, Request Bins und die übrigen) haben jeweils eine eigene Basis-URL, mit Routen unter `/v1/`, und nehmen einen Key als Bearer-Token entgegen ([REST-API einrichten](/docs/setup/rest)). Diese Seite sagt, wo sich die beiden unterscheiden.

## Ressourcen-IDs {#resource-ids}

Bei der Infrastruktur-API sind die meisten Ressourcen-IDs UUIDs, etwa `3f0c9e1a-6b7d-4c2e-9a51-7d2b8f4e1c60`; Container und Objekte im Objektspeicher werden über ihren Namen angesprochen. Bei den APIs der Apps tragen IDs ein Präfix, etwa `ep_` für einen Webhooks-Endpoint oder `evt_` für ein Event. Behandeln Sie jede ID als opaken String.

IDs bleiben für die gesamte Lebensdauer der Ressource stabil — sie werden nie wiederverwendet und beim Umbenennen nie neu geschrieben. Verwenden Sie sie in URLs, Fremdschlüsseln und Audit-Logs; die lesbaren Felder `name` nur für die Anzeige.

## Paginierung {#pagination}

Bei Webhooks, Inboxes, Request Bins und Transforms akzeptieren die meisten Listen-Endpoints zwei Query-Parameter ([Paginierung](/docs/pagination#shape) listet die abweichenden auf):

- `limit` — Seitengröße. Standard 50, max. 200. Über 200 schlägt die Validierung des Requests fehl: `422` `validation_error` ([Fehler](/docs/errors#codes-validation)).
- `offset` — wie viele Einträge übersprungen werden. Der Response-Body liefert den nächsten Wert als `next_offset`; geben Sie ihn als `offset` zurück, um weiterzublättern.

Das Muster im Code:

```bash
# Page 1
curl '{{WEBHOOKS_BASE_URL}}/v1/endpoints?limit=50' \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY"

# Page 2 (offset from page 1's response.next_offset)
curl '{{WEBHOOKS_BASE_URL}}/v1/endpoints?limit=50&offset=50' \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY"
```

Wenn `next_offset` null ist, sind Sie auf der letzten Seite.

Bei der Infrastruktur-API antworten die meisten Listen-Endpoints, etwa `GET /api/v1/instance/`, mit der gesamten Liste und nehmen keine Paginierungsparameter entgegen. Diejenigen, die paginieren, tun das auf eine von zwei Arten:

- `limit` und `marker` (die letzte ID oder der letzte Name, den Sie gesehen haben): VM-Images, DNS-Zonen und Record-Sets, Container und Objekte im Objektspeicher.
- `limit` und `offset`: Volume-Backups, Backup-Zeitpläne, externe Speicherverbindungen, Benachrichtigungen.

```bash
# Page 1
curl '{{API_BASE_URL}}/api/v1/zones/?limit=50' \
  -H "X-API-Key: $NIMBUS_KEY"

# Page 2 (marker: the id of the last zone on page 1)
curl '{{API_BASE_URL}}/api/v1/zones/?limit=50&marker=<zone-id>' \
  -H "X-API-Key: $NIMBUS_KEY"
```

## Fehler {#errors}

Die beiden Arten von APIs antworten bei Fehlern unterschiedlich. Bei der Infrastruktur-API trägt ein Fehler `success: false` und eine `message`:

```json
{
  "success": false,
  "message": "Authentication required"
}
```

Ein Validierungsfehler (`422`) trägt stattdessen `errors`, mit den fehlerhaften Feldern:

```json
{
  "success": false,
  "errors": {
    "field": ["Invalid value"]
  }
}
```

Fehlercodes gibt es hier nicht: Verzweigen Sie nach dem Status, und parsen Sie `message` nicht. Jede Antwort trägt einen Header `X-Request-ID`; geben Sie ihn an, wenn Sie den Support kontaktieren.

Jede Fehlerantwort von Webhooks, Inboxes, Request Bins und Transforms verwendet dieses JSON-Format:

```json
{
  "error": {
    "code": "validation_error",
    "message": "request validation failed",
    "details": {
      "errors": [
        {
          "loc": ["body", "event_type"],
          "msg": "Field required",
          "type": "missing"
        }
      ]
    },
    "request_id": "7e4b1d9c2a6f4e8b9d3c5a1f0e2b4c68"
  }
}
```

- `code` — stabiler, maschinenlesbarer String. Verzweigen Sie danach, nicht nach dem Statuscode, wenn derselbe Status mehrere Bedeutungen hat (z. B. kann `402` `quota_exceeded`, `not_entitled` oder `workspace_frozen` sein).
- `message` — lesbarer englischer Text für Logs. Nicht lokalisiert; wenn Sie Endnutzern einen Fehler zeigen, ordnen Sie `code` Ihrem eigenen Text zu.
- `details` — bei manchen Codes vorhanden. Bei einem Validierungsfehler listet `details.errors` die fehlerhaften Eingaben auf; bei vielen anderen Fehlern enthält es einen `reason`, der den Code präzisiert, mit den zugehörigen Werten. Sein Aufbau hängt vom Code ab.
- `request_id` — in jedem Fehler-Body, den die API sendet: dieselbe ID wie im Header `X-Request-ID`, den jede Antwort der API trägt. Eine Antwort vom Edge vor der API (z. B. ein `502` oder `504` oder ein `413` für einen Body, der zu groß ist, um die API zu erreichen) enthält weder den Fehler-Body der API noch den Header `X-Request-ID` ([Fehler](/docs/errors#request-id)). Protokollieren Sie die ID und geben Sie sie an, wenn Sie den Support kontaktieren.
- `next_code` — wird nur gesendet, während ein Code umbenannt wird: der Code, den dieser Fehler danach trägt. Wenn das Feld vorhanden ist, verzweigen Sie danach statt nach `code`. Derzeit wird kein Code umbenannt, daher sendet die API es nicht.

[Fehler](/docs/errors) listet jeden Code und jeden Grund auf und nennt, welche der APIs von Webhooks und Inboxes ihn jeweils sendet. (Frühere Versionen dieser Seite zeigten `validation_failed` als `400`, mit `fields` und `request_id` im Body. Die ersten beiden haben die APIs nie gesendet: Ein Validierungsfehler ist ein `422` `validation_error` mit `details`. Auch `request_id` stand damals nicht im Body; die Fehler-Bodys der API enthalten es inzwischen.)

## HTTP-Statuscodes {#status-codes}

Wir verwenden eine kleine, vorhersehbare Menge:

| Status | Wann |
| --- | --- |
| `200` | Erfolg mit Body. Bei der Infrastruktur-API auch ein Request, dessen Arbeit in die Warteschlange gestellt wurde ([Lang laufende Operationen](#operations)). |
| `201` | Ressource erstellt. |
| `202` | Angenommen: Die Arbeit wird erst nach der Antwort abgeschlossen ([Lang laufende Operationen](#operations)). |
| `204` | Erfolg, kein Body (typisch für DELETE). |
| `400` | Der Request ließ sich so, wie er gesendet wurde, nicht lesen. `error.message`, oder `message` bei der Infrastruktur-API, nennt den Grund. |
| `401` | Kein verwendbares Credential. Siehe [Authentifizierung](/docs/authentication). |
| `402` | Bei den APIs der Apps: Ihr Tarif oder Ihr Abrechnungsstatus verhindert den Request (ein Kontingent, eine Funktion, die Ihr Tarif nicht enthält, ein eingefrorener Workspace). Ein Retry hilft nicht. |
| `403` | Authentifiziert, aber nicht autorisiert (Scope fehlt, falsches Projekt usw.). Bei Webhooks auch ein Credential, das die API nicht akzeptiert. Bei der Infrastruktur-API auch ein Aufruf außerhalb der Zugriffsregeln eines API-Keys. |
| `404` | Die Ressource existiert nicht, ODER der Aufrufer kann sie nicht sehen. Wir unterscheiden das absichtlich nicht — schon die Existenz preiszugeben, ist ein Zugriffsleck. |
| `409` | Zustandskonflikt (Name bereits vergeben, ein `Idempotency-Key` mit anderem Body wiederverwendet usw.). |
| `413` | Der Body überschreitet das Größenlimit. |
| `422` | Validierung fehlgeschlagen. Bei einem Validierungsfehler (`validation_error`) listet `error.details.errors` die fehlerhaften Eingaben auf; bei den anderen Codes der Webhooks-API mit `422`, etwa `invalid_payload` oder `unknown_event_type`, ist es ein Objekt, das den fehlerhaften Wert oder die verletzte Regel nennt. Bei der Infrastruktur-API enthält `errors` die fehlerhaften Felder. |
| `429` | Rate-Limit erreicht. Wenn `Retry-After` gesetzt ist, gibt der Header an, wann Sie es erneut versuchen können. |
| `500–504` | Problem auf Serverseite. Idempotente Requests können Sie immer gefahrlos wiederholen. |

## Idempotenz {#idempotency}

Einige wenige Routen nehmen einen Header `Idempotency-Key` an, damit ein Retry die Arbeit nicht zweimal erledigt. Bei Webhooks ist das das Veröffentlichen eines Events. Übergeben Sie einen beliebigen eindeutigen Wert (üblich ist eine UUID):

```bash
curl -X POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "event_type": "order.created", "payload": { "order_id": "1234" } }'
```

Jede andere Route ignoriert den Header. Bei der Infrastruktur-API ergibt das zweimalige Erstellen einer VM zwei VMs, mit oder ohne Key. [Idempotenz](/docs/idempotency) listet die Routen auf, die ihn annehmen, und sagt, was Sie auf den übrigen tun.

GET-Endpoints sind immer idempotent und brauchen den Header nicht.

## Lang laufende Operationen {#operations}

Manche Aktionen sind nicht innerhalb des Requests abgeschlossen. Bei der Infrastruktur-API antworten sie, sobald die Arbeit in die Warteschlange gestellt ist:

- `POST /api/v1/instance/` (eine VM erstellen) antwortet mit `200` und `{"success": true}`, ohne ID.
- `POST /api/v1/storage/` (ein Volume erstellen) antwortet mit `201`, ohne ID.
- `POST /api/v1/instance/{instance_id}/resize` antwortet mit `200`, und die VM geht anschließend in `VERIFY_RESIZE` über.
- `PUT` und `DELETE` auf einem DNS-Record-Set antworten mit `202`.

Es gibt kein Operationsobjekt, dem Sie folgen können. Um die Arbeit zu verfolgen, lesen Sie die Ressource und beobachten ihren `status`: `GET /api/v1/instance/` zeigt eine neue VM in `BUILD`, dann in `ACTIVE` oder `ERROR`. Eine Abfrage zählt als regulärer API-Aufruf gegen die Rate-Limits.

## Timestamps {#timestamps}

Alle Timestamps sind **RFC 3339 / ISO 8601 in UTC** mit dem Suffix `Z`:

```text
2026-05-19T18:30:00Z
```

Nie Ortszeit, nie mit Offset, nie eine ganzzahlige Epoch (außer in den Signatur-Headern von Webhooks, die einen Unix-Timestamp tragen, weil das die Konvention von HMAC-Signierern ist). `Date.parse()` in JavaScript und entsprechende Parser der Standardbibliotheken anderer Sprachen verarbeiten dieses Format nativ.

## Nächste Schritte {#next-steps}

- [Authentifizierung](/docs/authentication) behandelt den Auth-Header sowie die Rollen und Zugriffsregeln, die einen Key begrenzen.
- Die Referenzseiten — [VMs](/docs/api/vms), [Blockspeicher](/docs/api/block-storage), [Objektspeicher](/docs/api/object-storage), [Regionen](/docs/api/regions) — zeigen die Konventionen in der Praxis.
