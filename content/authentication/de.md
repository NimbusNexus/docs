---
title: "Authentifizierung"
description: "API-Keys, Rollen und Zugriffsregeln, Projektgrenzen und wie Sie einen Key sicher ersetzen."
publishedAt: 2026-05-19
updatedAt: 2026-11-04
kind: concept
---

# Authentifizierung

Die NimbusNexus-API unter `{{API_HOST}}` nimmt einen **API-Key** im Header `X-API-Key` entgegen. Jeder Key gehört einer Person und gilt in einem Projekt, mit den Rollen und Zugriffsregeln, mit denen er erstellt wurde.

## Aufbau eines Requests {#request-shape}

Senden Sie den Key im Header `X-API-Key`:

```bash
curl {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY"
```

Der Key ist der Wert `api_key`, den Sie beim Erstellen erhalten: die ID des Keys und sein Secret, durch einen Doppelpunkt verbunden und base64-kodiert. Auf einen Key, den die API nicht dekodieren kann oder nicht kennt, antwortet sie mit `401`.

## Key generieren {#generating}

Erstellen Sie einen Key im Dashboard oder mit `POST /api/v1/api_keys/` aus einer angemeldeten Sitzung, die für das Projekt des Keys gilt. Geben Sie ihm einen `name`, der unter Ihren Keys eindeutig ist, und optional eine `description` und ein `expires_at`. Die Antwort enthält den Key genau einmal, in `api_key`; kopieren Sie ihn dann. Danach liefert die API Name, Rollen, Zugriffsregeln und Ablauf des Keys, aber nie sein Secret.

## Bindung an ein Projekt {#project-scope}

Jeder API-Key gilt für ein **einzelnes Projekt**. Der Key kann Ressourcen in seinem Projekt lesen und schreiben; Ressourcen in anderen Projekten sieht er nicht, auch nicht innerhalb desselben Kontos.

Projekte sind die Einheit für Zugriffskontrolle und Isolation; abgerechnet wird pro Workspace. Das Standardprojekt, das ein neues Konto mitbringt, reicht aus, wenn Sie allein entwickeln; Produktionsteams wollen meist ein Projekt pro Umgebung (`prod`, `staging`, `dev`), damit ein kompromittierter Dev-Key keine Produktionsdaten erreicht.

Projekt wechseln = einen neuen Key im Zielprojekt generieren. Einen Mechanismus nach dem Muster „diesen Key verwenden, aber so tun, als wäre man in einem anderen Projekt“ gibt es nicht; er würde die Isolationsgarantie aushöhlen.

## Was ein Key darf {#scopes}

Ein Key handelt mit **Rollen** in seinem Projekt, und **Zugriffsregeln** begrenzen, welche Aufrufe er machen darf:

- `roles` — die Rollen, mit denen der Key handelt, ausgewählt aus denen, die Sie im Projekt haben. Lassen Sie das Feld weg, erhält der Key alle.
- `access_rules` — die Aufrufe, die der Key machen darf. Jede Regel ist ein `service` (`api` für diese API), eine `method` und ein `path`, etwa `GET` und `/api/v1/instance/`. `GET /api/v1/api_keys/access_rules_artifacts` listet jede Methode und jeden Pfad auf, die Sie angeben können; auf einen Pfad, den es nicht gibt, antwortet das Erstellen des Keys mit `422`.
- `unrestricted: true` — keine Zugriffsregeln: Der Key darf jeden Aufruf machen, den seine Rollen erlauben.

Ein Key ohne Zugriffsregeln und ohne `unrestricted` kann nur seine eigene Sitzung lesen (`GET /api/v1/account/get_session_auth_data`). Ein Aufruf außerhalb der Zugriffsregeln eines Keys erhält `403` mit der Meldung „API key is restricted for this path!“. So kostet es wenig, mit engen Regeln zu beginnen und Aufrufe erst hinzuzufügen, wenn einer abgelehnt wird.

## Rotation {#rotation}

Einen Rotations-Aufruf gibt es nicht. Um einen Key zu ersetzen, erstellen Sie den neuen, stellen Ihre Tools darauf um und löschen dann den alten mit `DELETE /api/v1/api_keys/{api_key_id}`. Die API prüft den Key bei jedem Request, deshalb funktioniert ein gelöschter Key schon beim nächsten Aufruf nicht mehr. Tools, die den Key lange halten (CI/CD, deployte Agenten), sollten ihn beim Prozessstart neu einlesen, damit sich eine Rotation innerhalb eines Deploy-Zyklus durchsetzt. Geben Sie Keys ein `expires_at`, damit ein vergessener Key von selbst aufhört zu funktionieren.

Wenn Sie vermuten, dass ein Key kompromittiert ist, löschen Sie ihn sofort, im Dashboard oder mit `DELETE /api/v1/api_keys/{api_key_id}` aus einer angemeldeten Sitzung.

## Häufige Fehler {#errors}

Die Webhooks-API und die Inboxes-API beantworten ein Problem mit dem Credential mit diesen Codes. In einem Punkt unterscheiden sie sich: `invalid_credential`, ein Key, den die API nicht erkennt, ist bei Webhooks ein `403` und bei Inboxes ein `401`.

| Status | error.code | API | Bedeutung |
| --- | --- | --- | --- |
| 401 | `unauthorized` | Beide | Es wurde kein Credential gesendet (weder `Authorization` noch `X-API-Key`), oder der Key wurde widerrufen. |
| 401 / 403 | `invalid_credential` | Beide | Der Key oder das Token ist nicht gültig: bei Inboxes ein `401`, bei Webhooks ein `403`. Ersetzen Sie das Credential; es erneut zu senden, funktioniert nicht. |
| 403 | `forbidden` | Beide | Der Key ist gültig, darf das aber nicht: ein fehlender Scope oder eine fehlende Rolle, ein auf Projekte beschränkter Key, der außerhalb seiner Projekte verwendet wird, oder ein Produkt, das für Ihren Workspace nicht aktiviert ist. |

`message` nennt, welcher Fall vorliegt; verzweigen Sie nach `code`, nicht nach dem Status: `invalid_credential` ist bei Webhooks ein `403` und bei Inboxes ein `401`. Behandeln Sie den Code zusammen mit `unauthorized`, als „dieses Credential taugt nichts“.

Frühere Versionen dieser Seite führten `no_credentials`, `invalid_credentials`, `expired_credentials`, `scope_required` und `wrong_project` auf. Diese Codes haben die APIs nie gesendet. Sie senden `unauthorized`, wo die Seite `no_credentials` nannte; `invalid_credential`, wo sie `invalid_credentials` oder `expired_credentials` nannte, denn ein abgelaufener Key ist einer, den die API nicht verifizieren kann; und `forbidden`, wo sie `scope_required` oder `wrong_project` nannte.

Die Fehler oben verwenden das Standard-Fehlerformat, das unter [Fehler](/docs/errors) beschrieben ist.

## Nächste Schritte {#next-steps}

- Lesen Sie [Konventionen](/docs/conventions), um die Muster kennenzulernen, denen jeder Endpoint folgt (Ressourcen-IDs, Paginierung, Fehler, Idempotenz).
- Lesen Sie die [Referenz für virtuelle Maschinen](/docs/api/vms) für ein konkretes, ausgearbeitetes Beispiel einer Ressourcen-API.
