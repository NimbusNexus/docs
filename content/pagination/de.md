---
title: "Paginierung"
description: "Cursor-Paginierung auf jedem Listen-Endpoint. Stabil, wenn Einträge hinzukommen, ohne Offset-Drift."
publishedAt: 2026-05-20
updatedAt: 2026-10-15
kind: concept
---

# Paginierung

Listen-Endpoints (`GET /v1/vms`, `GET /v1/snapshots` usw.) paginieren mit opaken Cursors, nicht mit numerischen Offsets. Cursor-Paginierung ist der richtige Standard für Ressourcenlisten, die sich ändern, während Sie paginieren — sie liefert jeden Eintrag genau einmal, auch wenn zwischen dem Abruf zweier Seiten Zeilen eingefügt oder gelöscht werden.

## Aufbau {#shape}

Zwei Query-Parameter auf jedem Listen-Endpoint:

- `limit` — Seitengröße. Standard 50, max. 200. Über 200 schlägt die Validierung des Requests fehl: `422` `validation_error` ([Fehler](/docs/errors#codes-validation)).
- `cursor` — opaker Zeiger auf die nächste Seite. Lassen Sie ihn beim ersten Request weg.

Jede Listenantwort enthält:

```json
{
  "items": [ /* ... */ ],
  "pagination": {
    "next_cursor": "eyJpZCI6InZtXzAxSEc3Li4uIn0=",
    "total_count": null
  }
}
```

Wenn `next_cursor` `null` ist, haben Sie die letzte Seite erreicht.

## Seiten durchlaufen {#walking}

```ts
async function listAllVms(): Promise<VM[]> {
  const all: VM[] = []
  let cursor: string | undefined

  do {
    const url = new URL('{{API_BASE_URL}}/v1/vms')
    url.searchParams.set('limit', '200')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url, { headers: auth })
    const { items, pagination } = await res.json()

    all.push(...items)
    cursor = pagination.next_cursor ?? undefined
  } while (cursor)

  return all
}
```

Drei Regeln:

1. **Cursors sind opak.** Versuchen Sie nicht, sie zu parsen oder selbst zu bauen. Sie kodieren Sortierung + Filterzustand Ihres ursprünglichen Requests, daher funktioniert ein Cursor aus einer Abfrage nicht in einer anderen.
2. **Ändern Sie Filter nicht mitten in der Paginierung.** Wenn Sie mit `?status=running` beginnen und für Seite 2 `?region=us-east-1` hinzufügen, ist das Verhalten undefiniert. Beginnen Sie neu (ohne Cursor), wenn sich Filter ändern.
3. **Hören Sie auf, wenn `next_cursor` null ist.** Paginieren Sie nicht „sicherheitshalber“ weiter — der Cursor ist das einzige verbindliche Signal für das Listenende.

## Warum Cursors und nicht `?page=2&per_page=50` {#why-cursors}

Offset-Paginierung versagt in zwei realen Szenarien:

**Einfügungen während der Paginierung.** Wenn Sie Seite 1 abrufen (Einträge 1–50), dann jemand eine neue VM erstellt und Sie anschließend Seite 2 abrufen (Einträge 51–100), sehen Sie Eintrag 50 zweimal (er steht jetzt an Position 51) und den neuen Eintrag nie. Cursors halten fest, „wo Sie waren“ — die nächste Seite beginnt nach der Stelle, an der Sie tatsächlich waren, nicht an einem absoluten Offset.

**Löschungen während der Paginierung.** Dasselbe Problem umgekehrt: Wird eine VM zwischen zwei Seitenabrufen gelöscht, überspringt ein Client mit Offset-Paginierung einen Eintrag. Clients mit Cursor-Paginierung nicht.

Diese Randfälle spielen bei jeder nicht trivialen Größenordnung eine Rolle. Wir verwenden standardmäßig Cursor-Paginierung, damit sie Sie nicht treffen.

## `total_count` {#total-count}

Das Feld `total_count` in `pagination` ist **bei den meisten Endpoints null**, und zwar absichtlich. Alle Einträge einer paginierten Liste zu zählen, ist eine teure Abfrage, die mit wachsendem N weniger nützlich wird („Sie haben 14.328 VMs in all Ihren Projekten“ — was fangen Sie damit an?). Wenn `total_count` vorhanden ist, dokumentiert die Referenzseite des Endpoints das; wenn es fehlt, verlassen Sie sich nicht darauf.

Wenn Sie wirklich eine exakte Anzahl brauchen, paginieren Sie bis zum Ende und zählen, was Sie erhalten haben.

## Sortierreihenfolge {#sort}

Listen-Endpoints haben eine Standardsortierung (meist `created_at desc`, neueste zuerst), die pro Endpoint dokumentiert ist. Manche Endpoints akzeptieren `?sort=`, um sie zu überschreiben; die Referenzseite listet auf, was akzeptiert wird.

Der Cursor kodiert die Sortierung; `?sort=` zwischen zwei Seitenabrufen zu ändern, ist daher einer der Fälle mit „undefiniertem Verhalten“ — beginnen Sie neu, wenn Sie die Sortierung ändern.

## Filter {#filters}

Jeder Listen-Endpoint akzeptiert einige Standard-Filterparameter:

- `created_after` / `created_before` — Timestamps nach RFC 3339
- `updated_after` / `updated_before` — Timestamps nach RFC 3339
- Ressourcenspezifische Filter (z. B. `?region=us-east-1&state=running` bei VMs)

Filter lassen sich kombinieren; die Antwort ist die UND-Verknüpfung aller Filter. Die Referenzseite der Ressource dokumentiert, welche Filter sie akzeptiert.

## Wenn Sie wirklich alle Einträge brauchen {#listing}

Listen mit Paginierung in einer engen Schleife aufzurufen, um jede Ressource aufzuzählen, ist für Ad-hoc-Arbeit in Ordnung, für wiederholt laufende Daemons aber teuer. Zwei bessere Muster:

1. **Webhooks.** Abonnieren Sie die Events `resource.created` / `resource.deleted` und pflegen Sie Ihren eigenen Index. Siehe [Plattform-Webhooks](/docs/webhooks).
2. **Bulk-Export-Endpoints.** Für manche Ressourcen (Snapshots, Backups, Audit-Logs) gibt es einen eigenen Export-Endpoint, der den vollständigen Bestand in einer Antwort streamt. Die Referenzseite der Ressource dokumentiert diese, wo es sie gibt.

Das Paginierungsmuster ist für die interaktive Nutzung gedacht (eine Tabelle im Dashboard, ein List-Befehl der CLI). Bei kontinuierlicher Synchronisierung überwiegen die Kosten der Paginierung, und Webhooks sind die richtige Antwort.

## Nächste Schritte {#next-steps}

- [Konventionen](/docs/conventions) — der Rest des Request-Aufbaus (Statuscodes, Fehler, Idempotenz).
- [Plattform-Webhooks](/docs/webhooks) — die Push-basierte Alternative für kontinuierliche Synchronisierung.
- Die Referenzseite jedes Listen-Endpoints — Endpoint-spezifische Filter und Sortieroptionen.
