---
title: "Referenz für Transforms"
description: "Jede Route der Transforms-API, die Objekte für Pipelines und Ausführungen, wer was darf, die Limits jedes Tarifs und die Fehler."
publishedAt: 2026-11-06
updatedAt: 2026-11-06
kind: reference
---

# Referenz für Transforms

Die API unter `https://transforms.nimbusnexus.net/v1` legt Pipelines an, versioniert, testet und führt sie aus, nur für Ihren Workspace. Requests und Antworten sind JSON. Senden Sie einen Key als `Authorization: Bearer <key>` oder `X-API-Key: <key>` ([Zugang erhalten](/docs/product-transforms#access)). Timestamps sind ISO 8601 in UTC. Der [Überblick](/docs/product-transforms) erklärt das Produkt und [Pipelines](/docs/product-transforms/pipelines) das Dokument.

## Routen {#routes}

| Route | Was sie tut | Benötigt |
| --- | --- | --- |
| `POST /v1/pipelines` | Eine Pipeline und ihre Version 1 anlegen; `201` mit [der Pipeline](#pipeline) | write; mit einem Credential-Schritt admin |
| `GET /v1/pipelines` | Die Pipelines des Workspaces, neueste zuerst, jede ohne ihr Dokument | read |
| `GET /v1/pipelines/{id}` | Eine Pipeline, mit ihrem aktuellen Dokument und der Angabe, wo sie läuft | read |
| `PATCH /v1/pipelines/{id}` | Sie umbenennen, ein- oder ausschalten oder [eine neue Version speichern](#versions) | write; mit einem neuen Credential-Schritt admin |
| `DELETE /v1/pipelines/{id}` | Eine Pipeline und ihre Versionen endgültig löschen; `204` | admin |
| `GET /v1/pipelines/{id}/versions` | Die aufbewahrten Versionen, neueste zuerst, jede ohne ihr Dokument | read |
| `GET /v1/pipelines/{id}/versions/{version}` | Eine Version, mit ihrem Dokument | read |
| `POST /v1/pipelines/{id}/run` | Eine gespeicherte Pipeline mit einem Request [ausführen](#run) | read |
| `POST /v1/pipelines/test` | Ein Dokument mit einem Request [testen](#test), ohne etwas zu speichern oder zu zählen | write |
| `GET /v1/pipelines/templates` | Die [Vorlagen](/docs/product-transforms/pipelines#templates) als Ausgangspunkt | read |
| `POST /v1/slots` | Einen [Credential-Slot](#slots) hinzufügen; `201` mit dem Slot | admin |
| `GET /v1/slots`, `GET /v1/slots/{id}` | Die Slots des Workspaces, neueste zuerst, oder ein einzelner | read |
| `PATCH /v1/slots/{id}` | Einen Slot umbenennen | admin |
| `DELETE /v1/slots/{id}` | Einen Slot löschen; `204` | admin |
| `GET /v1/plan` | Der Tarif des Workspaces und seine Limits | read |
| `GET /v1/usage` | Die Ausführungen dieses Monats und was der Workspace hat | read |

**read**, **write** und **admin** sind unter [Wer was darf](#authority) erklärt.

Listen werden mit `limit` (1 bis 200, Standard 50) und `offset` (0 bis 10,000) paginiert. Die Antwort ist `{"items": [...], "next_offset": <offset>}`: Übergeben Sie `next_offset` als `offset`, um die nächste Seite zu erhalten. Auf der letzten Seite ist der Wert `null`.

## Das Pipeline-Objekt {#pipeline}

| Feld | Bedeutung |
| --- | --- |
| `id` | `pipe_` und 24 Hexadezimalzeichen. Jede Route erwartet sie, und ein Produkt verweist darüber auf die Pipeline. |
| `name` | Ihr Name für die Pipeline, bis zu 200 Zeichen. |
| `status` | `enabled` oder `disabled`: Ihr Schalter. Eine deaktivierte Pipeline läuft nicht, weder hier noch in einem Produkt, das auf sie verweist. |
| `current_version` | Die Version, die läuft. |
| `pipeline` | Das Dokument der aktuellen Version; `null` in der Liste. |
| `destinations` | Die Dienste, die sie per Referenz ausführen, jeder einmal; `null` in der Liste ([Wer eine Pipeline ausführt](#destinations)). |
| `consumers` | Was jeder von ihnen ausführt: `service`, `version`, `last_seen_at`, der letzte Abruf dieser Version, und `pinned`, `true`, wenn eine Referenz diese Version festhält; `null` in der Liste. |
| `created_at`, `updated_at` | Wann sie angelegt und wann sie zuletzt geändert wurde. |

`POST /v1/pipelines` erwartet `name` und `pipeline`. Ein Dokument, das nie laufen könnte, wird mit [`422` `invalid_pipeline`](#invalid-pipeline) abgewiesen. Hat der Workspace bereits so viele Pipelines, wie sein Tarif erlaubt, lautet die Antwort `402` `quota_exceeded`, mit `details.metric` `pipelines`, `details.limit` und `details.current`.

## Versionen {#versions}

`PATCH /v1/pipelines/{id}` erwartet `name`, `status`, `pipeline` oder eine beliebige Kombination davon. Eine neue `pipeline` wird so geprüft wie beim Anlegen und als nächste Version gespeichert.

- Eine Version ändert sich nie, sodass ein Produkt seine Kopie anhand von ID und Version behalten kann.
- Wird derselbe Inhalt gespeichert, entsteht keine neue Version.
- Eine alte Version wiederherzustellen heißt, ihren Inhalt erneut zu speichern; sie wird damit zur neuesten.
- Aufbewahrt werden so viele Versionen, wie der Tarif vorsieht, die neuesten zuerst, und ein Speichern entfernt die ältesten darüber hinaus. Auch eine Version, die ein Produkt festschreibt oder die wir in den letzten 30 Tagen bei einem Produkt im Einsatz gesehen haben, wird aufbewahrt.

Jede Version in `GET /v1/pipelines/{id}/versions` hat `version`, `created_by` und `created_at`; `GET /v1/pipelines/{id}/versions/{version}` liefert zusätzlich ihre `pipeline`. Eine Version, die nicht mehr aufbewahrt wird, antwortet mit `404` `not_found`, `pipeline_version`.

## Pipeline ausführen {#run}

`POST /v1/pipelines/{id}/run` wendet die aktuelle Version oder die aufbewahrte, die `version` nennt, auf das an, was Sie senden:

| Feld | Bedeutung |
| --- | --- |
| `body` | Ein beliebiger JSON-Wert, bis zu 256 KiB als kompaktes JSON und höchstens 32 Ebenen tief verschachtelt. |
| `headers` | Ein Wert pro Name, höchstens 256. Ein Name hat bis zu 256 Zeichen, ein Wert bis zu 8,192. Darüber antwortet die API mit `422` `validation_error`. |
| `meta` | Schreibgeschützter Kontext für `$meta`: ein beliebiger JSON-Wert, höchstens 32 Ebenen tief verschachtelt. |
| `version` | Die aufbewahrte Version, die laufen soll. Ohne das Feld die aktuelle. |

Vom Request wird nichts behalten, und die Ausführung wird gezählt. Die Antwort ist ein `200`, gleich, was die Pipeline getan hat:

| Feld | Bedeutung |
| --- | --- |
| `status` | `ok`, senden Sie `body` und `headers`; `dropped`, ein Filter hat den Request verworfen, senden Sie also nichts; `failed`, die Pipeline kann bei diesem Request nicht laufen. |
| `version` | Die Version, die gelaufen ist; `null` bei einem [Test](#test). |
| `body`, `body_changed` | Der Body, der gesendet werden soll, und `true`, wenn ein Schritt ihn umgeschrieben hat. `null`, außer bei `ok`. |
| `headers` | Die Header, die gesendet werden sollen, der Wert eines Credentials maskiert als `Bearer ••••`. |
| `query` | Was ein `auth`-Schritt an die URL anfügt, auf dieselbe Weise maskiert. |
| `step` | Der Schritt, der den Request verworfen hat oder an dem die Ausführung fehlgeschlagen ist, ab 0 gezählt; sonst `null`. |
| `note` | Die Notiz eines verwerfenden Schritts. |
| `reason` | `no_match` bei einem Filter, auf den der Request nicht gepasst hat, `matched` bei einem verwerfenden Filter, auf den er gepasst hat, oder warum die Ausführung fehlgeschlagen ist, etwa `set_conflict` oder `too_many_nodes`. Behandeln Sie das Feld als offenen String. |
| `error` | Dasselbe in Worten, etwa `step 2: set_conflict: …`. |
| `duration_ms` | Wie lange die Ausführung gedauert hat. |

Dieselbe Pipeline schlägt beim selben Request auf dieselbe Weise fehl; wiederholen Sie ein `failed` daher nicht. Eine deaktivierte Pipeline antwortet mit `409` `conflict`, `pipeline_disabled`, und über der Rate des Tarifs antwortet eine Ausführung mit `429` `rate_limited`, mit `details.retry_after`.

## Dokument testen {#test}

`POST /v1/pipelines/test` erwartet `pipeline`, ein Dokument, das nicht gespeichert sein muss, mit `body`, `headers` und `meta`. Es wird so geprüft wie beim Speichern, läuft einmal und speichert und zählt nichts, teilt sich aber die Rate des Tarifs. Ein Verwerfen oder ein Fehlschlag ist ein `200`, das genau das sagt.

## Credential-Slots {#slots}

Ein Slot ist das, was ein `auth`-Schritt nennt: eine ID und eine Bezeichnung, ohne Wert. Transforms speichert kein Credential, und keine Route nimmt eines entgegen. Ein Produkt, das die Pipeline per Referenz ausführt, ordnet dem Slot ein eigenes Secret zu ([Credentials](/docs/product-transforms#credentials)). `POST /v1/slots` erwartet `label`, bis zu 200 Zeichen, und antwortet mit `201`:

| Feld | Bedeutung |
| --- | --- |
| `id` | `sec_` und Buchstaben und Ziffern: das, was ein `auth`-Schritt nennt; sie ändert sich nie. |
| `label` | Wofür das Credential ist. Produkte sehen die Bezeichnung, wenn sie dem Slot ein Secret zuordnen. |
| `pipeline_count` | Bei wie vielen Pipelines die aktuelle Version den Slot nennt. |
| `created_at`, `updated_at` | Wann er hinzugefügt und wann er zuletzt umbenannt wurde. |

`PATCH /v1/slots/{id}` erwartet `label`. `DELETE /v1/slots/{id}` antwortet mit `204` oder, solange die aktuelle Version einer Pipeline den Slot nennt, mit `409` `conflict` und `details.reason` `slot_in_use`, `details.id` und `details.pipelines`, der Anzahl der Pipelines. Hat der Workspace bereits so viele Slots, wie sein Tarif erlaubt, antwortet das Hinzufügen mit `402` `quota_exceeded`, mit `details.metric` `slots`.

## Wer eine Pipeline ausführt {#destinations}

Ein Produkt verweist über die ID auf eine Pipeline und führt sie in seinem eigenen Prozess aus, mit seinen eigenen Secrets. Webhooks ist das erste: [Transformationen](/docs/product-webhooks/transformations#reference). Jeder Abruf hält den Dienst und die Version fest, sodass eine gelesene Pipeline `destinations` und `consumers` zeigt.

Eine neue Version mit einem `auth`-Schritt erreicht beim Speichern jedes Produkt, das die Pipeline ausführt, und das Löschen der Pipeline ebenso. Jeder dieser Aufrufe muss in `confirm_destinations` jeden Dienst nennen, der eine Referenz hält oder den wir in den letzten 30 Tagen gesehen haben, im Body eines `PATCH` und in der Query eines `DELETE`. Andernfalls lautet die Antwort `409` `conflict` mit `details.reason` `destinations_unconfirmed` und `details.destinations`, und nichts ändert sich. Die eigenen URLs eines Dienstes stehen hier nie: Dieses Produkt verlangt für sie selbst dieselbe Bestätigung.

## Wer was darf {#authority}

| | Pipelines, Versionen, Vorlagen, Slots, Tarif und Verbrauch lesen; ausführen | Pipelines anlegen, ändern und testen | Eine Pipeline löschen, einen Credential-Schritt speichern oder einen Slot hinzufügen, umbenennen oder löschen |
| --- | --- | --- | --- |
| Owner oder Admin des Workspaces | ja | ja | ja |
| Member | ja | ja | nein |
| Viewer oder jede andere Rolle | ja | nein | nein |
| Key mit **Read & write** (Scope `admin`) | ja | ja | ja |
| Key mit **Read** (Scope `read`) | ja | nein | nein |

Eine abgewiesene Aktion antwortet mit `403` `forbidden` und `details.reason` `role`, und `details.required` nennt die nötige Rolle. Ein Member darf eine Pipeline mit einem Credential-Schritt weiterhin umbenennen, ausführen und testen und den Schritt entfernen. Die Kontokonsole erstellt Keys mit **Read** und **Read & write**, und ein Key mit einem anderen Scope, etwa `write`, wird wie **Read** behandelt.

Transforms bedient ganze Workspaces. Ein Gastzugang oder ein Key, der auf ein Projekt beschränkt ist, wird mit `403` `project_confined` abgewiesen. Ein Workspace hat Transforms, sobald ein Owner oder Admin die Konsole geöffnet oder das Produkt über **Add a product** hinzugefügt hat. Bis dahin werden andere Mitglieder mit `403` `product_not_enabled` abgewiesen.

## Tarife und Limits {#limits}

`GET /v1/plan` gibt an, welche Limits gelten: `plan`, der hinterlegte Tarif; `enforced_as`, der Tarif, dessen Limits gelten, `free`, wenn es keinen gibt; `ceilings`, die Limits nach Namen; `past_due`, `suspended` und `system`.

| Feld in `ceilings` | Bedeutung | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- | --- |
| `max_pipelines` | Pipelines, die ein Workspace haben darf | 5 | 25 | 100 | 1,000 |
| `max_secret_slots` | Credential-Slots, die ein Workspace haben darf | 5 | 25 | 100 | 1,000 |
| `max_versions` | Aufbewahrte Versionen pro Pipeline | 10 | 25 | 50 | 100 |
| `run_rate_per_min` | Ausführungen und Tests pro Minute, pro Workspace | 60 | 600 | 3,000 | 12,000 |

Gleichzeitig dürfen so viele Ausführungen eintreffen, wie in zehn Sekunden erlaubt sind, mindestens aber 10. `GET /v1/usage` gibt an, wie viel verbraucht ist: `period`, der Monat, angegeben als sein erster Tag; `runs`, `failures` und `dropped` dieses Monats, über die Ausführungs-API; `pipelines`, gemessen an `max_pipelines`; und `slots`, die vorhandenen Slots, gemessen an `max_secret_slots`. Ausführungen werden gezählt, nicht abgerechnet, und eine Ausführung in einem Produkt, das auf die Pipeline verweist, zählt zum Verbrauch dieses Produkts.

Solange eine Zahlung offen ist, werden Änderungen mit `402` `workspace_frozen` abgewiesen, und Ausführungen und Tests laufen weiter. Endet die Nachfrist, werden auch Ausführungen und Tests abgewiesen, mit `402` `workspace_suspended`. Lesen und Löschen bleiben möglich.

## Fehler {#errors}

Die Fehler der API verwenden das unter [Fehler](/docs/errors) beschriebene Format.

| Status | `code` | Wann |
| --- | --- | --- |
| `400` | `bad_request` | Ein JSON-Body, der kein gültiges UTF-8 ist. |
| `401` | `unauthorized` | Kein Credential, ein widerrufenes oder eine beendete Anmeldung in der Konsole; `details.reason` nennt den Fall. |
| `401` | `invalid_credential` | Ein Key, der sich nicht verifizieren lässt, abgelaufen ist oder für ein anderes Produkt erstellt wurde. |
| `402` | `quota_exceeded` | Eine Pipeline anlegen oder einen Slot hinzufügen, während alle des Tarifs belegt sind; `details.metric` ist `pipelines` oder `slots`. |
| `402` | `workspace_frozen`, `workspace_suspended` | Eine Änderung, während eine Zahlung offen ist, oder alles außer Lesen und Löschen, nachdem der Dienst eingestellt wurde. |
| `403` | `forbidden` | `details.reason` ist `role`, `project_confined`, `product_not_enabled`, `csrf` oder `no_workspace`. |
| `404` | `not_found` | Die Pipeline, die Version oder der Slot existiert in Ihrem Workspace nicht; `details.reason` ist `pipeline`, `pipeline_version` oder `slot`. |
| `405` | `method_not_allowed` | Der Pfad existiert, aber nicht für diese Methode. |
| `409` | `conflict` | `details.reason` ist `pipeline_disabled` ([Pipeline ausführen](#run)), `destinations_unconfirmed` ([Wer eine Pipeline ausführt](#destinations)) oder `slot_in_use` ([Credential-Slots](#slots)). |
| `413` | `payload_too_large` | Ein Request-Body über 1 MiB. |
| `422` | `invalid_pipeline` | Eine Pipeline, die nie laufen könnte, beim Speichern oder Testen. |
| `422` | `validation_error` | Ein Parameter oder Feld hat die Validierung nicht bestanden. Ein NUL-Zeichen im Pfad, in der Query oder in einem JSON-Body ergibt den Eintragstyp `transforms.nul_character`. |
| `429` | `rate_limited` | Mehr Ausführungen pro Minute, als der Tarif erlaubt; `details.retry_after` gibt an, wann Sie es erneut versuchen können. |
| `500` | `internal_error` | Auf unserer Seite ist etwas kaputtgegangen. |

### Ungültige Pipelines {#invalid-pipeline}

Die Ablehnung nennt das erste Problem: `details.reason`, `details.path` (ein JSON Pointer darauf) und `details.step` (ab 0 gezählt), jeweils sofern zutreffend.

```json
{ "error": { "code": "invalid_pipeline", "message": "…", "details": { "reason": "credential_header", "path": "/steps/0/headers/set/Authorization", "step": 0 }, "request_id": "…" } }
```

| `reason` | Was nicht stimmt |
| --- | --- |
| `invalid_document` | Es ist kein Objekt mit einer `version` und einer Liste von `steps`. |
| `unsupported_version` | `version` ist nicht `1`. |
| `no_steps` | Es gibt keine Schritte. |
| `too_many_steps` | Es gibt mehr als 20 Schritte. |
| `invalid_step` | Ein Schritt ist kein Objekt mit genau einem Schritt-Schlüssel, neben dem höchstens eine `note` und bei einem Filter eine `action` stehen. |
| `unknown_step` | Ein Schritt-Schlüssel ist nicht `filter`, `drop`, `set`, `map`, `headers` oder `auth`. |
| `invalid_value` | Eine Einstellung passt nicht zu ihrem Schritt, etwa ein leeres `drop` oder eine Notiz mit mehr als 200 Zeichen. |
| `invalid_path` | Ein Pfad lässt sich nicht lesen oder enthält eine Wildcard, wo sein Schritt keine erlaubt. |
| `invalid_template` | Ein Ausdruck lässt sich nicht lesen oder nennt einen Filter, den es nicht gibt. |
| `invalid_filter` | Ein Filter ist ungültig, etwa einer mit einem unbekannten Operator. |
| `invalid_header` | Ein Header-Name ist ungültig oder gehört zur Verbindung, oder ein Wert ist kein druckbares ASCII in einer Zeile. |
| `invalid_secret` | Das `secret` eines Auth-Schritts ist nicht die ID eines Slots. Ein dort eingefügter Wert wird in keiner Meldung wiederholt. |
| `auth_not_last` | Ein Schritt steht nach einem Auth-Schritt. |
| `too_deep` | Etwas ist tiefer als 32 Ebenen verschachtelt. |
| `too_large` | Die Einstellungen eines Schritts sind größer als 16 KiB, oder das Dokument ist größer als 64 KiB. |
| `not_json` | Es enthält einen Wert, der kein JSON ist. |
| `forbidden_header` | Ein Schritt setzt `Set-Cookie`, einen Header, den kein Request trägt. |
| `credential_header` | Ein Header-Schritt setzt `Authorization`, `Cookie` oder `X-Api-Key`, wodurch das Credential in der Pipeline gespeichert würde. Fügen Sie es stattdessen mit einem Auth-Schritt hinzu. |
| `unknown_slot` | Ein Auth-Schritt nennt einen Slot, den der Workspace nicht hat. |

Behandeln Sie `reason` als offenen String und sehen Sie einen Standardfall für Werte vor, die Sie nicht kennen.

## Nächste Schritte {#next-steps}

- [Schnellstart](/docs/product-transforms/quickstart) — eine Pipeline testen, speichern und ausführen.
- [Pipelines](/docs/product-transforms/pipelines) — jeder Schritt, Pfad und Filter und jede Vorlage.
- [Fehler](/docs/errors) — das Fehlerformat, jedes Feld in `details` und ein Muster für den Umgang damit.
