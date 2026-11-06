---
title: "Rate-Limiting"
description: "Was jede API begrenzt, mit welchen Headern und Fehlern ein Limit antwortet, und die richtige Backoff-Strategie."
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: concept
---

# Rate-Limiting

Die Infrastruktur-API begrenzt, wie viele Requests sie pro Minute annimmt. Die APIs der Apps begrenzen bestimmte Aktionen, etwa das Veröffentlichen eines Events. In beiden Fällen antwortet ein Request über einem Limit mit `429`, meist mit einem Header `Retry-After`, der angibt, wie viele Sekunden Sie warten sollen.

## Die Infrastruktur-API {#defaults}

Jeder Request an `{{API_HOST}}` zählt gegen ein Budget pro Minute:

| Wer aufruft | Requests pro Minute | Gezählt pro |
|---|---|---|
| Eine angemeldete Sitzung (`Authorization: Bearer` oder das Sitzungs-Cookie) | 120 | Benutzer |
| Ein API-Key oder kein Credential | 60 | IP-Adresse |

Ein API-Key hat kein eigenes Budget. Keys, die von einer Adresse aus verwendet werden, teilen sich deren 60 Requests pro Minute, zusammen mit allem anderen, was von dort aufruft. Für `GET /api/v1/notifications/list` gilt ein niedrigeres Limit von 30 pro Minute, gemessen an derselben Zählung.

Die Minute beginnt mit Ihrem ersten Request und ist kein gleitendes Fenster: Wenn sie endet, beginnt die Zählung wieder bei null.

## Response-Header {#headers}

Antworten der Infrastruktur-API tragen das Limit, das gegolten hat, und was davon noch übrig ist:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
```

Über dem Limit lautet die Antwort `429`, mit `X-RateLimit-Remaining: 0` und einem Header `Retry-After`, der in Sekunden angibt, was von der Minute noch übrig ist:

```json
{
  "success": false,
  "message": "Too many requests. Please try again later."
}
```

## Die APIs der Apps {#apps}

Die APIs der Apps senden keine Header `X-RateLimit` und begrenzen nicht jeden Request. Was über einem ihrer Limits liegt, lehnen sie mit `429` `rate_limited` ab, wie unter [Fehler](/docs/errors#codes-rate) beschrieben:

- **Webhooks:** Das Veröffentlichen (`POST /v1/events`) läuft mit der Publish-Rate Ihres Tarifs, pro Workspace. Erneutes Zustellen und erneutes Abspielen (`POST /v1/deliveries/{delivery_id}/redeliver`, `POST /v1/deliveries/redeliver`, `POST /v1/deliveries/replay` und `POST /v1/events/{event_id}/replay`) laufen mit derselben Rate, aber mit einer eigenen Zählung. Eingehende Events an `POST /v1/ingest/{source_id}` sind auf 600 pro Minute und Quelle begrenzt, danach auf die Publish-Rate Ihres Tarifs ([Was der Anbieter sieht](/docs/product-webhooks/sources#responses)). Das Speichern und Testen von Skripten ist auf 60 pro Minute und Workspace begrenzt ([Transformationen](/docs/product-webhooks/transformations#errors)).
- **Inboxes:** Jede Inbox nimmt Mail bis zu einem Limit pro Minute an, das Ihr Tarif festlegt ([Limits nach Tarif](/docs/product-inboxes#limits)).
- **Request Bins:** Ein Bin kann 10 Tests pro Minute an seine Weiterleitungs-URL senden ([Weiterleitungs-URL testen](/docs/product-bins/reference#forward-test)). Eine Bin-URL nimmt 120 Requests pro Minute von einem Absender an und insgesamt 600 pro Minute ([Was eine Bin-URL antwortet](/docs/product-bins/reference#edge-answers)).
- **Transforms:** Ausführungen und Tests teilen sich das Limit Ihres Tarifs für Ausführungen pro Minute, pro Workspace ([Tarife und Limits](/docs/product-transforms/reference#limits)).
- **QR-Codes:** Ein Workspace kann 10 Webhook-Tests pro Minute senden.

## Backoff-Strategie {#backoff}

Das richtige Muster, wenn Sie ein `429` erhalten:

```ts
async function callWithBackoff(fn: () => Promise<Response>) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fn()
    if (res.status !== 429) return res

    const retryAfter = Number(res.headers.get('Retry-After') ?? '1')
    // Jitter prevents the thundering-herd problem if many clients
    // hit the limit at the same moment and all retry exactly together
    const jitter = Math.random() * 0.5 * retryAfter
    await new Promise(r => setTimeout(r, (retryAfter + jitter) * 1000))
  }
  throw new Error('Rate limit exceeded after 5 retries')
}
```

Zwei Hinweise:

- **Halten Sie sich immer an `Retry-After`.** Wiederholen Sie nicht früher: Sie erhalten nur ein weiteres `429`.
- **Fügen Sie Jitter hinzu**, wenn Sie aus mehreren Workern aufrufen. Ohne Jitter wiederholen alle Worker im selben Takt und stoßen gemeinsam erneut an das Limit.

## Was als Request zählt {#counted}

Bei der Infrastruktur-API zählt jeder HTTP-Aufruf, einschließlich:

- Requests mit `GET`, etwa `GET /api/v1/instance/`
- Jede Seite einer [paginierten Liste](/docs/pagination) und jede Abfrage, während Sie darauf warten, dass eine VM `ACTIVE` erreicht
- Aufrufe, die fehlschlagen, etwa mit einem `401`, und die `429` selbst

Um von einer Adresse aus unter dem Limit zu bleiben, verteilen Sie die Arbeit: Fragen Sie seltener ab, und listen Sie nichts auf, was Sie einmal lesen und behalten könnten.

## Limits erhöhen {#raising}

Kein API-Aufruf und keine Tarifeinstellung erhöht diese Limits. Wenn Ihr Limit einem echten Workload im Weg steht, [kontaktieren Sie den Support]({{BASE_URL}}/contact/support).

## Nächste Schritte {#next-steps}

- [Konventionen](/docs/conventions) — Aufbau von Requests, Statuscodes, die übergreifenden Muster der API.
- [Idempotenz](/docs/idempotency) — wie Sie einen Schreibzugriff gefahrlos wiederholen.
- [Kontingente](/docs/api/quotas) — die Limits für *Ressourcen* (VMs, vCPU, Speicher), im Unterschied zu Limits für die Request-Rate.
