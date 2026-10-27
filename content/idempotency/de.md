---
title: "Idempotenz"
description: "Ändernde Requests mit dem Header Idempotency-Key gefahrlos wiederholen."
publishedAt: 2026-05-20
updatedAt: 2026-10-05
kind: concept
---

# Idempotenz

Ein Request ist **idempotent**, wenn er zweimal gesendet dieselbe Wirkung hat wie einmal. `GET /v1/vms` ist von Natur aus idempotent — er ändert nichts. `POST /v1/vms` ist von Natur aus **nicht** idempotent — rufen Sie ihn zweimal auf, erhalten Sie zwei VMs.

Mit dem Header `Idempotency-Key` machen Sie jeden ändernden Request gefahrlos wiederholbar. Übergeben Sie einen beliebigen eindeutigen Wert (üblich ist eine UUID); wir speichern die Antwort 24 Stunden lang zwischen und geben bei jeder Wiederholung mit demselben Key dieselbe Antwort zurück.

## Welches Problem das löst {#problem}

Sie rufen `POST /v1/vms` auf. Auf dem Rückweg bricht die Netzwerkverbindung ab, und Sie erhalten ein Timeout statt eines 201. Wurde die VM erstellt? Sie wissen es nicht:

- Wenn Sie den Request wiederholen: Vielleicht haben Sie dann zwei VMs (das Original war erfolgreich; Ihr Retry hat eine zweite erstellt).
- Wenn Sie ihn nicht wiederholen: Vielleicht haben Sie dann null VMs (das Original ist fehlgeschlagen; Sie haben den falschen Zustand akzeptiert).

Mit einem Idempotency-Key ist der Retry sicher. War das Original erfolgreich, gibt der Retry dasselbe 201 mit derselben VM-ID zurück — kein Duplikat. Ist das Original fehlgeschlagen, erledigt der Retry die Arbeit tatsächlich.

## Header verwenden {#usage}

