---
title: "Authentifizierung"
description: "API-Keys, Scopes, Projektgrenzen und wie Sie Credentials sicher rotieren."
publishedAt: 2026-05-19
updatedAt: 2026-10-15
kind: concept
---

# Authentifizierung

Die NimbusNexus-API verwendet **API-Keys** als Bearer-Tokens. Für jeden Endpoint gilt derselbe Mechanismus — kein eigenes Credential-Format pro Ressource, kein separates Signaturverfahren für „fortgeschrittene“ Aufrufe. Wenn Sie einen authentifizierten Request senden können, können Sie alle senden.

## Aufbau eines Requests {#request-shape}

Senden Sie den Key im Header `Authorization`. Das Format ist wörtlich das Wort `Bearer`, gefolgt von Ihrem Key:

```bash
curl {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer nn_live_xxxxxxxxxxxxxxxx"
```

Keys tragen ein Präfix je nach Umgebung: `nn_live_*` für die Produktion, `nn_test_*` für die Sandbox. Nach dem Präfix folgen 32–48 Zeichen aus einem base32-sicheren Alphabet.

## Key generieren {#generating}

Im Dashboard: **Settings → API keys → New key**. Den Wert des Keys sehen Sie genau einmal, beim Erstellen; kopieren Sie ihn dann. Danach zeigt das Dashboard nur das Präfix + die letzten 4 Zeichen, damit Sie die Keys auseinanderhalten können, ohne das Secret offenzulegen.

Eine API zum Erstellen von API-Keys gibt es absichtlich nicht. Wenn ein Key kompromittiert ist, braucht die Wiederherstellung einen Out-of-Band-Kanal, den der kompromittierte Key nicht erreichen kann — dass Sie dafür das Dashboard verwenden müssen, ist der Engpass, der diese Wiederherstellung sauber macht.

## Bindung an ein Projekt {#project-scope}

Jeder API-Key gilt für ein **einzelnes Projekt**. Der Key kann Ressourcen in seinem Projekt lesen und schreiben; Ressourcen in anderen Projekten sieht er nicht, auch nicht innerhalb desselben Kontos.

Projekte sind die Einheit für Zugriffskontrolle, Abrechnung und Isolation. Das Standardprojekt, das ein neues Konto mitbringt, reicht aus, wenn Sie allein entwickeln; Produktionsteams wollen meist ein Projekt pro Umgebung (`prod`, `staging`, `dev`), damit ein kompromittierter Dev-Key keine Produktionsdaten erreicht.

Projekt wechseln = einen neuen Key im Zielprojekt generieren. Einen Mechanismus nach dem Muster „diesen Key verwenden, aber so tun, als wäre man in einem anderen Projekt“ gibt es nicht; er würde die Isolationsgarantie aushöhlen.

## Scopes (Fähigkeiten) {#scopes}

Keys tragen **Scopes**, die begrenzen, was sie in ihrem Projekt tun dürfen. Ein neuer Key erhält standardmäßig Lesen+Schreiben auf alles im Projekt; beim Erstellen können Sie das einschränken, z. B. auf nur `vms:read` für einen Monitoring-Agenten, der nie Ressourcen erstellen muss.

Die vollständige Liste der Scopes folgt den Ressourcentypen:

- `vms:read`, `vms:write`, `vms:create`, `vms:delete`
- `databases:read`, `databases:write`, …
- `block-storage:read`, `block-storage:write`, …
- `object-storage:read`, `object-storage:write`, …
- `iam:read`, `iam:write` (Benutzer, Projekte und Keys selbst verwalten)

Ein Request an einen Endpoint, der einen Scope verlangt, den der Key nicht hat, erhält `403 Forbidden` mit `error.code: 'forbidden'`, und `error.message` nennt, was gefehlt hat. So kostet es wenig, mit engen Scopes zu beginnen und sie erst zu erweitern, wenn etwas fehlschlägt. (Frühere Versionen dieser Seite versprachen `scope_required` mit dem Scope in `error.fields.scope`; die API hat keins von beiden je gesendet.)

## Rotation {#rotation}

Jeder Key lässt sich unabhängig rotieren. Das Rotieren eines Keys:

1. Generiert einen neuen Wert für den Key.
2. Markiert den alten Key als **veraltet**, hält ihn aber **24 Stunden** lang gültig.
3. Protokolliert in diesem Zeitraum die Nutzung beider Keys, damit Sie prüfen können, ob der neue Key im Einsatz ist, bevor der alte ungültig wird.

Für die automatische Rotation (die wir empfehlen) rufen Sie die IAM-API nach einem Zeitplan auf und lassen die 24-stündige Übergangsfrist das Rollout-Fenster abfangen. Tools, die den Key lange halten (CI/CD, deployte Agenten), sollten ihn beim Prozessstart neu einlesen, damit sich eine Rotation innerhalb eines Deploy-Zyklus durchsetzt.

Wenn Sie vermuten, dass ein Key kompromittiert ist, **widerrufen** Sie ihn, statt ihn zu rotieren — das überspringt die 24-stündige Übergangsfrist und macht den alten Key sofort ungültig. Im Dashboard widerrufen Sie mit einem Klick; für den programmatischen Notfall-Widerruf gibt es zusätzlich einen IAM-Endpoint.

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
- Für Dienst-zu-Dienst-Setups in Ihrer eigenen Infrastruktur können Sie außerdem **Trust-Beziehungen** zwischen Projekten anlegen — siehe die IAM-Referenz (folgt in Kürze).
