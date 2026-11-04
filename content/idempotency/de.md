---
title: "Idempotenz"
description: "Welche Routen den Header Idempotency-Key annehmen und wie Sie auf den übrigen gefahrlos wiederholen."
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: concept
---

# Idempotenz

Ein Request ist **idempotent**, wenn er zweimal gesendet dieselbe Wirkung hat wie einmal. `GET /api/v1/instance/` ist von Natur aus idempotent — er ändert nichts. `POST /api/v1/instance/` ist von Natur aus **nicht** idempotent — rufen Sie ihn zweimal auf, erhalten Sie zwei VMs.

Mit dem Header `Idempotency-Key` machen Sie einen Request gefahrlos wiederholbar, aber nur auf den wenigen Routen, die ihn annehmen. Jede andere Route ignoriert den Header.

## Welches Problem das löst {#problem}

Sie veröffentlichen ein Event mit `POST /v1/events`. Auf dem Rückweg bricht die Netzwerkverbindung ab, und Sie erhalten ein Timeout statt eines 201. Wurde das Event versendet? Sie wissen es nicht:

- Wenn Sie den Request wiederholen: Vielleicht erhalten Ihre Kunden es dann zweimal (das Original war erfolgreich; Ihr Retry hat ein zweites veröffentlicht).
- Wenn Sie ihn nicht wiederholen: Vielleicht erhalten sie es dann nie (das Original ist fehlgeschlagen; Sie haben den falschen Zustand akzeptiert).

Mit einem Idempotency-Key ist der Retry sicher. War das Original erfolgreich, gibt der Retry das ursprüngliche Event zurück und verteilt nichts erneut. Ist das Original fehlgeschlagen, erledigt der Retry die Arbeit tatsächlich.

## Routen, die den Header annehmen {#usage}

| Route | API | Der Key ist |
| --- | --- | --- |
| `POST /v1/events` | Webhooks | Optional |
| `POST /v1/qr-tracked/imports` | QR-Codes | Erforderlich |
| `POST /api/v1/payment/payment_methods/{payment_method_id}/add_funds` | Infrastruktur | Erforderlich |

Senden Sie einen beliebigen eindeutigen String:

```bash
curl -X POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "event_type": "order.created", "payload": { "order_id": "1234" } }'
```

Üblich ist eine UUID v4 pro logischer Operation. Generieren Sie sie einmal auf dem Client, speichern Sie sie, bevor Sie den Request senden, und verwenden Sie sie bei jedem Retry derselben logischen Operation wieder. Für die *nächste* logische Operation generieren Sie eine neue.

## Bei der Webhooks-API {#webhooks}

Bei der Webhooks-API gilt `Idempotency-Key` für das Veröffentlichen eines Events (`POST /v1/events`) und verhält sich so:

| Sie senden | Sie erhalten |
| --- | --- |
| Einen neuen Key | `201` und das neue Event, verteilt an die passenden Endpoints. |
| Denselben Key und denselben Body | `200`, das **ursprüngliche** Event und den Header `Idempotency-Replayed: true`. Nichts wird erneut verteilt. |
| Denselben Key und einen anderen Body | `409` mit `error.code: 'conflict'`, `details.reason: 'idempotency_key_reuse'` und dem Key in `details.idempotency_key`. Das ursprüngliche Event bleibt bestehen. |
| Denselben Key nach einem fehlgeschlagenen Request | Der Request wird erneut ausgeführt. Ein fehlgeschlagener Publish (ein Validierungsfehler, ein Kontingentfehler, ein Rate-Limit) speichert den Key nicht. |

„Derselbe Body“ bedeutet derselbe Event-Typ und dieselbe Payload für dasselbe Projekt. Ein Key gehört zu Ihrem Workspace und Projekt, nicht zu dem API-Key, der ihn gesendet hat; zwei API-Keys, die in dasselbe Projekt veröffentlichen, teilen sich also die Keys. Ein Key wird mindestens 24 Stunden lang aufbewahrt.

## Bei QR-Codes und beim Aufladen von Guthaben {#other-routes}

Bei QR-Codes braucht ein Bulk-Import (`POST /v1/qr-tracked/imports`) einen Key. Ein Key gehört zu Ihrem Workspace. Derselbe Key und derselbe Body geben den ursprünglichen Import zurück, ohne seine Codes erneut zu erstellen; auf denselben Key und einen anderen Body antwortet die API mit `409`.

Das Aufladen Ihres Guthabens (`POST /api/v1/payment/payment_methods/{payment_method_id}/add_funds`) braucht ebenfalls einen Key, damit eine wiederholte Aufladung die Karte nicht zweimal belastet. Dieser Aufruf braucht eine angemeldete Sitzung, keinen API-Key ([Zahlungsmethoden](/docs/api/payment-methods)).

## Konflikt mit einer früheren Verwendung {#conflicts}

Wenn Sie bei Webhooks oder QR-Codes einen Key mit einem **anderen Request-Body** am selben Endpoint wiederverwenden, erhalten Sie `409 Conflict` mit `error.code: 'conflict'`, und `error.message` sagt, dass der Key bereits mit einem anderen Request-Body verwendet wurde. Der ursprüngliche Request bleibt bestehen; Ihr abweichender Body wird abgelehnt. Das ist das sicherste Verhalten — die alte Antwort stillschweigend zurückzugeben, würde einen Bug in Ihrer Retry-Schleife verdecken.

Wenn Sie tatsächlich einen anderen Request senden müssen, generieren Sie einen neuen Key.

Frühere Versionen dieser Seite gaben an, diese Antwort trage `error.code: 'idempotency_key_reused'`. Diesen Code hat die API nie gesendet; sie sendet `conflict`. `conflict` deckt auch andere Kollisionen mit bestehendem Zustand ab, etwa einen bereits vergebenen Namen; bei der Webhooks-API ist `details.reason` in diesem Fall `idempotency_key_reuse`. Siehe [Fehler](/docs/errors#codes-state).

## Auf allen anderen Routen {#skip}

Ohne Key prüfen Sie, bevor Sie einen Schreibzugriff wiederholen:

- **Eine VM oder ein Volume erstellen.** Der Aufruf stellt die Arbeit in die Warteschlange und antwortet ohne ID; suchen Sie die neue Ressource also in der Liste (`GET /api/v1/instance/`, `GET /api/v1/storage/`), bevor Sie ihn erneut senden. Mit einem eindeutigen `name` ist sie leicht zu finden.
- **Etwas mit einem eindeutigen Namen erstellen.** Auf eine DNS-Zone oder einen Container im Objektspeicher, deren Name bereits vergeben ist, antwortet die API mit `409`, ein Retry nach einem Timeout kann also keine zweite Ressource erstellen. Verstehen Sie das `409` als Zeichen dafür, dass das Original möglicherweise funktioniert hat.
- **Löschen.** Ein wiederholtes Löschen löscht nichts weiter, auch wenn der zweite Aufruf möglicherweise mit einem Fehler antwortet, weil die Ressource bereits weg ist. Lesen Sie die Ressource, um sicherzugehen.

Bei Lesezugriffen ist ein Retry immer in Ordnung.

## Nächste Schritte {#next-steps}

- [Konventionen](/docs/conventions) — Paginierung, Statuscodes, Fehlerformate und der Rest.
- [Rate-Limiting](/docs/rate-limiting) — wenn Retries auf ein 429 treffen: die andere Hälfte des Themas sichere Retries.
- [Fehler](/docs/errors) — das Fehlerformat und was jeder `error.code` bedeutet.
