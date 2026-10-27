---
title: "Rate-Limiting"
description: "Request-Budgets pro Key, die Header, die wir zurückgeben, und die richtige Backoff-Strategie."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: concept
---

# Rate-Limiting

Jeder API-Key erhält ein Request-Budget pro Sekunde und pro Stunde. Die Limits schützen Sie und uns — sie verhindern, dass eine außer Kontrolle geratene Schleife Ihre Kreditkarte belastet, und dass ein einzelner Mandant eine Region auslastet.

## Die Standardwerte {#defaults}

| Tarif | Pro Sekunde | Pro Stunde |
| --- | --- | --- |
| Free | 5 | 1.000 |
| Starter | 25 | 10.000 |
| Production | 100 | 100.000 |
| Enterprise | Individuell | Individuell |

Diese gelten pro **API-Key**, nicht pro Projekt — wenn Sie drei Keys in einem Projekt haben, erhält jeder sein eigenes Budget. Die meisten Teams kommen nie in die Nähe des Limits im Tarif Production; wenn doch, zeigt das Panel „rate limit usage“ im Dashboard die Aufrufstellen, die das Kontingent am schnellsten verbrauchen.

## So funktioniert das Rate-Limiting {#mechanics}

Ein Token-Bucket pro Key. Der Bucket füllt sich mit der Rate pro Sekunde wieder auf; seine Größe ist so bemessen, dass sich das Budget nach einem kurzen Burst, der es aufbraucht, in ~10 Sekunden erholt. Das Stundenlimit ist eine harte Obergrenze — sobald Sie es erreichen, ist kein Request mehr erfolgreich, bis das gleitende Stundenfenster weiterrückt.

Limits werden am Gateway ausgewertet, bevor der Request den Handler der Ressource erreicht. Ein durch das Rate-Limit abgewiesener Request berührt die Ressourcen Ihres Projekts nie und kostet Sie daher nichts außer dem Logeintrag für den fehlgeschlagenen Request.

## Response-Header {#headers}

Jede API-Antwort trägt vier Header, die Ihr aktuelles Budget angeben:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1763410812
X-RateLimit-Window: 1
```

- `X-RateLimit-Limit` — Gesamtbudget für das aktuelle Fenster
- `X-RateLimit-Remaining` — verbleibende Requests
- `X-RateLimit-Reset` — Unix-Epoch-Zeitpunkt, zu dem sich das Budget wieder auffüllt (oder das Stundenfenster weiterrückt)
- `X-RateLimit-Window` — `1` für das Budget pro Sekunde, `3600` für das Budget pro Stunde. Wir zeigen jeweils das Budget, das Sie eher aufbrauchen

Wenn `Remaining` auf null fällt, gibt der nächste Request `429 Too Many Requests` zurück, mit einem Header `Retry-After` (in Sekunden), der angibt, wann Sie es erneut versuchen können.

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

- **Halten Sie sich immer an `Retry-After`.** Wiederholen Sie nicht früher — Sie stoßen sonst nur erneut an das Limit und verbrauchen Ihr Budget schneller.
- **Fügen Sie Jitter hinzu**, wenn Sie aus mehreren Workern aufrufen. Ohne Jitter wiederholen alle Ihre Worker im selben Takt und stoßen gemeinsam erneut an das Limit.

## Was als Request zählt {#counted}

Jeder HTTP-Aufruf an die API zählt als ein Request, einschließlich:

- Requests mit `GET` (ja, auch `GET /v1/regions`)
- Aufrufe zur Paginierung (jede Seite ist ein Request)
- Idempotente Retries (der Cache-Treffer zählt trotzdem als ein Request — er ist aber günstig, und durch die Deduplizierung zahlen Sie die zugrunde liegende Operation nicht doppelt)

Was **nicht** zählt:

- Statische Assets der Marketing-Website (CDN, nicht die API)
- Zustellungen von Webhooks an Sie (wir senden sie, nicht Sie)
- Fehlgeschlagene Verbindungsversuche (kein Logeintrag am Gateway)

## Limits erhöhen {#raising}

Die Tarife Starter und Production sind meist großzügig genug; weniger als 5 % der Konten erreichen je die Obergrenze pro Stunde. Wenn Sie sie erreichen, führt der Weg über das Support-Kontaktformular, nicht über die API — wie bei [Kontingenterhöhungen](/docs/api/quotas). Produktionsmigrationen werden noch am selben Tag bearbeitet.

Wenn Sie die Limits pro Sekunde erreichen, aber nicht die pro Stunde, brauchen Sie meist keine Erhöhung — Sie müssen die Last verteilen (Requests bündeln, Retries mit `Idempotency-Key` deduplizieren, mit sinnvollen Seitengrößen paginieren). Das Panel „rate limit usage“ im Dashboard schlüsselt auf, bei welchen Endpoints die Last sprunghaft steigt.

## Nächste Schritte {#next-steps}

- [Konventionen](/docs/conventions) — Aufbau von Requests, Statuscodes, die übergreifenden Muster der API.
- [Idempotenz](/docs/idempotency) — das Muster für sichere Retries, wenn Netzwerkfehler wie Rate-Limits aussehen.
- [Kontingente](/docs/api/quotas) — die Limits für *Ressourcen* (VMs, vCPU, Speicher), im Unterschied zu Limits für die Request-Rate.
