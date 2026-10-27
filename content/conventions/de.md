---
title: "Konventionen"
description: "Muster, denen die API überall folgt — Ressourcen-IDs, Paginierung, Fehler, Idempotenz, lang laufende Operationen."
publishedAt: 2026-05-19
updatedAt: 2026-10-15
kind: concept
---

# Konventionen

Die API hat einen einzigen Aufbau, der sich bei jeder Ressource wiederholt. Wenn Sie diesen Aufbau kennen, kennen Sie jeden Endpoint — von einer Ressource zur nächsten ändern sich nur die Felder der Ressource selbst.

## Ressourcen-IDs {#resource-ids}

Jede Ressource hat eine stabile, opake ID der Form `<prefix>_<26-char-base32>`:

| Ressource | Präfix | Beispiel |
| --- | --- | --- |
| Virtuelle Maschine | `vm_` | `vm_01H8FZQ4XW9KMP4XQNR3VT7DC2` |
| Verwaltete Datenbank | `db_` | `db_01H8FZQ4XW9KMP4XQNR3VT7DC2` |
| Block-Volume | `vol_` | `vol_01H8FZQ4XW9KMP4XQNR3VT7DC2` |
| Snapshot | `snap_` | `snap_01H8FZQ4XW9KMP4XQNR3VT7DC2` |
| API-Key | `key_` | `key_01H8FZQ4XW9KMP4XQNR3VT7DC2` |

IDs bleiben für die gesamte Lebensdauer der Ressource stabil — sie werden nie wiederverwendet und beim Umbenennen nie neu geschrieben. Verwenden Sie sie in URLs, Fremdschlüsseln und Audit-Logs; die lesbaren Felder `name` nur für die Anzeige.

## Paginierung {#pagination}

Listen-Endpoints akzeptieren zwei Query-Parameter:

- `limit` — Seitengröße. Standard 50, max. 200. Über 200 schlägt die Validierung des Requests fehl: `422` `validation_error` ([Fehler](/docs/errors#codes-validation)).
- `cursor` — opaker Zeiger auf die nächste Seite. Der Response-Body liefert ihn als `pagination.next_cursor`, wenn es weitere Seiten gibt; geben Sie ihn als `cursor` zurück, um weiterzublättern.

Cursors sind opak — versuchen Sie nicht, sie zu dekodieren oder selbst zu bauen. Sie enthalten Sortierung + Filterzustand des ursprünglichen Requests, daher führt ein Filterwechsel mitten in der Paginierung zu undefiniertem Verhalten. Beginnen Sie neu (ohne `cursor`), wenn sich Ihre Filter ändern.

Das Muster im Code:

```bash
# Page 1
curl '{{API_BASE_URL}}/v1/vms?limit=50' \
  -H "Authorization: Bearer $NIMBUS_KEY"

# Page 2 (cursor from page 1's response.pagination.next_cursor)
curl '{{API_BASE_URL}}/v1/vms?limit=50&cursor=eyJpZCI6...' \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Wenn `pagination.next_cursor` fehlt oder null ist, sind Sie auf der letzten Seite.

## Fehler {#errors}

Jede Fehlerantwort verwendet dasselbe JSON-Format:

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
| `200` | Erfolg mit Body. |
| `201` | Ressource erstellt. Der Header `Location` verweist auf die neue Ressource. |
| `202` | Operation angenommen; den Fortschritt verfolgen Sie über `operation.status`. |
| `204` | Erfolg, kein Body (typisch für DELETE). |
| `400` | Der Request ließ sich so, wie er gesendet wurde, nicht lesen. `error.message` nennt den Grund. |
| `401` | Kein verwendbares Credential. Siehe [Authentifizierung](/docs/authentication). |
| `402` | Ihr Tarif oder Ihr Abrechnungsstatus verhindert den Request (ein Kontingent, eine Funktion, die Ihr Tarif nicht enthält, ein eingefrorener Workspace). Ein Retry hilft nicht. |
| `403` | Authentifiziert, aber nicht autorisiert (Scope fehlt, falsches Projekt usw.). Bei Webhooks auch ein Credential, das die API nicht akzeptiert. |
| `404` | Die Ressource existiert nicht, ODER der Aufrufer kann sie nicht sehen. Wir unterscheiden das absichtlich nicht — schon die Existenz preiszugeben, ist ein Zugriffsleck. |
| `409` | Zustandskonflikt (Name bereits vergeben, ein `Idempotency-Key` mit anderem Body wiederverwendet usw.). |
| `413` | Der Body überschreitet das Größenlimit. |
| `422` | Validierung fehlgeschlagen. Bei einem Validierungsfehler (`validation_error`) listet `error.details.errors` die fehlerhaften Eingaben auf; bei den anderen Codes der Webhooks-API mit `422`, etwa `invalid_payload` oder `unknown_event_type`, ist es ein Objekt, das den fehlerhaften Wert oder die verletzte Regel nennt. |
| `429` | Rate-Limit erreicht. Wenn `Retry-After` gesetzt ist, gibt der Header an, wann Sie es erneut versuchen können. |
| `500–504` | Problem auf Serverseite. Idempotente Requests können Sie immer gefahrlos wiederholen. |

## Idempotenz {#idempotency}

Ändernde Endpoints (POST, PUT, PATCH, DELETE) akzeptieren einen optionalen Header `Idempotency-Key`. Übergeben Sie einen beliebigen eindeutigen Wert (üblich ist eine UUID); wir speichern die Antwort 24 Stunden lang zwischen und geben bei einer Wiederholung mit demselben Key dieselbe Antwort zurück.

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web", "size": "gp-2-4", "region": "us-east-1", "image": "ubuntu-24.04" }'
```

Verwenden Sie Idempotency-Keys, wenn Ihr Client einen Request nach einem Netzwerkfehler wiederholen könnte, aber nicht erkennen kann, ob das Original erfolgreich war. Ohne Key gilt standardmäßig „Best-Effort-Retry“; mit Key sind Retries sicher.

GET-Endpoints sind immer idempotent und brauchen den Header nicht.

## Lang laufende Operationen {#operations}

Manche Aktionen sind nicht innerhalb des Request-Lebenszyklus abgeschlossen:

- `POST` für eine VM gibt `202` zurück, während der Hypervisor die Instanz zuteilt.
- `POST` für eine Datenbank gibt `202` zurück, während die Replikate starten.
- Ein Resize eines Volumes und die Migration einer VM geben `202` zurück.

Der Response-Body einer 202-Antwort enthält immer ein Objekt `operation`:

```json
{
  "id": "vm_01H8FZQ4XW9KMP4XQNR3VT7DC2",
  "state": "provisioning",
  "operation": {
    "id": "op_01H8FZ...",
    "kind": "vm_create",
    "status": "running",
    "progress": 0.4,
    "started_at": "2026-05-19T18:30:00Z"
  }
}
```

Zwei Wege, den Fortschritt zu verfolgen:

1. **Polling** — `GET /v1/operations/{op_id}` einmal pro Sekunde. Günstig; zählt als regulärer API-Aufruf gegen die Rate-Limits.
2. **Webhook** — abonnieren Sie im Dashboard eine Callback-URL. Wir senden einen POST, wenn die Operation einen Endzustand erreicht (`succeeded` oder `failed`).

Die meisten Operationen sind in unter 60 Sekunden abgeschlossen. Ausnahmen sind das erstmalige Laden eines VM-Images (~90 Sekunden) und die Einrichtung eines Kafka-Clusters (~180 Sekunden).

## Timestamps {#timestamps}

Alle Timestamps sind **RFC 3339 / ISO 8601 in UTC** mit dem Suffix `Z`:

```text
2026-05-19T18:30:00Z
```

Nie Ortszeit, nie mit Offset, nie eine ganzzahlige Epoch (außer in den Signatur-Headern von Webhooks, die einen Unix-Timestamp tragen, weil das die Konvention von HMAC-Signierern ist). `Date.parse()` in JavaScript und entsprechende Parser der Standardbibliotheken anderer Sprachen verarbeiten dieses Format nativ.

## Nächste Schritte {#next-steps}

- [Authentifizierung](/docs/authentication) behandelt den Aufbau des Auth-Headers und das Scope-Modell.
- Die Referenzseiten — [VMs](/docs/api/vms), [Verwaltete Datenbanken](/docs/api/managed-databases), [Blockspeicher](/docs/api/block-storage), [Objektspeicher](/docs/api/object-storage), [Regionen](/docs/api/regions) — zeigen die Konventionen in der Praxis.