Senden Sie einen beliebigen String mit bis zu 255 Zeichen:

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web-01", "size": "gp-2-4", "region": "us-east-1", "image": "ubuntu-24.04" }'
```

Üblich ist eine UUID v4 pro logischer Operation. Generieren Sie sie einmal auf dem Client, speichern Sie sie, bevor Sie den Request senden, und verwenden Sie sie bei jedem Retry derselben logischen Operation wieder. Für die *nächste* logische Operation generieren Sie eine neue.

## Was als „derselbe Key“ gilt {#same-key}

Wir speichern die Antwort zwischen, zugeordnet zu:

1. dem Wert des Headers `Idempotency-Key`
2. dem API-Key, der den Request sendet
3. dem Endpoint (Methode + Pfad)

Zwei Requests teilen sich eine zwischengespeicherte Antwort also nur, wenn **alle drei übereinstimmen**. Das verhindert Unfälle — ein Key, der für zwei Endpoints, zwei API-Keys oder sogar zwei Projekte (verschiedene API-Keys) wiederverwendet wird, führt zu keiner Verwechslung.

## Was zwischengespeichert wird {#cached}

Wir speichern die **vollständige Antwort** zwischen — Statuscode, Header, Body. Eine Wiederholung mit demselben Key liefert eine byte-identische Ausgabe. Das ist wichtig für Clients, die Antworten per Fingerprint vergleichen, um „Hat sich das geändert?“ zu erkennen — sie bekommen eine konsistente Antwort.

Wir speichern auch **Fehler** zwischen. Wenn Ihr erster Aufruf an der Validierung gescheitert ist (`422 validation_error`), gibt der Retry dasselbe `422` zurück — keinen anderen Fehler, auch wenn Sie zwischen den Versuchen etwas korrigiert haben. Das ist richtig so: Idempotenz bedeutet „dieselbe Wirkung“, und die Wirkung des ersten Aufrufs war ein Fehlschlag. Wenn Sie einen neuen Versuch wollen, generieren Sie einen neuen Key.

Die Webhooks-API ist die Ausnahme: Sie speichert einen Key nur, wenn ein Publish erfolgreich ist. Siehe [Bei der Webhooks-API](#webhooks).

Die TTL des Caches beträgt **24 Stunden** ab der ersten Verwendung. Danach wird ein Request mit demselben Key als neuer Request behandelt.

## Wann Sie ihn verwenden {#when}

| Art des Endpoints | Verwenden? |
| --- | --- |
| `POST`, der eine Ressource erstellt (`POST /v1/vms`) | Ja |
| `PUT`, der eine Ressource ersetzt (`PUT /v1/vms/{id}`) | Ja |
| `PATCH`, der eine Ressource aktualisiert | Ja |
| `DELETE` | Ja |
| `GET`, `HEAD`, `OPTIONS` | Nein — bereits von Natur aus idempotent |
| `POST`, der eine einmalige Operation auslöst (z. B. `POST /v1/vms/{id}/reboot`) | Ja — zweimal neu starten ist etwas anderes als einmal |

In der Praxis: Jeder ändernde Request, der unterwegs fehlschlagen kann, profitiert von einem Key. Die Kosten sind ein Header pro Request und ein Schritt zum Generieren einer UUID auf Ihrer Seite.

## Konflikt mit einer früheren Verwendung {#conflicts}

Wenn Sie einen Key mit einem **anderen Request-Body** am selben Endpoint wiederverwenden, erhalten Sie `409 Conflict` mit `error.code: 'conflict'`, und `error.message` sagt, dass der Key bereits mit einem anderen Request-Body verwendet wurde. Der ursprüngliche Request bleibt bestehen; Ihr abweichender Body wird abgelehnt. Das ist das sicherste Verhalten — die alte Antwort stillschweigend zurückzugeben, würde einen Bug in Ihrer Retry-Schleife verdecken.

Wenn Sie tatsächlich einen anderen Request senden müssen, generieren Sie einen neuen Key.

Frühere Versionen dieser Seite gaben an, diese Antwort trage `error.code: 'idempotency_key_reused'`. Diesen Code hat die API nie gesendet; sie sendet `conflict`. `conflict` deckt auch andere Kollisionen mit bestehendem Zustand ab, etwa einen bereits vergebenen Namen; bei der Webhooks-API ist `details.reason` in diesem Fall `idempotency_key_reuse`. Siehe [Fehler](/docs/errors#codes-state).

## Bei der Webhooks-API {#webhooks}

Bei der Webhooks-API gilt `Idempotency-Key` für das Veröffentlichen eines Events (`POST /v1/events`) und verhält sich so:

| Sie senden | Sie erhalten |
| --- | --- |
| Einen neuen Key | `201` und das neue Event, verteilt an die passenden Endpoints. |
| Denselben Key und denselben Body | `200`, das **ursprüngliche** Event und den Header `Idempotency-Replayed: true`. Nichts wird erneut verteilt. |
| Denselben Key und einen anderen Body | `409` mit `error.code: 'conflict'`, `details.reason: 'idempotency_key_reuse'` und dem Key in `details.idempotency_key`. Das ursprüngliche Event bleibt bestehen. |
| Denselben Key nach einem fehlgeschlagenen Request | Der Request wird erneut ausgeführt. Ein fehlgeschlagener Publish (ein Validierungsfehler, ein Kontingentfehler, ein Rate-Limit) speichert den Key nicht. |

„Derselbe Body“ bedeutet derselbe Event-Typ und dieselbe Payload für dasselbe Projekt. Ein Key gehört zu Ihrem Workspace und Projekt, nicht zu dem API-Key, der ihn gesendet hat; zwei API-Keys, die in dasselbe Projekt veröffentlichen, teilen sich also die Keys. Ein Key wird mindestens 24 Stunden lang aufbewahrt.

## Wann Sie darauf verzichten können {#skip}

Ohne Key gilt `best-effort retry`. Für Lesezugriffe ist das in Ordnung; für Schreibzugriffe, bei denen Sie „vielleicht nichts, vielleicht eins“ verkraften (auf Anwendungsebene idempotente Operationen), ebenfalls. Der Header kostet nichts — aber wenn Ihre Anwendung bei Fehlern keinen Retry macht, merken Sie keinen Unterschied.

Die Fälle, in denen Sie wirklich einen Key wollen:

- Alles, was mit Abrechnung zu tun hat (Sie wollen eine Karte nicht zweimal belasten)
- Alles, was Nutzer sehen (Sie wollen eine Benachrichtigung nicht zweimal senden)
- Jeder Schritt in einem Workflow, der bei einem Fehler Ressourcen bereitstellt (Sie wollen keine verwaisten Ressourcen)

## Nächste Schritte {#next-steps}

- [Konventionen](/docs/conventions) — Paginierung, Statuscodes, Fehlerformate und der Rest.
- [Rate-Limiting](/docs/rate-limiting) — wenn Retries auf ein 429 treffen: die andere Hälfte des Themas sichere Retries.
- [Fehler](/docs/errors) — das Fehlerformat und was jeder `error.code` bedeutet.
