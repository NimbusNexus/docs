---
title: "Versionierungsrichtlinie"
description: "Wie wir die API weiterentwickeln, ohne dass Ihr Code bricht."
publishedAt: 2026-05-20
updatedAt: 2026-10-15
kind: concept
---

# Versionierungsrichtlinie

Die NimbusNexus-API ist auf **v1** und bleibt auf unbestimmte Zeit auf v1. Inkompatible Änderungen erscheinen nicht auf v1 — sie kämen hinter einer neuen Version (`v2` usw.), und v1 würde unverändert weiter funktionieren. Das ist dieselbe Haltung zur Versionierung, die Stripe, Twilio und AWS bei ihren wichtigsten APIs einnehmen.

## Was eine inkompatible Änderung ist {#breaking}

Alles, wodurch bestehender Code aufhören könnte zu funktionieren:

- Einen Endpoint entfernen
- Ein Feld aus einer Antwort entfernen
- Einen Statuscode aus den möglichen Antworten eines Endpoints entfernen
- Ein Feld umbenennen
- Den Typ eines Felds ändern (z. B. `string` → `number`)
- Das Standardverhalten eines bestehenden Endpoints ändern
- Die Validierung von Requests verschärfen (ein Body, der früher akzeptiert wurde, wird jetzt abgelehnt)
- Einen neuen Pflichtparameter für Requests hinzufügen

Das passiert auf `v1` nie. Punkt.

