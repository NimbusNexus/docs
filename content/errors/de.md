---
title: "Fehler"
description: "Das Fehlerformat, die Fehlercodes, die die APIs von Webhooks, Inboxes und Request Bins senden, und wie Sie mit jedem umgehen."
publishedAt: 2026-05-20
updatedAt: 2026-10-30
kind: concept
---

# Fehler

Jede Fehlerantwort der APIs von Webhooks, Inboxes und Request Bins verwendet dasselbe JSON-Format. Verzweigen Sie nach `error.code` oder nach `error.next_code`, wenn ein Fehler einen solchen Code trägt, um jeden Fall zu behandeln. Parsen Sie `message` nicht, und entscheiden Sie nicht allein nach dem Status: Ein Status kann mehrere Codes tragen, und bei jeder API trägt `402` vier.

> **Aktualisiert am 16.10.2026.** Bei Webhooks wird ein Name für einen Custom-Header, der ein gültiges HTTP-Token mit einem Zeilenvorschub am Ende ist, jetzt wie jeder andere Name abgelehnt, der kein gültiges HTTP-Token ist: `webhooks.custom_header_name_invalid`, mit dem `msg` dieser Regel und ohne `params` ([Request-Validierung](#codes-validation)). Vorher kam der Zeilenvorschub durch die Token-Prüfung, und der Name wurde als Steuerzeichen abgelehnt, mit `params.header`: ab dem 15.10.2026 als `webhooks.custom_header_control_character`, davor als `value_error`. Der Request ist weiterhin ein `422` `validation_error`, und sonst hat sich nichts geändert.
>
> **Aktualisiert am 15.10.2026.** Vor dem Start von v1 ist jede Umbenennung, die bei Inboxes und Webhooks lief, umgesetzt worden: Ein Fehler, der einen `next_code` trug, trägt jetzt diesen Code, mit dem Status dieses Codes, und keine der beiden APIs sendet `next_code` mehr.
>
> - Ein Request, der an der Validierung scheitert, ist bei beiden APIs `validation_error`, weiterhin ein `422`. Bei Inboxes war es `invalid_request`; bei Webhooks war ein Feld, das die API selbst prüft, `unprocessable`. Bei beiden ist `details` `{"errors": [...]}`; bei Webhooks war es eine bloße Liste ([Request-Validierung](#codes-validation)).
> - Jedes `500` ist bei beiden APIs `internal_error` (bei Webhooks war es `internal`).
> - Bei Inboxes ist ein API-Key oder ein Token, das die API nicht erkennt oder nicht verifizieren kann, `invalid_credential`, weiterhin ein `401` (es war `unauthorized`). Ein fehlendes oder widerrufenes Credential oder eine beendete Anmelde-Session ist weiterhin `unauthorized` mit einem `details.reason`.
> - Bei Inboxes trägt ein Status ohne eigenen Code den Code dieses Status, etwa `bad_request` für ein `400` (es war `error`).
> - Bei Webhooks gibt es `plan_violation` nicht mehr. Das Endpoint-Limit ist `quota_exceeded` (`402`, `details.reason` `allocation`), `max_attempts` über der Obergrenze des Tarifs ist ein `422` `validation_error`, und eine RabbitMQ-Quelle unterhalb von Pro oder das Ausschalten der Endpoint-Verifizierung in einem Tarif, der sie verlangt (das tut derzeit kein Tarif), ist `not_entitled` (`402`).
> - Bei Webhooks ist ein Bulk-Replay, dessen `from` nach seinem `to` liegt, ein `422` `validation_error` mit einem Eintrag auf `["body", "to"]`, nicht mehr ein `409` `conflict`.
> - Die eigenen Regeln von Webhooks zu Custom-Headern, Verzögerungen in `retry_schedule`, den Broker-Feldern einer RabbitMQ-Quelle und Tarifnamen geben dem Eintrag einen eigenen `type` statt `value_error`; `loc`, `msg` und `params` sind unverändert ([Request-Validierung](#codes-validation)).
> - Bei Inboxes wird ein Credential, das auf bestimmte Projekte beschränkt ist, mit `details.reason` `project_confined` abgelehnt (es war `project`) ([Was `details` enthält](#details)).
> - Bei Inboxes enthält `details` nur die Felder, die diese Seite aufführt. `quota_exceeded` sendet `max_inboxes`, `max_http_bins` und `monthly_messages` nicht mehr (lesen Sie `metric`, `limit`, `current` und `period`), das `not_entitled` der Lese-API sendet `plan` nicht mehr, und das `rate_limited` pro Inbox sendet `inbox_id` nicht mehr.
>
> Jede `message` ist unverändert, ebenso jeder Status außer dem der beiden Ablehnungen von Webhooks, die zu einem `422` wurden. Diese Änderungen erfolgten vor dem Start von v1 und erhielten daher nicht die Frist von 12 Monaten, die [Wenn ein Code umbenannt wird](#renames) beschreibt; dieser Abschnitt ordnet jeder alten Schreibweise die neue zu.
>
> **Aktualisiert am 05.10.2026.** Fehler-Bodys haben Felder hinzugewonnen und keine verloren: `request_id` (derselbe Wert wie im Header `X-Request-ID`), ein `reason` und benannte Werte in `details` bei viel mehr Fehlern, `params` bei Validierungseinträgen mit einer numerischen Grenze und `next_code` bei einem Fehler, dessen Code umbenannt wird. Jeder Status, jeder `code` und jede `message` ist unverändert. Bei Webhooks nennt ein `conflict` die Kollision in `details.reason`, das monatliche `quota_exceeded` nennt `metric`, `limit`, `current` und `period`, jedes `413` nennt sein `limit`, und `plan_violation` trägt den `next_code`, zu dem es werden wird, mit den `details` dieses Codes ([Wenn ein Code umbenannt wird](#renames)). [Das Format](#shape) beschreibt jedes Feld.
>
> **Korrigiert am 05.10.2026.** Frühere Versionen dieser Seite führten Codes, Status und Felder auf, die die APIs nie gesendet haben, darunter `validation_failed` (400), `rate_limit_exceeded`, `quota_exceeded` als 429 und `fields`. Code, der auf diese prüft, hat nie etwas getroffen. Sie versprachen außerdem eine `request_id` in jedem Body, bevor die APIs eine sendeten; Fehler-Bodys tragen sie jetzt, seit dem 06.10.2026 jeder ([Die Request-ID](#request-id)). [Codes, die diese Seite früher aufgeführt hat](#earlier-versions) ordnet jeden davon dem zu, was die API tatsächlich sendet.

## Das Format {#shape}

Ein Key mit reinem Lesezugriff, der bei Inboxes eine Inbox oder bei Webhooks einen Endpoint anlegen will, erhält von beiden diese Antwort (nur die `request_id` unterscheidet sich):

```json
{
  "error": {
    "code": "forbidden",
    "message": "admin scope required",
    "details": {
      "reason": "scope",
      "required": "admin"
    },
    "request_id": "5f0c2e9a8b7d4c31a6e4f2b1d9c8e7a6"
  }
}
```

Request Bins lehnt denselben Key mit reinem Lesezugriff mit demselben Code und Status ab, aber seine `details` nennen statt eines Scopes die Rolle, die die Aktion braucht: `"reason": "role"` und `"required": "member"`. Ein Key hat diese Rolle mit dem Scope `admin`, in der Kontokonsole **Read & write** ([Was `details` enthält](#details)).

Bis zu fünf Felder. `code`, `message` und `request_id` stehen in jedem Fehler-Body, den die APIs senden; `details` und `next_code` erscheinen, wenn sie etwas zu sagen haben:

| Feld | Immer vorhanden | Bedeutung |
| --- | --- | --- |
| `code` | Ja | Stabiler, maschinenlesbarer String. Verzweigen Sie danach oder nach `next_code`, wenn es vorhanden ist. |
| `message` | Ja | Englischer Text für Logs und Support-Tickets. Nicht lokalisiert und nicht für eine Oberfläche für Endnutzer gedacht. |
| `details` | Nein | Strukturierter Kontext: ein `reason`, der den Code präzisiert, und die zugehörigen Werte, etwa die `id`, die nicht gefunden wurde. Bei einem Validierungsfehler die fehlerhaften Eingaben. Sein Aufbau hängt vom Code ab; bei einem Validierungsfehler ist es `{"errors": [...]}`, eine Liste von Einträgen. Siehe [Was `details` enthält](#details). |
| `request_id` | Ja | Die ID dieses Requests, derselbe Wert wie im Response-Header `X-Request-ID`. Protokollieren Sie sie und nennen Sie sie dem Support; verzweigen Sie nie danach. Siehe [Die Request-ID](#request-id). |
| `next_code` | Nein | Wird nur gesendet, während ein Code umbenannt wird: der Code, den dieser Fehler trägt, sobald die Umbenennung umgesetzt ist. Bevorzugen Sie ihn gegenüber `code`. Derzeit wird kein Code umbenannt, daher sendet keine API das Feld. Siehe [Wenn ein Code umbenannt wird](#renames). |

Dem Objekt `error` können wie jeder Antwort neue Felder hinzugefügt werden; ignorieren Sie die, die Sie nicht verwenden ([Versionierung](/docs/versioning#forward-compat)).

### Was `details` enthält {#details}

Behandeln Sie jedes Feld in `details` als optional: Lesen Sie die, die Sie brauchen, und ignorieren Sie den Rest. Wenn es einen `reason` gibt, ist das ein stabiler, maschinenlesbarer String, der den Code präzisiert: warum ein Request mit `forbidden` abgelehnt wurde oder welche Art von Ressource ein `not_found` nicht gefunden hat. Daneben stehen unter festen Namen die Werte, die dieser Grund braucht. Manche Codes tragen Werte ohne Grund, und viele Fehler tragen gar kein `details`. Wie `code` ist `details.reason` ein offener String, kein Enum: Neue Gründe und neue Codes sind [additive Änderungen](/docs/versioning#additive), behalten Sie also für beide einen Default-Zweig. Die Tabelle listet auf, was Ihnen beim Aufruf der APIs heute begegnen kann. In ihrer Spalte **API** bedeutet **Beide** Webhooks und Inboxes, und Request Bins hat eigene Zeilen.

| `code` | API | `details.reason` | Weitere Felder in `details` |
| --- | --- | --- | --- |
| `unauthorized` | Beide | `missing`: Es wurde kein Credential gesendet. `revoked`: Der Key oder die Session wurde widerrufen. `invalid`: bei Inboxes eine Anmelde-Session, die sich nicht verifizieren ließ, meist weil sie abgelaufen ist; bei Webhooks ein eingehendes Event an `POST /v1/ingest/{source_id}`, dessen Signatur die Prüfung nicht besteht. `no_workspace`, nur bei Inboxes: Das Credential ist an keinen Workspace gebunden. | — |
| `unauthorized` | Request Bins | `missing`: Es wurde kein Credential gesendet. `revoked`: Der Key oder die Session wurde widerrufen. `invalid`: eine Anmelde-Session, die sich nicht verifizieren ließ, meist weil sie abgelaufen ist. `no_workspace`: Die Anmelde-Session ist an keinen Workspace gebunden. | — |
| `forbidden` | Beide | `scope`: Der Scope des Credentials erlaubt das nicht. `project_confined`: ein auf bestimmte Projekte beschränktes Credential, verwendet auf einer Route, die für den ganzen Workspace antwortet; Inboxes akzeptiert noch keine auf Projekte beschränkten Credentials und sendet das daher auf jeder Route. `csrf`: Eine Browser-Session hat einen Schreibzugriff ohne den Header `X-CSRF` gesendet. `operator`: Die Route oder ein Feld im Request ist nur für Plattformbetreiber. | `required`, bei den meisten Ablehnungen mit `scope`: der Scope, der erlaubt gewesen wäre (`admin` bei Inboxes; `admin`, `read` oder `publish` bei Webhooks) |
| `forbidden` | Webhooks | `role`: Ihre Rolle im Workspace oder im Projekt der Ressource, auf die Sie zugreifen, ist zu niedrig. `project`: Das Credential oder die Person, die es verwendet, hat keinen Zugriff auf das Projekt, das der Request nennt. `product_not_enabled`: Ihr Zugriff umfasst Webhooks nicht. `not_provisioned`: Der Workspace ist noch nicht für Webhooks eingerichtet. | `required`, bei `role`: die niedrigste erlaubte Rolle (`admin`) |
| `forbidden` | Request Bins | `role`: Ihre Rolle oder der Scope Ihres Keys erlaubt das nicht. `project_confined`: ein Gastzugang oder ein auf ein Projekt beschränkter Key; Request Bins bedient ganze Workspaces und sendet das daher auf jeder Route. `product_not_enabled`: Ihr Workspace hat Request Bins nicht hinzugefügt, oder Ihre Anmeldung umfasst es nicht. `csrf`: Eine Browser-Session hat einen Schreibzugriff ohne den Header `X-CSRF` gesendet. `no_workspace`: Das Credential ist an keinen Workspace gebunden, etwa ein Dienst-Token. | `required`, bei `role`: `member`, um einen Bin anzulegen oder zu ändern, `admin`, um einen zu löschen oder zu leeren. Bei einem Key bedeuten beide den Scope `admin` (**Read & write**). |
| `not_found` | Beide | Die Art der Ressource. Inboxes: `inbox`, `message`, `workspace`. Webhooks: `endpoint`, `source`, `event`, `delivery`, `capture`, `event_type`, `operational_endpoint`, `project`, `workspace`, `user` und `default_project` (ein Schreibzugriff, der kein Projekt nennt, in einem Workspace, der noch keines hat). | `id`: die ID, die Sie angefragt haben. Fehlt bei `user` und `default_project`, wo Sie keine genannt haben, und bei einem Pfad, den es gar nicht gibt. |
| `not_found` | Request Bins | Die Art der Ressource: `bin` oder `request`. Ein Bin, der gelöscht wurde oder abgelaufen ist, ist `bin`. | `id`: die ID, die Sie angefragt haben. Fehlt bei einem Pfad, den es gar nicht gibt. |
| `bad_request` | Webhooks | `project_required`: ein Schreibzugriff, der kein Projekt nennt, von einem Credential, das mehrere erreichen kann. | `projects`: die Projekte, die das Credential erreichen kann |
| `conflict` | Webhooks | Welche Kollision, etwa `event_type_exists` oder `idempotency_key_reuse`. [Konflikte](#codes-state) listet jeden Grund auf und wann er gesendet wird. | Die Werte, die dieser Grund braucht, etwa die `id` des Endpoints, der Zustellung oder des Projekts, um das es bei der Kollision geht; [Konflikte](#codes-state) listet sie pro Grund auf |
| `quota_exceeded` | Beide | `allocation`: die Obergrenze eines Tarifs für eine Anzahl (Inboxes: Adressen; Webhooks: Endpoints). `period`: die monatliche Obergrenze (Inboxes: Nachrichten; Webhooks: Zustellungen). | `metric` (`inboxes` oder `messages` bei Inboxes; `endpoints` oder `deliveries` bei Webhooks) und deren `limit`; `current` bei `allocation` und bei einem `period` von Webhooks (die vor dem abgelehnten Publish verbrauchten Zustellungen), wenn sich die Anzahl lesen ließ; `period` bei `period`: der Monat bei Inboxes (`YYYY-MM`), der erste Tag des Abrechnungszeitraums bei Webhooks (`YYYY-MM-DD`). Ein Publish wird abgelehnt, wenn seine Zustellungen die Anzahl über `limit` bringen würden; bei Webhooks kann `current` daher unter `limit` liegen. |
| `quota_exceeded` | Request Bins | `allocation`: die Obergrenze des Tarifs für Bins, bei `POST /v1/bins`. Nie `period`: Sind die Requests des Monats aufgebraucht, antworten Bins ihren Absendern und zeichnen nichts auf, und kein API-Aufruf wird abgelehnt. | `metric` (`bins`), deren `limit` und `current` |
| `not_entitled` | Beide | — | `feature`: `read_api` oder `optional_phrase_gate` bei Inboxes; `rabbitmq_sources` oder `optional_endpoint_verification` bei Webhooks. Webhooks sendet `optional_endpoint_verification`, wenn die Endpoint-Verifizierung in einem Tarif ausgeschaltet werden soll, der sie verlangt; das tut derzeit kein Tarif. |
| `not_entitled` | Request Bins | — | `feature`: `read_api`, das Lesen erfasster Requests mit einem API-Key im Tarif Free; `forwarding`, das Festlegen einer Weiterleitungs-URL oder das Senden eines Tests im Tarif Free |
| `payload_too_large` | Beide | — | `limit` in Bytes, bei jedem `413`. Inboxes sendet zusätzlich `size`, wenn die API den Body gemessen hat. |
| `payload_too_large` | Request Bins | — | `limit` in Bytes, bei jedem `413` |
| `unknown_event_type` | Webhooks | — | `event_type`: der Name, der nicht registriert ist |
| `invalid_payload` | Webhooks | `payload`: Die Payload verletzt das Schema ihres Event-Typs. `schema_invalid`: Ein Schema, das Sie registrieren, ist kein gültiges JSON Schema. | Bei `payload`: `errors`, bis zu 20 Einträge der Form `{path, keyword, params}` (unten), und `total`, wie viele Einträge es vor dieser Kürzung gab (die Länge der Liste, wenn nichts gekürzt wurde). Bei `schema_invalid`: `path`, ein JSON Pointer in das Schema, an die Stelle, an der es fehlschlug. |
| `schema_too_large` | Webhooks | `bytes`, `depth`, `members`, `enum_values` oder `patterns`: die Grenze, die das Schema überschritten hat | `limit`; bei `bytes` zusätzlich `size` (beide in Bytes) |
| `schema_pattern_unsafe` | Webhooks | `too_long`, `does_not_compile`, `empty_repeat`, `nested_quantifier`, `ambiguous_alternation` oder `too_complex`: die Regel, gegen die das Muster verstoßen hat | `pattern`: das Muster, vollständig, auch wenn `message` ein langes Muster kürzt; `limit` (in Zeichen) bei `too_long` |
| `schema_ref_unsupported` | Webhooks | — | `ref`: die entfernte `$ref`, die die API nicht auflöst |
| `provider_secret_required` | Webhooks | — | `provider`: `stripe`, `github` oder `rabbitmq` |
| `broker_not_allowed` | Webhooks | Keiner für Ihren Broker, egal welche Regel ihn abgelehnt hat (`not_system_broker` wird nur an den eigenen Workspace der Plattform gesendet) | `host`: der Broker, als `host:port` |
| `rate_limited` | Beide | `inbox_rate` (Inboxes): das Limit pro Minute einer einzelnen Inbox. Webhooks sendet keinen Grund. | `retry_after` in Sekunden, dieselbe Zahl wie im Header `Retry-After` (beide APIs). Bei `inbox_rate` von Inboxes zusätzlich `rate_per_min`. |
| `rate_limited` | Request Bins | — | `retry_after`: die Sekunden, bis der nächste Test des Bins erlaubt ist |
| `unavailable` | Inboxes | `ingest_disabled`: Die Annahme von Nachrichten ist ausgeschaltet | — |
| `unavailable` | Request Bins | `forwarding_disabled`: Die Weiterleitung ist für den gesamten Dienst ausgeschaltet. `forwarder_unavailable`: Ein Test wurde nicht innerhalb von 3 Sekunden zum Senden übernommen, sodass nichts gesendet wurde. | — |

Bei `invalid_payload` sagt jeder Eintrag in `details.errors`, was wo fehlgeschlagen ist. `path` ist ein JSON Pointer auf den fehlerhaften Wert: `""` ist die Payload selbst, und bei einer fehlenden oder unerwarteten Eigenschaft zeigt er auf das Objekt, das sie enthalten sollte bzw. nicht enthalten dürfte. `keyword` ist das JSON-Schema-Keyword, das fehlgeschlagen ist (`required`, `type`, `enum`, `const`, `minimum`, `maximum`, `minLength`, `maxLength`, `minItems`, `maxItems`, `pattern`, `format` oder `additionalProperties`), oder `other` für jedes andere Keyword. `params` enthält `property` (die fehlende oder unerwartete Eigenschaft, je ein Eintrag), `count` (eine Grenze für Länge oder Anzahl der Elemente), `limit` (die Grenze eines `minimum` oder `maximum`) oder `type` (der eine Typ, den der Wert hätte haben sollen), und ist leer, wenn nichts davon zutrifft, etwa bei `enum` oder `pattern` oder bei einem `type`, der mehrere zulässt. Einträge enthalten nie den regulären Ausdruck, die erlaubten Werte oder den fehlerhaften Wert; `message` beschreibt weiterhin einen Fehler auf Englisch.

Validierungsfehler von Requests (`validation_error`) stehen nicht in der Tabelle: Bei jeder API ist ihr `details` `{"errors": [...]}`, eine Liste von Validierungseinträgen, jeder mit `loc`, `type` und `msg`, ein anderer Aufbau als bei `invalid_payload`. Siehe [Request-Validierung](#codes-validation).

### Die Request-ID {#request-id}

`error.request_id` ist derselbe Wert wie der Header `X-Request-ID` in jeder Antwort, die eine API sendet; beide identifizieren also den Request. Wenn Ihr Request einen Header `X-Request-ID` sendet (bis zu 128 Buchstaben, Ziffern, `.`, `_` oder `-`), verwendet die API diesen Wert als Request-ID; andernfalls erzeugt sie eine. Wenn Sie ihn setzen, machen Sie ihn pro Request eindeutig, damit die ID auf genau einen Aufruf zeigt. Manche Antworten kommen nicht von einer API, sondern vom Edge vor den APIs: z. B. ein `502` oder `504` oder ein `413` für einen Body, der zu groß ist, um die API zu erreichen. Diese enthalten weder den Fehler-Body der API noch `X-Request-ID`. Lesen Sie zuerst den Body und greifen Sie ersatzweise auf den Header zurück, wie es das [Muster für die Fehlerbehandlung](#pattern) tut, und rechnen Sie damit, dass bei diesen Antworten beides fehlt. Was Sie mit der ID tun, steht unter [Bugs melden](#bugs).

## Statusklassen {#families}

| Statusklasse | Bedeutung der Klasse |
| --- | --- |
| `200`/`201`/`202`/`204` | Erfolg |
| `400` | Der Request ließ sich so, wie er gesendet wurde, nicht lesen |
| `401` | Kein verwendbares Credential: Es wurde keines gesendet, oder es wurde widerrufen. Inboxes und Request Bins antworten außerdem mit `401` als `invalid_credential` auf einen Key, den sie nicht erkennen oder nicht verifizieren können, und Webhooks antwortet mit `401` als `unauthorized` auf ein eingehendes Event, dessen Signatur die Prüfung nicht besteht |
| `402` | Ihr Tarif oder Ihr Abrechnungsstatus verhindert den Request: ein Kontingent, eine Funktion, die Ihr Tarif nicht enthält, oder ein Workspace, der eingefroren oder gesperrt ist |
| `403` | Nicht erlaubt. Webhooks antwortet außerdem mit `403` als `invalid_credential` auf ein Credential, das es nicht erkennt |
| `404` | Die Ressource existiert nicht, *oder* der Aufrufer kann sie nicht sehen (absichtlich nicht unterscheidbar) |
| `405` | Der Pfad existiert, aber nicht für diese Methode |
| `409` | Konflikt mit bestehendem Zustand, einschließlich eines `Idempotency-Key`, der mit anderem Body wiederverwendet wurde |
| `413` | Der Body ist zu groß |
| `422` | Der Request ließ sich parsen, hat aber die Validierung nicht bestanden |
| `429` | Rate-Limit erreicht |
| `5xx` | Problem auf Serverseite |

`429` und `5xx` sind die einzigen Klassen, bei denen erneutes Senden desselben Requests erfolgreich sein kann. Bei jedem anderen `4xx` sagt Ihnen der Code, was Sie ändern müssen.

## Fehlercodes {#codes}

Die beiden APIs teilen die meisten Codes und schreiben seit der oben auf dieser Seite vermerkten Aktualisierung fast jede gemeinsame Situation gleich. Zwei unterscheiden sich: `invalid_credential` ist bei Inboxes ein `401` und bei Webhooks ein `403`, und eine abgelaufene Anmelde-Session ist bei Inboxes `unauthorized` (`details.reason` `invalid`), bei Webhooks aber `invalid_credential`. Die Spalte **API** gibt an, welche API den jeweiligen Code sendet.

Request Bins sendet für dieselben Situationen die Codes, die Inboxes sendet, einschließlich dieser beiden. In der Spalte **API** bedeutet **Alle** alle drei APIs, **Beide** Webhooks und Inboxes, und eine mit **Request Bins** markierte Zeile betrifft nur diese API.

### Authentifizierung und Autorisierung {#codes-auth}

| `code` | Status | API | Bedeutung |
| --- | --- | --- | --- |
| `unauthorized` | 401 | Alle | Es wurde kein Credential gesendet, oder es wurde widerrufen. Bei Inboxes und Request Bins auch eine Anmelde-Session, die beendet ist oder sich nicht verifizieren ließ; jedes `unauthorized`, das sie senden, trägt einen `details.reason`. Bei Webhooks auch ein eingehendes Event an `POST /v1/ingest/{source_id}`, dessen Signatur die Prüfung nicht besteht (`details.reason` `invalid`); jedes `401` von Webhooks trägt einen `details.reason` ([Was `details` enthält](#details)). |
| `invalid_credential` | 401 bei Inboxes und Request Bins, 403 bei Webhooks | Alle | Ein API-Key oder ein Token, das die API nicht erkennt oder nicht verifizieren kann. Ersetzen Sie das Credential; dasselbe Credential erneut zu senden, funktioniert nicht. Bei Webhooks gehört dazu auch eine abgelaufene Anmelde-Session: Melden Sie sich erneut an. |
| `forbidden` | 403 | Alle | Das Credential ist gültig, darf das aber nicht: ein fehlender Scope oder eine fehlende Rolle, ein auf bestimmte Projekte beschränkter Key, der außerhalb davon verwendet wird, oder ein Produkt, das für Ihren Workspace nicht aktiviert ist. `details.reason` sagt, welcher Fall vorliegt. |

`invalid_credential` ist bei der Webhooks-API ein `403` und bei Inboxes und Request Bins ein `401`, und dabei bleibt es jeweils: Verzweigen Sie nach dem Code, nicht nach dem Status. Den Aufbau des Requests beschreibt [Authentifizierung](/docs/authentication).

### Request-Validierung {#codes-validation}

| `code` | Status | API | Bedeutung |
| --- | --- | --- | --- |
| `validation_error` | 422 | Alle | Body, Query oder Pfad haben die Validierung nicht bestanden, oder bei Webhooks hat eine Regel, die die API selbst prüft, ein Feld abgelehnt. `details` ist `{"errors": [...]}`, eine Liste von Einträgen. |
| `bad_request` | 400 | Alle | Der Request lässt sich so, wie er gesendet wurde, nicht verarbeiten. `message` nennt den Grund. Bei Inboxes und Request Bins ein Body, den die API nicht lesen konnte, etwa einer, der kein gültiges UTF-8 ist. |
| `payload_too_large` | 413 | Alle | Der Body überschreitet das Größenlimit. |
| `method_not_allowed` | 405 | Alle | Der Pfad existiert, aber nicht für diese Methode. |

Jeder Validierungseintrag beschreibt eine fehlerhafte Eingabe: `loc` sagt, wo (`["body", "event_type"]`), `type` sagt maschinenlesbar, was falsch ist (`missing`, `string_too_long`, `json_invalid`, …), und `msg` sagt es auf Englisch. Wenn die Regel eine Zahl hat, trägt der Eintrag sie zusätzlich in `params`: `count` für eine Länge (`string_too_short`, `string_too_long`, `too_short`, `too_long`) und `limit` für eine Grenze (`greater_than`, `greater_than_equal`, `less_than`, `less_than_equal`). Ein Body, der kein gültiges JSON ist, ist ebenfalls ein Validierungsfehler, mit dem Typ `json_invalid`; bei Inboxes und Request Bins ist ein Body, der kein gültiges UTF-8 ist, stattdessen ein `400` `bad_request`.

Webhooks sendet außerdem eigene Eintragstypen für Regeln, die es selbst prüft:

- `webhooks.max_attempts_above_plan`: `max_attempts` über der Obergrenze des Tarifs, bei `POST /v1/endpoints` oder `PATCH /v1/endpoints/{id}`; `loc` `["body", "max_attempts"]`, mit `params.count`, der Obergrenze.
- `webhooks.url_not_https`: eine `url` eines Endpoints, die nicht https ist, bei `POST /v1/endpoints`, `PATCH /v1/endpoints/{id}` oder `POST /v1/operational-endpoints`; `loc` `["body", "url"]`.
- `webhooks.end_before_start`: ein Bulk-Replay, dessen `to` vor seinem `from` liegt; `loc` `["body", "to"]`. Gleiche Grenzen sind erlaubt.
- `webhooks.end_not_after_start`: auf einer Route für Plattformbetreiber ein Verbrauchsfenster, das nicht nach seinem Beginn endet; `loc` `["query", "end"]`.
- `webhooks.unknown_delivery_status`: ein unbekannter Filter `status` bei `GET /v1/deliveries`; `loc` `["query", "status"]`, mit `params.status`, dem gesendeten Wert.
- `webhooks.unknown_operational_event_type`: ein Wert in `event_types`, der kein Betriebs-Event-Typ ist, bei `POST /v1/operational-endpoints`; `loc` `["body", "event_types", <index>]`, ein Eintrag pro unterschiedlichem Wert, an dessen erstem Index, mit `params.event_type`, dem Wert, und `params.choices`, den Betriebs-Event-Typen, die die API akzeptiert.

Auf derselben Route für Plattformbetreiber ist ein Datum des Verbrauchsfensters, das sich nicht parsen lässt, ein Eintrag `date_parsing` auf `["query", "start"]` oder `["query", "end"]`, einer für jedes solche Datum. Eine Ablehnung durch eine Regel, die die API selbst prüft, trägt höchstens 20 Einträge.

Die eigenen Regeln von Webhooks zu Custom-Headern, Verzögerungen in `retry_schedule` und den Broker-Feldern einer RabbitMQ-Quelle senden Einträge mit eigenem `type`, mit dem `loc` und `msg`, die sie schon immer hatten (außer beim Header-Namen, den der Hinweis vom 16.10.2026 beschreibt), und mit `params`, das die Werte enthält, die die Regel nennt:

- Mehr als 20 Custom-Header: `too_long`, mit `params.count`, `20`.
- Ein Name eines Custom-Headers, der kein gültiges HTTP-Token ist: `webhooks.custom_header_name_invalid`, ohne `params`.
- Ein Zeilenumbruch oder anderes Steuerzeichen im Wert eines Custom-Headers: `webhooks.custom_header_control_character`, mit `params.header`, dem Namen des Headers.
- Ein Wert eines Custom-Headers mit mehr als 1024 Zeichen: `webhooks.custom_header_value_too_long`, mit `params.header` und `params.count`, `1024`.
- Ein Name, den die API für ihre eigenen Zustell-Header reserviert (`Content-Type`, `User-Agent` oder jeder Name, der mit `X-Webhook-` beginnt): `webhooks.custom_header_managed`, mit `params.header`.
- Ein Hop-by-Hop- oder Verbindungssteuerungs-Name wie `Host` oder `Connection`: `webhooks.custom_header_forbidden`, mit `params.header`.
- Ein Wert eines Custom-Headers mit einem Zeichen, das kein ASCII ist: `webhooks.custom_header_not_ascii`, mit `params.header`.
- Namen und Werte von Custom-Headern, die zusammen mehr als 8192 Bytes belegen: `webhooks.custom_headers_too_large`, mit `params.limit`, `8192`.
- Eine Verzögerung in `retry_schedule` unter 0 oder über 604800 Sekunden: `webhooks.retry_delay_out_of_range`, mit `params.limit`, `604800`.
- Eine RabbitMQ-Quelle, die ohne alle ihre Broker-Felder angelegt wird: `webhooks.broker_fields_required`, mit `params.missing`, einer Liste der Felder (aus `broker_identifier`, `broker_host`, `broker_user`, `broker_exchange` und `broker_topic`), die fehlten oder leer waren. Der `loc` dieses Eintrags ist `["body"]`.

Der `loc` der Regeln für Custom-Header ist `["body", "custom_headers"]`, und `params.header` ist der Name so, wie Sie ihn gesendet haben; der Wert eines Headers kommt nie zurück. Ein Tarifname, den die API nicht kennt, ist auf einer Route für Plattformbetreiber ein Eintrag `enum` ohne `params`. Bis zur oben auf dieser Seite vermerkten Aktualisierung hatten alle diese Einträge den Typ `value_error`.

Inboxes sendet einen eigenen Eintragstyp: `inboxes.search_conflict` für eine Suche nach Nachrichten bei `GET /v1/inboxes/{id}/messages` oder `GET /v1/messages`, die einen `header` nennt und `in` auf `subject`, `from` oder `body` setzt. Der `loc` des Eintrags ist `["query", "in"]`, und er trägt keine `params` ([Nachrichten durchsuchen](/docs/product-inboxes#search)).

Request Bins sendet drei:

- `bins.nul_character`: ein NUL-Zeichen im Pfad, im Query-String oder in einem JSON-Body, das es nicht speichern kann. Der `loc` des Eintrags ist `["path"]`, `["query", <name>]` oder `["body"]`, und er trägt keine `params`.
- `bins.forward_target`: eine Weiterleitungs-URL, an die ein Bin nicht weiterleitet. Der `loc` des Eintrags ist `["body", "forward_url"]`, und `params.reason` nennt den Grund ([Weiterleitung](/docs/product-bins/reference#forwarding)).
- `bins.search_conflict`: eine Suche bei `GET /v1/bins/{id}/requests` oder `GET /v1/requests`, deren `header` oder `field` nicht zu ihrem `in` passt, mit dem `loc` `["query", "in"]`, oder die sowohl einen `header` als auch ein `field` nennt, mit dem `loc` `["query", "field"]`. Der Eintrag trägt keine `params` ([Erfasste Requests](/docs/product-bins/reference#requests)).

Eine Bezeichnung bei Inboxes, die ein Zeichen über ihrem Limit liegt:

```json
{
  "error": {
    "code": "validation_error",
    "message": "request validation failed",
    "details": {
      "errors": [
        {
          "loc": ["body", "label"],
          "msg": "String should have at most 200 characters",
          "type": "string_too_long",
          "params": {"count": 200}
        }
      ]
    },
    "request_id": "a3e81f0c5b9d4e2f8c7a6b5d4e3f2a1b"
  }
}
```

Bei Webhooks steht derselbe Eintrag in derselben Liste `details.errors`, unter demselben Code, und Request Bins sendet ihn für ein `label` eines Bins mit mehr als 200 Zeichen.

### Codes der Webhooks-API {#codes-webhooks}

Diese gehören zu den eigenen Objekten der Webhooks-API (Event-Typen, Schemas, Quellen, Endpoints, Zustellungen) und sind alle `422`:

| `code` | Bedeutung |
| --- | --- |
| `unknown_event_type` | Der Event-Typ steht nicht im Katalog Ihres Workspaces, und der Katalog akzeptiert nur registrierte Typen. |
| `invalid_payload` | Die Payload entspricht nicht dem Schema, das für ihren Event-Typ registriert ist (`details.reason` `payload`, mit `details.errors`), oder ein Schema, das Sie registrieren, ist kein gültiges JSON Schema (`schema_invalid`). |
| `schema_too_large` | Ein JSON Schema, das Sie registriert haben, ist zu groß oder zu tief verschachtelt. |
| `schema_pattern_unsafe` | Ein `pattern` in Ihrem Schema ist zu lang, lässt sich nicht kompilieren oder könnte zu lange laufen. |
| `schema_ref_unsupported` | Ihr Schema verwendet eine `$ref`, die die API nicht auflöst. |
| `provider_secret_required` | Das Rotieren einer Stripe- oder GitHub-Quelle braucht das neue Secret dieses Anbieters, und das Rotieren einer RabbitMQ-Quelle braucht das neue Passwort des Brokers. `details.provider` sagt, welcher Fall vorliegt: `stripe`, `github` oder `rabbitmq`. |
| `broker_not_allowed` | Eine RabbitMQ-Quelle nennt einen Broker, mit dem sich die API nicht verbindet. |

### Tarif und Abrechnung {#codes-plan}

Alle diese Codes sind `402`. Denselben Request zu wiederholen, hilft nie: Jemand muss den Tarif ändern, eine Zahlung begleichen, auf den nächsten Abrechnungszeitraum warten oder eine Zuteilung freimachen, etwa durch Freigeben einer Adresse oder Löschen eines Endpoints.

| `code` | API | Bedeutung |
| --- | --- | --- |
| `quota_exceeded` | Beide | Über einem Limit des Tarifs: einer Zuteilung (Inboxes: Adressen; Webhooks: Endpoints) oder einer monatlichen Obergrenze (Inboxes: Nachrichten; Webhooks: Zustellungen), bei der Sie auf den nächsten Zeitraum warten oder ein Upgrade machen. Bei beiden APIs sagt `details.reason`, welcher Fall vorliegt, und `details` nennt die `metric`, ihr `limit` und bei einer Zuteilung die aktuelle Anzahl `current`. |
| `quota_exceeded` | Request Bins | Über dem Limit des Tarifs für Bins, beim Anlegen eines Bins. `details.reason` ist `allocation`, und `details` nennt die `metric` (`bins`), ihr `limit` und die aktuelle Anzahl `current`. Das monatliche Request-Limit lehnt nie einen API-Aufruf ab: Ist es überschritten, antworten Bins ihren Absendern und zeichnen nichts auf, bis mit [Guthaben](/docs/product-bins/reference#credit) weitere gekauft werden oder der nächste Monat beginnt. |
| `not_entitled` | Alle | Die Funktion ist nicht in Ihrem Tarif enthalten, etwa die Lese-API im kostenlosen Tarif von Inboxes, das Lesen erfasster Requests mit einem API-Key im Tarif Free von Request Bins oder eine RabbitMQ-Quelle unterhalb von Pro bei Webhooks. `details.feature` nennt sie. |
| `workspace_frozen` | Alle | Eine Zahlung ist offen, daher werden Änderungen abgelehnt. Begleichen Sie sie in Ihrer Kontokonsole; auch ein Upgrade des Tarifs wird abgelehnt, bis Sie das tun. |
| `workspace_suspended` | Alle | Die Nachfrist nach einer offenen Zahlung ist abgelaufen, und der Dienst wurde für diesen Workspace eingestellt. |

`quota_exceeded` ist ein `402`, kein `429`. Ein Rate-Limit löst sich innerhalb von Sekunden von selbst auf; ein Kontingent nicht.

Bei Webhooks ist das Endpoint-Limit `quota_exceeded` bei `POST /v1/endpoints`, mit `details.reason` `allocation`, `metric` `endpoints`, `limit` (der Obergrenze des Tarifs) und `current` (den Endpoints, die der Workspace hat). Eine RabbitMQ-Quelle unterhalb von Pro ist `not_entitled` mit `details.feature` `rabbitmq_sources`: bei `POST /v1/sources` und bei einem `PATCH /v1/sources/{id}` einer RabbitMQ-Quelle, dessen Body `status` auf `enabled` setzt oder eines der Felder `broker_identifier`, `broker_host`, `broker_port`, `broker_vhost`, `broker_user`, `broker_exchange`, `broker_topic` oder `broker_queues` setzt, auch auf den Wert, den es bereits hat. Andere Änderungen, etwa das Umbenennen oder Deaktivieren der Quelle, bleiben erlaubt. `max_attempts` über der Obergrenze des Tarifs ist kein `402`, sondern ein `422` `validation_error` ([Request-Validierung](#codes-validation)).

Bei Request Bins ist das Bin-Limit `quota_exceeded` bei `POST /v1/bins`. Das Lesen erfasster Requests mit einem API-Key in Free ist `not_entitled`, mit `details.feature` `read_api`, bei `GET /v1/bins/{id}/requests`, `GET /v1/requests`, `GET /v1/bins/{id}/paths` und `GET /v1/requests/{id}`; die Konsole liest sie in jedem Tarif. Das Festlegen einer Weiterleitungs-URL oder das Senden eines Tests in Free ist ebenfalls `not_entitled`, mit `details.feature` `forwarding`. Solange ein Workspace eingefroren oder gesperrt ist, wird jeder Schreibzugriff außer einem Löschen mit `workspace_frozen` oder `workspace_suspended` abgelehnt, und Lesezugriffe bleiben möglich. Bins zeichnen weiter auf, solange der Workspace eingefroren ist, und hören auf, solange er gesperrt ist ([Tarife und Limits](/docs/product-bins/reference#limits)).

### Ressourcen {#codes-resources}

| `code` | Status | API | Bedeutung |
| --- | --- | --- | --- |
| `not_found` | 404 | Alle | Die Ressource existiert nicht, oder Sie können sie nicht sehen. Beides ist absichtlich nicht unterscheidbar. `details.reason` nennt die Art der Ressource und `details.id` die ID, die Sie angefragt haben, falls es eine gibt; ein Pfad, den es nicht gibt, trägt kein `details` ([Was `details` enthält](#details)). |

### Konflikte {#codes-state}

| `code` | Status | API | Bedeutung |
| --- | --- | --- | --- |
| `conflict` | 409 | Webhooks | Der Request kollidiert mit bestehendem Zustand: ein bereits vergebener Name oder ein `Idempotency-Key`, der mit anderem Body wiederverwendet wurde ([Idempotenz](/docs/idempotency#conflicts)). `details.reason` sagt, welcher Fall vorliegt, aus der Tabelle unten. |

Jeder `details.reason`, den ein `conflict` tragen kann, wann er gesendet wird und die weiteren Felder in `details`:

| `details.reason` | Wann | Weitere Felder in `details` |
| --- | --- | --- |
| `event_type_exists` | Ein Event-Typ mit diesem Namen ist im selben Geltungsbereich bereits registriert: für den ganzen Workspace oder im Projekt, das Sie genannt haben. | `event_type`: der Name |
| `project_not_empty` | Löschen eines Projekts, das noch Endpoints oder Quellen enthält. Löschen Sie diese zuerst. | `id`: das Projekt. `endpoints` und `sources`: wie viele es enthält |
| `idempotency_key_reuse` | Ein `Idempotency-Key`, der mit anderem Body wiederverwendet wurde ([Idempotenz](/docs/idempotency#webhooks)). Das ursprüngliche Event bleibt bestehen. | `idempotency_key`: der Key |
| `delivery_not_redeliverable` | Erneutes Zustellen einer Zustellung, die noch in der Warteschlange steht oder gerade gesendet wird. Nur eine Zustellung mit `sent`, `failed` oder `dead` lässt sich erneut zustellen. | `id`: die Zustellung. `state`: `queued`, `sending`, `sent`, `failed` oder `dead` oder `missing`, wenn die Zustellung inzwischen gelöscht wurde |
| `delivery_exists` | Erneutes Abspielen eines Events an einen Endpoint, der bereits eine Zustellung davon hat. Stellen Sie stattdessen diese Zustellung erneut zu. | `event_id` und `endpoint_id` |
| `endpoint_not_enabled` | Erneutes Abspielen eines Events an einen Endpoint, der ausgeschaltet ist, von Ihnen oder automatisch nach wiederholten Fehlschlägen. | `id`: der Endpoint. `state`: `disabled` (von Ihnen) oder `auto_disabled` (automatisch) |
| `endpoint_suspended` | Erneutes Abspielen eines Events an einen Endpoint, den wir gesperrt haben. | `id`: der Endpoint. `cause`: `abuse`, `non_payment` oder `plan_downgrade`; der schwerwiegendste, wenn mehrere zutreffen, und nicht vorhanden, wenn keiner davon zutrifft |
| `endpoint_has_pending_deliveries` | Löschen eines Endpoints, der noch Zustellungen hat, die in der Warteschlange stehen, gerade gesendet werden oder auf einen Retry warten. Der Endpoint wird deaktiviert, obwohl das Löschen abgelehnt wurde, sodass ihn keine neuen Zustellungen erreichen; wiederholen Sie das Löschen, sobald sie abgeschlossen sind. | `id`: der Endpoint. `count`: seine ausstehenden Zustellungen |
| `replay_across_projects` | Erneutes Abspielen eines Events an einen Endpoint in einem anderen Projekt. | `event_id` und `endpoint_id` |

Ein Bulk-Replay, dessen `from` nach seinem `to` liegt, ist kein Konflikt, sondern ein `422` `validation_error` ([Request-Validierung](#codes-validation)).

### Rate-Limits {#codes-rate}

| `code` | Status | API | Bedeutung |
| --- | --- | --- | --- |
| `rate_limited` | 429 | Beide | Zu viele Requests. Wenn `Retry-After` gesetzt ist, warten Sie so viele Sekunden und wiederholen dann; andernfalls warten Sie mit Backoff. `details.retry_after` trägt bei beiden APIs dieselbe Zahl, und bei Inboxes setzt ein Limit pro Inbox zusätzlich `details.reason` auf `inbox_rate`, mit `details.rate_per_min`. |
| `rate_limited` | 429 | Request Bins | Mehr als 10 Tests an die Weiterleitungs-URL eines Bins innerhalb einer Minute. `details.retry_after` gibt an, wie viele Sekunden es dauert, bis der nächste erlaubt ist. |

Die API von Request Bins sendet `rate_limited` nur bei Tests ([Weiterleitungs-URL testen](/docs/product-bins/reference#forward-test)). Die Bin-URLs von Request Bins begrenzen, wie schnell Absender senden können, und antworten einem Absender über dem Limit mit einem `429` und `Retry-After`, nicht in diesem JSON-Format ([Was eine Bin-URL antwortet](/docs/product-bins/reference#edge-answers)).

### Server {#codes-server}

| `code` | Status | API | Bedeutung |
| --- | --- | --- | --- |
| `internal_error` | 500 | Alle | Auf unserer Seite ist etwas kaputtgegangen. Idempotente Requests können Sie gefahrlos wiederholen. |
| `unavailable` | 503 | Inboxes | Der Request kann vorübergehend nicht bedient werden: Die Annahme von Nachrichten ist ausgeschaltet, und `details.reason` ist `ingest_disabled`. Wiederholen Sie mit Backoff. |
| `unavailable` | 503 | Request Bins | Die Weiterleitung kann den Request nicht annehmen: das Festlegen einer Weiterleitungs-URL oder das Senden eines Tests, während die Weiterleitung für den gesamten Dienst ausgeschaltet ist (`details.reason` `forwarding_disabled`), oder ein Test, der nicht innerhalb von 3 Sekunden zum Senden übernommen wurde, sodass nichts gesendet wurde (`forwarder_unavailable`). Versuchen Sie es später erneut. |

Ein `502` oder `504` vom Edge vor den APIs kann ganz ohne JSON-Body ankommen. Behandeln Sie ein `5xx`, das Sie nicht parsen können, als wiederholbar.

### Ergebnisse von Test und Verifizierung {#failure-reason}

Das Testen oder Verifizieren eines Endpoints von Webhooks (`POST /v1/endpoints/{id}/test`, `POST /v1/endpoints/{id}/verify`) sendet einen Request an ihn und antwortet mit `200` und dem Ergebnis, ob dieser Request erfolgreich war oder nicht; ein Fehlschlag dort ist also keine Fehlerantwort. `delivered` bei einem Test bzw. `verified` bei einer Verifizierung sagt, ob es funktioniert hat. Bei einem Fehlschlag beschreibt `error` ihn auf Englisch, und `failure_reason` benennt ihn als stabilen, maschinenlesbaren String:

| `failure_reason` | Was passiert ist |
| --- | --- |
| `http_status` | Der Endpoint hat mit einem Status außerhalb von `2xx` geantwortet; `status_code` sagt, mit welchem. |
| `timeout` | Keine Antwort innerhalb des Timeouts des Endpoints. |
| `tls_failed` | Der TLS-Handshake ist fehlgeschlagen, meist weil sich das Zertifikat nicht verifizieren lässt. |
| `dns_failed` | Der Host lässt sich nicht auflösen. |
| `connection_failed` | Jeder andere Verbindungsfehler, etwa eine abgelehnte, zurückgesetzte oder nicht erreichbare Verbindung. |
| `blocked_address` | Der Host löst auf eine private oder anderweitig nicht öffentliche Adresse auf, an die Webhooks nie sendet. |
| `challenge_not_echoed` | Nur bei der Verifizierung: Der Endpoint hat mit `2xx` geantwortet, ohne das Challenge-Token in seinem Body. |
| `url_changed` | Nur bei der Verifizierung: Die URL des Endpoints hat sich geändert, während die Challenge unterwegs war. Verifizieren Sie erneut. |

`failure_reason` ist `null` bei Erfolg und bei einem Fehlschlag, den keiner dieser Werte beschreibt; dann ist `error` die einzige Beschreibung. Wie `code` ist es ein offener String, kein Enum: Behalten Sie einen Default-Zweig für einen Wert, den Sie nicht kennen, und verzweigen Sie nach `failure_reason`, statt `error` zu parsen.

## Wenn ein Code umbenannt wird {#renames}

Inboxes und Webhooks haben ihre Umbenennungen am 15.10.2026 abgeschlossen, vor dem Start von v1 und nicht erst nach 12 Monaten. Bei Inboxes ist `invalid_request` jetzt `validation_error`, ein API-Key oder ein Token, das die API nicht erkennt oder nicht verifizieren kann, ist `invalid_credential` (weiterhin ein `401`), und ein Status ohne eigenen Code trägt den Code dieses Status, etwa `bad_request` für ein `400`. Bei Webhooks ist `internal` jetzt `internal_error`, `unprocessable` jetzt `validation_error`, und `plan_violation` gibt es nicht mehr: Jede seiner Ablehnungen sendet den Code, den ihr `next_code` nannte, mit dem Status dieses Codes. Keine der beiden APIs sendet heute `next_code`. Nach dem Start von v1 wird eine Umbenennung im [Changelog](/changelog) angekündigt, und die alte Schreibweise wird danach noch mindestens 12 Monate lang in `error.code` gesendet, dieselbe Frist, die die [Abkündigungsrichtlinie](/docs/versioning#deprecation) einem Feld gibt.

Während eine Umbenennung läuft, trägt der Fehler zusätzlich `next_code`: die Schreibweise, die `code` hat, sobald die Umbenennung umgesetzt ist. Über dieses Feld, nicht über einen Response-Header `Deprecation`, teilt Ihnen ein Fehler mit, dass sein Code umbenannt wird.

Verzweigen Sie nach `next_code`, wenn es vorhanden ist, und sonst nach `code` (`error.next_code ?? error.code`). Ein so geschriebener Handler braucht keine Änderung, wenn eine Umbenennung umgesetzt wird: Ab dann trägt `code` die neue Schreibweise, und `next_code` wird dafür nicht mehr gesendet. Wenn Sie nur `code` lesen können, etwa über ein SDK, das nur `code` weitergibt, prüfen Sie auf beide Schreibweisen, bis die Umbenennung umgesetzt ist.

Die Umbenennungen, die am 15.10.2026 umgesetzt wurden, mit den Ablehnungen, die mit ihnen umgezogen sind:

| API | Situation | Vorher | Jetzt |
| --- | --- | --- | --- |
| Inboxes | Ein Request, der an der Validierung scheitert | `422` `invalid_request`, `next_code` `validation_error` | `422` `validation_error` |
| Inboxes | Ein API-Key oder ein Token, das die API nicht erkennt oder das die Verifizierung nicht besteht | `401` `unauthorized`, `next_code` `invalid_credential` | `401` `invalid_credential` |
| Inboxes | Ein Status ohne eigenen Code, etwa bei einem Body, der kein gültiges UTF-8 ist | `error`, `next_code` der Code, den dieser Status anderswo hat | der Code dieses Status, etwa `400` `bad_request` |
| Inboxes | Ein auf bestimmte Projekte beschränktes Credential | `403` `forbidden`, `details.reason` `project` | `403` `forbidden`, `details.reason` `project_confined` |
| Inboxes | `quota_exceeded`, das `not_entitled` der Lese-API und das `rate_limited` pro Inbox | `details` enthielt zusätzlich `max_inboxes`, `max_http_bins`, `monthly_messages`, `plan` oder `inbox_id` | `details` enthält nur die Felder, die [Was `details` enthält](#details) aufführt |
| Webhooks | Jedes `500` | `internal`, `next_code` `internal_error` | `internal_error` |
| Webhooks | Ein Feld, das die API selbst prüft (eine `url` eines Endpoints, die nicht https ist, ein unbekannter Filter `status` oder Betriebs-Event-Typ, ein Verbrauchsfenster, das sich nicht parsen lässt oder nicht nach seinem Beginn endet) | `422` `unprocessable`, `next_code` `validation_error` | `422` `validation_error` |
| Webhooks | Das Endpoint-Limit (`POST /v1/endpoints`) | `402` `plan_violation`, `next_code` `quota_exceeded` | `402` `quota_exceeded`, `details.reason` `allocation` |
| Webhooks | `max_attempts` über der Obergrenze des Tarifs (`POST /v1/endpoints`, `PATCH /v1/endpoints/{id}`) | `402` `plan_violation`, `next_code` `validation_error` | `422` `validation_error`, Eintragstyp `webhooks.max_attempts_above_plan` |
| Webhooks | Eine RabbitMQ-Quelle unterhalb von Pro | `402` `plan_violation`, `next_code` `not_entitled` | `402` `not_entitled`, `details.feature` `rabbitmq_sources` |
| Webhooks | Ausschalten der Endpoint-Verifizierung in einem Tarif, der sie verlangt (`PATCH /v1/workspace`); das tut derzeit kein Tarif | `402` `plan_violation`, `next_code` `not_entitled` | `402` `not_entitled`, `details.feature` `optional_endpoint_verification` |
| Webhooks | Ein Bulk-Replay, dessen `from` nach seinem `to` liegt (`POST /v1/deliveries/replay`) | `409` `conflict`, `details.reason` `replay_window_inverted` | `422` `validation_error`, Eintragstyp `webhooks.end_before_start` auf `["body", "to"]` |
| Webhooks | Die eigenen Regeln von Webhooks zu Custom-Headern, `retry_schedule`, Broker-Feldern und Tarifnamen | Eintragstyp `value_error` | der eigene Eintragstyp der Regel ([Request-Validierung](#codes-validation)); `loc`, `msg` und `params` unverändert |
| Webhooks | Jeder Validierungsfehler | `details`: eine Liste von Einträgen | `details`: `{"errors": [...]}`, wie bei Inboxes |

Ein Handler, der nach `error.next_code ?? error.code` verzweigt hat, erhält in jeder Situation oben außer beim Bulk-Replay denselben Code wie vorher. Einer, der bei einem Validierungsfehler von Webhooks `error.details` als Liste gelesen hat, liest jetzt `error.details.errors`; einer, der die entfernten Felder von `quota_exceeded` bei Inboxes gelesen hat, liest `metric`, `limit`, `current` und `period`; einer, der bei Inboxes auf den Grund `project` von `forbidden` geprüft hat, prüft auf `project_confined`; und einer, der bei Webhooks auf `value_error` als `type` eines Eintrags geprüft hat, prüft auf den eigenen Typ der Regel.

`unauthorized` wird nicht abgeschafft: Es bleibt der Code für ein fehlendes oder widerrufenes Credential bei beiden APIs, für eine beendete Anmelde-Session bei Inboxes und für ein eingehendes Event, dessen Signatur die Prüfung nicht besteht, bei Webhooks.

## Codes, die diese Seite früher aufgeführt hat {#earlier-versions}

Frühere Versionen dieser Seite führten die Codes und Felder links auf. Die APIs haben sie nicht gesendet; sie senden, was rechts steht. Zwei davon sind inzwischen Realität geworden, `request_id` in Fehler-Bodys und `internal_error` bei jeder API, und ihre Zeilen sagen, wie.

| Frühere Versionen führten auf | Die APIs senden |
| --- | --- |
| `validation_failed` (400) | `validation_error` (422) |
| `fields` | `details`: `{"errors": [...]}` bei beiden APIs |
| `request_id` in jedem Body | Nicht gesendet, solange diese Versionen aktuell waren: Die ID stand nur im Response-Header `X-Request-ID`. Seit den oben auf dieser Seite vermerkten Aktualisierungen trägt sie auch jeder Fehler-Body, den die APIs senden, als `error.request_id`, mit demselben Wert wie der Header ([Die Request-ID](#request-id)). |
| `malformed_json` (400), `unsupported_content_type` (415) | `validation_error` (422) |
| `request_too_large` | `payload_too_large` (413) |
| `no_credentials` (401) | `unauthorized` (401) |
| `invalid_credentials`, `expired_credentials` (401) | `invalid_credential`: bei Webhooks ein `403`, bei Inboxes ein `401`. Eine abgelaufene Anmelde-Session ist bei Inboxes `unauthorized` (401) |
| `scope_required`, `wrong_project` (403) | `forbidden` (403); `details.reason` nennt den Grund (`scope`, `project`, `project_confined`, …), und `details.required` nennt einen fehlenden Scope |
| `already_exists`, `state_conflict`, `not_empty`, `idempotency_key_reused` (409) | `conflict` (409); `details.reason` sagt, welcher Fall vorliegt (`event_type_exists`, `project_not_empty`, `idempotency_key_reuse`, …) |
| `rate_limit_exceeded` | `rate_limited` (429) |
| `quota_exceeded` als 429 | `quota_exceeded` als 402 |
| `internal_error` bei jeder API | `internal_error` bei beiden APIs seit dem 15.10.2026; Webhooks sendete vorher `internal` |
| `service_unavailable` (503), `gateway_timeout` (504) | `unavailable` (503) bei Inboxes, wenn die Annahme von Nachrichten ausgeschaltet ist, und bei Request Bins, wenn die Weiterleitung einen Request nicht annehmen kann; ein `502`/`504` vom Gateway hat möglicherweise keinen JSON-Body |

## Muster für die Fehlerbehandlung {#pattern}

```ts
async function call(): Promise<Event> {
  const res = await fetch(url, opts)
  if (res.ok) return await res.json()

  // A gateway 502/504 can arrive without a JSON body
  const body = await res.json().catch(() => null)
  const error = body?.error ?? { code: 'error', message: res.statusText }
  // Log this with every error; the header carries it when the body doesn't
  const requestId = error.request_id ?? res.headers.get('X-Request-ID')
  // While a code is being renamed, next_code is what it will become: prefer it
  const code = error.next_code ?? error.code

  // Switch on the code, not the status: one status can carry several codes
  switch (code) {
    case 'rate_limited': {
      const wait = Number(res.headers.get('Retry-After') ?? '1')
      await sleep(wait * 1000)
      return call() // retry
    }
    case 'invalid_credential': // All: a key the API can't accept (403 on Webhooks, 401 on Inboxes and Request Bins)
    case 'unauthorized': // All: no usable credential
      // The credential is missing or bad: replace it rather than retry with it
      throw new CredentialError(error, requestId)
    case 'forbidden': {
      // Optional refinement: why it was refused, and what would have been allowed
      const reason = error.details?.reason // 'scope', 'role', 'project', 'project_confined', 'csrf', …
      const required = error.details?.required // 'admin', 'member', 'read' or 'publish', when sent
      throw new PermissionError(error, requestId, reason, required)
    }
    case 'validation_error': { // All
      const entries = error.details?.errors ?? []
      throw new ValidationError(entries, requestId)
    }
    case 'quota_exceeded':
    case 'not_entitled':
      // Retrying won't help; the plan has to change, or the period has to roll over
      throw new PlanError(error, requestId)
    default:
      // Unknown code, but the family tells us the rough shape
      if (res.status >= 500) {
        // Server-side; safe to retry idempotent ops
        throw new RetryableError(error, requestId)
      }
      throw new TerminalError(error, requestId)
  }
}
```

Die allgemeine Regel: **Verzweigen Sie nach `error.next_code ?? error.code`, und behandeln Sie im Default-Fall nach Statusklasse**. Neue Codes, die zu bestehenden Status hinzukommen, führen nicht dazu, dass Ihr Code bricht; Ihr Default-Fall behandelt sie. `details.reason` präzisiert einen Fall und ersetzt ihn nie: Ein Grund, den Sie nicht kennen, erhält die Behandlung des Codes. Parsen Sie `message` nicht; wo ein Wert für Code gedacht ist, etwa die ID, die nicht gefunden wurde, oder das Limit, das erreicht wurde, steht er in `details`. Dieselbe Regel gilt für ein Dashboard oder ein SDK, das auf diesen APIs aufbaut: Die veröffentlichten [SDKs](/docs/product-webhooks/sdks) reichen `error.code` unverändert durch, verzweigen Sie also nach dem Code, den die Exception trägt, und prüfen Sie auf beide Schreibweisen eines Codes, der gerade umbenannt wird.

## Bugs melden {#bugs}

Jede Antwort, die eine API sendet, trägt einen Header `X-Request-ID`, Fehler eingeschlossen, und die APIs erlauben JavaScript im Browser, ihn zu lesen. Ihre Fehler-Bodys tragen dieselbe ID als `error.request_id`. Wenn auf unserer Seite etwas nicht stimmt (5xx, unerwartetes Verhalten), finden wir den Aufruf über die Request-ID in unseren Logs. Protokollieren Sie sie bei jedem Fehler und geben Sie sie in Support-Tickets an.

Teilen Sie Request-IDs nicht öffentlich (sie sind nicht geheim, aber jeder, der sie hat, kann uns damit nach dem Traffic Ihres Kontos fragen). Verwenden Sie sie in privaten Kanälen (Support, Tickets im Dashboard).

## Nächste Schritte {#next-steps}

- [Konventionen](/docs/conventions) — der Rest des Aufbaus von Requests und Antworten.
- [Authentifizierung](/docs/authentication) — die Codes für Authentifizierungsfehler im Zusammenhang.
- [Rate-Limiting](/docs/rate-limiting) — die Mechanik von `Retry-After` im Detail.
- [Idempotenz](/docs/idempotency) — das Muster für sichere Retries bei 5xx + 429.
- [Versionierung](/docs/versioning) — was als inkompatible Änderung zählt und die Abkündigungsfrist von 12 Monaten, die auch die Umbenennung eines Codes erhält.
