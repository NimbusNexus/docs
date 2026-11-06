---
title: "Paginierung"
description: "Wie jede API ihre Listen paginiert, mit limit und offset oder marker, und woran Sie das Ende erkennen."
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: concept
---

# Paginierung

NimbusNexus hat zwei Arten von APIs, und sie paginieren Listen unterschiedlich. Die APIs der Apps paginieren mit `limit` und `offset`. Bei der Infrastruktur-API antworten die meisten Listen mit allen Einträgen auf einmal, und einige wenige nehmen `limit` zusammen mit `marker` oder `offset` entgegen.

## Die APIs der Apps {#shape}

Die meisten Listen bei Webhooks, Inboxes, Request Bins und Transforms nehmen zwei Query-Parameter entgegen:

- `limit` — Seitengröße. Standard 50, max. 200. Über 200 schlägt die Validierung des Requests fehl: `422` `validation_error` ([Fehler](/docs/errors#codes-validation)).
- `offset` — wie viele Einträge übersprungen werden. Standard 0, max. 10.000.

Jede Liste antwortet mit ihren Einträgen und dem nächsten Offset:

```json
{
  "items": [],
  "next_offset": 50
}
```

Geben Sie `next_offset` für die nächste Seite als `offset` zurück. Wenn der Wert `null` ist, sind Sie auf der letzten Seite.

Ein Offset zählt Positionen: Wird ein Eintrag erstellt oder gelöscht, während Sie eine Liste durchlaufen, sehen Sie möglicherweise einen anderen Eintrag doppelt oder verpassen einen. Wenn das wichtig ist, vergleichen Sie die IDs. Behalten Sie für den gesamten Durchlauf dieselben Filter bei, und beginnen Sie wieder bei Offset 0, wenn Sie sie ändern.

Zwei Fälle weichen davon ab:

- **Suchen** bei Inboxes und Request Bins paginieren stattdessen mit `next_until`; siehe [Nachrichten durchsuchen](/docs/product-inboxes#search) und [Erfasste Requests](/docs/product-bins/reference#requests).
- **QR-Codes** liefert die meisten Listen in einer einzigen Antwort. Die Scans eines Codes (`GET /v1/qr-tracked/codes/{code_id}/scans`) nehmen nur `limit` entgegen, und die Zustellungen eines Webhooks (`GET /v1/qr-tracked/webhooks/{webhook_id}/deliveries`) paginieren mit `limit` und `cursor`, wobei der nächste Cursor in `nextCursor` steht.

## Die Infrastruktur-API {#infrastructure}

Die meisten Listen, etwa `GET /api/v1/instance/`, antworten mit der gesamten Liste und nehmen keine Paginierungsparameter entgegen. Diejenigen, die paginieren, tun das auf eine von zwei Arten.

### `limit` und `marker` {#marker}

`marker` ist der letzte Eintrag, den Sie gesehen haben: seine ID oder, beim Objektspeicher, sein Name. Die Antwort beginnt danach.

- VM-Images: `GET /api/v1/image/`.
- DNS: `GET /api/v1/zones/`, `GET /api/v1/recordsets/`, `GET /api/v1/zones/{zone_id}/recordsets/`, `GET /api/v1/zones/{zone_id}/ptr/` und `GET /api/v1/zones/{zone_id}/shares/`.
- Objektspeicher: `GET /api/v1/object_storage/` für Container und `GET /api/v1/object_storage/{container_name}/objects` für Objekte. Bei Objekten liefert `full_listing=true` alle in einer Antwort.

Diese Antworten enthalten nur `data`, und nichts darin sagt, ob noch weitere Einträge folgen. Blättern Sie weiter, bis eine Seite kürzer ist als Ihr `limit`.

### `limit` und `offset` {#offset}

`offset` gibt an, wie viele Einträge übersprungen werden.

- Volume-Backups: `GET /api/v1/backup_restore/volume_backups/`, mit einem `limit` von standardmäßig 10.
- Backup-Zeitpläne: `GET /api/v1/backup_restore/backup_scheduler/list` und `GET /api/v1/backup_restore/volume_scheduler/list`.
- Externe Speicherverbindungen: `GET /api/v1/external/connections/`.
- Benachrichtigungen: `GET /api/v1/notifications/list`, mit einem `limit` von standardmäßig 50 und höchstens 200.

Diese Antworten tragen außerdem `total`, die Anzahl der Einträge über alle Seiten hinweg. Sie haben das Ende also erreicht, wenn Sie so viele gelesen haben.

## Seiten durchlaufen {#walking}

Folgen Sie bei einer API der Apps `next_offset`:

```ts
async function listAllEndpoints() {
  const all = []
  let offset = 0

  while (offset !== null) {
    const url = new URL('{{WEBHOOKS_BASE_URL}}/v1/endpoints')
    url.searchParams.set('limit', '200')
    url.searchParams.set('offset', String(offset))

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.WEBHOOKS_API_KEY}` },
    })
    const page = await res.json()

    all.push(...page.items)
    offset = page.next_offset
  }

  return all
}
```

Folgen Sie bei der Infrastruktur-API der letzten ID, bis eine kurze Seite kommt:

```ts
async function listAllZones() {
  const all = []
  const limit = 100
  let marker

  while (true) {
    const url = new URL('{{API_BASE_URL}}/api/v1/zones/')
    url.searchParams.set('limit', String(limit))
    if (marker) url.searchParams.set('marker', marker)

    const res = await fetch(url, {
      headers: { 'X-API-Key': process.env.NIMBUS_KEY },
    })
    const { data } = await res.json()

    all.push(...data)
    if (data.length < limit) return all
    marker = data.at(-1).id
  }
}
```

Jede Seite ist ein Request und zählt gegen das [Rate-Limit](/docs/rate-limiting).

## Sortierreihenfolge {#sort}

Sortierbare Listen nennen ihre Parameter auf ihren Referenzseiten. Bei der Infrastruktur-API sind das `sort_by` und `sort_desc` bei den sortierbaren `offset`-Listen und `sort_key` und `sort_dir` bei VM-Images und DNS-Record-Sets. Behalten Sie für den gesamten Durchlauf dieselbe Sortierung bei.

## Nächste Schritte {#next-steps}

- [Konventionen](/docs/conventions) — der Rest des Request-Aufbaus: IDs, Statuscodes, Fehler.
- [Rate-Limiting](/docs/rate-limiting) — wie viele Requests ein Durchlauf senden kann.
- [Fehler](/docs/errors) — womit ein abgelehnter Request antwortet.