> **Aktualisiert am 15.10.2026.** Vor dem Start von v1 wurden Fehlerschreibweisen, deren Umbenennung bereits lief, und einige damit verbundene Änderungen ohne die unten beschriebene Frist von 12 Monaten umgesetzt. Bei Inboxes: `invalid_request`, das `unauthorized`, das die API für einen Key sendete, den sie nicht erkennt oder nicht verifizieren kann, ihr bloßes `error`, der Grund `project` bei `forbidden` sowie die Felder `max_inboxes`, `max_http_bins`, `monthly_messages`, `plan` und `inbox_id` in `details`. Bei Webhooks: `internal`, `unprocessable` und `plan_violation`, das `402`, das die API für `max_attempts` über der Obergrenze des Tarifs sendete, und ihr `409` beim Bulk-Replay (beide jetzt ein `422`) sowie ihre `details` und Eintragstypen bei der Validierung. Außerdem wurden zwei Antwortfelder von Inboxes entfernt: `paid_plans_enabled` bei `GET /v1/plan`, das zu diesem Zeitpunkt für jeden Workspace `true` war, und `project_id` einer Inbox, das die API nicht mehr setzte. [Fehler](/docs/errors#renames) zeigt für jede Änderung an Fehlern, was vorher und was jetzt gilt. Ab dem Start von v1 richtet sich jede Änderung nach dieser Seite.

## Was eine additive Änderung ist {#additive}

Was wir auf `v1` ohne Vorankündigung ausliefern:

- Neue Endpoints
- Neue optionale Request-Parameter
- Neue Felder in Antworten (unbekannte Felder sollten Sie beim Parsen ignorieren)
- Neue Fehlercodes (unbekannte Werte von `error.code` sollten Sie wie die Statusklasse des Statuscodes behandeln)
- Neue Event-Typen für Webhooks
- Neue Enum-Werte (unbekannte Enum-Werte sollten Sie als opak behandeln)
- Neue Statuscodes aus der Statusklasse, die der Endpoint bereits zurückgibt

Additive Änderungen dokumentieren wir im [Changelog](/changelog), schalten sie aber nicht hinter ein Flag. Bestehender Code funktioniert weiter; neuer Code kann sie nutzen.

## Vorwärtskompatibilität — wie Sie Code schreiben, der Änderungen übersteht {#forward-compat}

Drei Regeln:

**1. Ignorieren Sie unbekannte Felder beim Parsen.** Ein neues Feld in einer Antwort sollte in Ihrem Client kein Fehler sein. Die meisten JSON-Bibliotheken verhalten sich standardmäßig so.

```ts
// Correct
const { id, name, state } = await res.json()

// Wrong (will reject responses with new fields)
const allowedKeys = ['id', 'name', 'state']
for (const k of Object.keys(json)) {
  if (!allowedKeys.includes(k)) throw new Error('unknown field')
}
```

**2. Behandeln Sie unbekannte Enum-Werte als opak.** Wenn Sie nach `state` verzweigen, behandeln Sie die bekannten Werte; bei unbekannten zeigen Sie den rohen String an und stürzen nicht ab.

```ts
switch (vm.state) {
  case 'running': return 'green'
  case 'stopped': return 'gray'
  case 'provisioning': return 'amber'
  default: return 'gray' // Don't throw, don't assume — we may add 'migrating'
}
```

**3. Verzweigen Sie nach `error.code`, nicht nach `status`.** Statuscodes gruppieren Fehler (`4xx` vs. `5xx`); `error.code` unterscheidet sie. Wir können bestehenden Statuscodes neue Codes hinzufügen; Ihr Code sollte unbekannte Codes in einem Default-Zweig behandeln, statt sie als fatale Bugs zu werten.

## Abkündigungsrichtlinie {#deprecation}

Wir bemühen uns sehr, das auf v1 nicht zu brauchen. Falls wir doch einmal einen Endpoint oder ein Feld als veraltet markieren, gilt:

- Der Endpoint oder das Feld funktioniert **mindestens 12 Monate** lang unverändert weiter
- Antworten erhalten einen Header `Deprecation` (RFC 9745)
- Ein Header `Sunset` enthält das End-of-Life-Datum
- Das Dashboard zeigt pro Projekt die Nutzung veralteter Endpoints an

Zwölf Monate sind eine lange Zeit. In der Praxis wurde auf v1 seit dem Start noch nie etwas als veraltet markiert — additive Weiterentwicklung deckt die meisten Bedürfnisse ab.

## Wenn v2 erscheint {#v2}

Falls wir jemals v2 veröffentlichen (was wir in nächster Zeit nicht vorhaben), sähe der Rollout so aus:

- v2 startet unter `/v2/...` neben `/v1/...` — beide laufen parallel
- v1 erhält mindestens 24 Monate lang weiterhin Bugfixes und neue Funktionen (additiv)
- v2 hat eine eigene Basis-URL (`{{API_BASE_URL}}/v2/...`), sodass schon die URL die Version anzeigt

Sie würden migrieren, wenn Sie bereit sind, nicht wenn Sie dazu gezwungen werden. Der Weg: In neuem Code die Endpoints unter `/v2` verwenden und alten Code in Ihrem eigenen Tempo migrieren — es gibt keinen Stichtags-Cutover.

## Warum das wichtig ist {#why}

Eine Cloud-Plattform, deren API alle zwei Jahre bricht, ist keine vertrauenswürdige Infrastruktur. Der Grund, warum v1 die meisten anderen Verträge der Plattform überdauern wird: Kundencode, Partnerintegrationen und die Verteilung der SDKs hängen alle davon ab, dass diese Schnittstelle stabil bleibt. Sie ohne Vorwarnung zu brechen, wäre der schnellste Weg, Vertrauen zu verlieren.

Wenn Sie jemals eine tatsächliche inkompatible Änderung auf `v1` sehen, die nicht hinter einer neuen Version kam: Das ist ein Bug. Melden Sie ihn dem Support, und wir beheben ihn.

## Nächste Schritte {#next-steps}

- [Changelog](/changelog) — das fortlaufende Protokoll der additiven Änderungen.
- [Authentifizierung](/docs/authentication) — die stabilste Schnittstelle der API.
- [Konventionen](/docs/conventions) — Aufbau von Requests, Statuscodes, Fehlerklassen.
