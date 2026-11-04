---
title: "Transformationen"
description: "Jede Zustellung filtern, kürzen, umformen oder mit Credentials versehen, bevor sie signiert und gesendet wird: mit einer Pipeline aus deklarativen Schritten in jedem Tarif oder mit einem JavaScript-Skript in bezahlten Tarifen."
publishedAt: 2026-10-30
updatedAt: 2026-11-03
kind: concept
---

# Transformationen

Eine Transformation ändert, was ein Endpoint erhält: Sie läuft für jedes Event, bevor wir es zustellen, und sendet stattdessen einen umgeformten Request oder gar nichts. Sie ist entweder eine **Pipeline** aus deklarativen Schritten, in jedem Tarif, oder ein JavaScript-**Skript**, in bezahlten Tarifen; was sie erzeugt, wird mit dem Secret des Endpoints signiert und wie jede andere Zustellung gesendet.

## Wofür sie gedacht ist {#what-for}

- **Ein Empfänger, der Credentials verlangt.** Ihre eigene API oder die eines Partners erwartet ein Bearer-Token, Basic Auth oder einen API-Key. Eine Pipeline fügt sie aus einem [Secret](#credentials) hinzu, das wir verschlüsselt speichern und nie wieder anzeigen.
- **Ein Empfänger, der sein eigenes Format will.** Slack, Discord und Microsoft Teams nehmen nur ihre eigenen Nachrichtenformate an und lehnen unseren Envelope ab; ein CRM will drei Felder, nach seinen eigenen Regeln benannt. Eine [Vorlage](#templates) oder ein `map`-Schritt baut diesen Body.
- **Nur bestimmte Events.** Ein [Abo](/docs/product-webhooks#objects) gleicht nur den Event-Typ ab. „Nur `invoice.paid` ab $1.000“ braucht die Payload, und die liest ein `filter`-Schritt.
- **Weniger Daten oder ein paar mehr.** Entfernen Sie personenbezogene Daten, bevor ein Analytics-Anbieter sie sieht, oder fügen Sie den Event-Typ in den Body oder in einen Header ein.

## Pipelines und Skripte {#kinds}

| | Pipeline | Skript |
|---|---|---|
| Was Sie schreiben | Bis zu 20 Schritte, im Formular der Konsole oder als JSON | Eine JavaScript-Funktion |
| Tarife | Jeder Tarif, Free eingeschlossen | Starter, Pro und Custom |
| Läuft | Direkt bei der Zustellung, mit festen Obergrenzen; es läuft kein Code von Ihnen | In einer eigenen Sandbox, mit einem Budget für CPU, Speicher und Zeit |
| Geeignet für | Credentials, Filter, Felder entfernen und hinzufügen, Umformen, Chat-Nachrichten | Logik, die sich mit den Schritten nicht ausdrücken lässt |

Eine Transformation ist das eine oder das andere, und ihre Art wird beim Anlegen festgelegt. Ein Endpoint führt höchstens eine Transformation aus; eine Transformation kann mehreren Endpoints ihres Projekts dienen.

In Free wird das Anlegen oder Testen eines Skripts mit `402 not_entitled` abgewiesen. Ein Workspace, der seinen bezahlten Tarif verlässt, behält seine Skripte und kann sie weiterhin umbenennen, pausieren, von Endpoints trennen und löschen, aber weder neuen Code speichern noch ein Skript testen oder fortsetzen; Zustellungen an einen Endpoint, der ein Skript ausführt, warten, bis der Tarif wieder Skripte enthält oder Sie das Skript vom Endpoint trennen. Pipelines laufen in jedem Tarif weiter.

Skripte sind auf einen eigenen Sandbox-Dienst angewiesen, Pipelines nicht. Solange Skripte ausgeschaltet sind, weist die Konsole darauf hin, `GET /v1/plan` meldet `transformations_available: false`, und Zustellungen an einen Endpoint, der ein Skript ausführt, warten. Kann die Sandbox ein Skript gerade nicht annehmen, antworten Speichern und Testen mit `503 unavailable`, und es wird nichts gespeichert; der Versuch einer Zustellung schlägt dann mit einer entsprechenden Meldung fehl und wird nach dem üblichen Zeitplan wiederholt.

`GET /v1/plan` zeigt außerdem, was Ihr Tarif enthält: `pipelines` ist in jedem Tarif `true`, und `transformations` ist `true`, wenn er Skripte enthält. Ausführungen beider Arten werden gezählt, nicht abgerechnet; `transformation_runs` ist die Zahl dieses Monats.

## Eine Pipeline {#pipeline}

Eine Pipeline ist ein JSON-Dokument. Diese hier sendet bezahlte Rechnungen ab $1.000, ohne die E-Mail-Adresse des Kunden und ohne jede Telefonnummer, mit dem Event-Typ im Body und einem Bearer-Token aus einem gespeicherten Secret:

```json
{
  "version": 1,
  "steps": [
    { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
    { "drop": ["data.customer.email", "**.phone"] },
    { "set": { "event_type": "{{ type }}" } },
    { "auth": { "type": "bearer", "secret": "sec_…" } }
  ]
}
```

`version` ist das Format des Dokuments, immer `1`, nicht die Version der Transformation. Die Schritte laufen in der Reihenfolge, in der sie stehen. Jeder ist ein Objekt mit einem Schritt-Schlüssel und optional einer `note` von bis zu 200 Zeichen, die die Konsole am Schritt anzeigt und die eine von einem Filter verworfene Zustellung festhält. Ein `filter` kann außerdem eine `action` haben.

Der erste Schritt sieht den Envelope, den wir sonst senden würden, mit `id`, `type`, `created_at`, `data` und `version`, und jeder weitere Schritt sieht den Body so, wie der vorige ihn hinterlassen hat. Ändert kein Schritt den Body, erhält der Empfänger die Bytes des Events unverändert. In der API und in Fehlertexten werden Schritte ab 0 gezählt, im Editor der Konsole ab 1.

| Schritt | In der Konsole | Was er tut |
|---|---|---|
| `filter` | **Filter** | Sendet das Event nur, wenn es passt, oder verwirft es mit `"action": "drop"`, wenn es passt. |
| `drop` | **Remove fields** | Entfernt Felder aus dem Body. |
| `set` | **Set fields** | Fügt Felder hinzu oder überschreibt sie. |
| `map` | **Reshape the body** | Ersetzt den Body durch einen, den Sie bauen. |
| `headers` | **Headers** | Setzt, entfernt oder benennt Header um. |
| `auth` | **Credential** | Fügt ein Bearer-Token, Basic Auth oder einen API-Key aus einem gespeicherten Secret hinzu. |

### `filter` {#step-filter}

Behält die Zustellung nur, wenn das Event passt; andernfalls wird die Zustellung [verworfen](#dropped), und es wird nichts gesendet. Mit `"action": "drop"` ist es umgekehrt: Was passt, wird verworfen.

```json
{ "filter": { "data": { "status": "paid", "amount": { "$gte": 100000 } } }, "note": "Paid, $1,000 or more" }
```

- Jeder Schlüssel ist eine Bedingung, und alle müssen erfüllt sein. Ein verschachteltes Objekt prüft nach Form, wie hier `data`.
- Ein einfacher Wert passt bei JSON-Gleichheit: `1` ist gleich `1.0`.
- Ein Array passt, wenn es dem Wert gleicht oder wenn eines seiner Elemente passt: `{"data": {"tags": "urgent"}}` gilt für `["billing", "urgent"]`, und `{"data": {"items": {"sku": "A-1", "qty": 2}}}` braucht ein Element mit beidem.
- Ein Feld, das dem Event fehlt, passt nur auf `{"$exists": false}` und auf Verneinungen wie `$neq`.
- Die Operatoren sind `$eq`, `$neq`, `$gt`, `$gte`, `$lt`, `$lte` (Zahlen mit Zahlen, Text mit Text; ISO-Zeitstempel werden nach der Zeit verglichen), `$in`, `$nin`, `$exists`, `$startsWith`, `$endsWith`, `$contains` (Text oder ein Array, das den Wert enthält) sowie `$and`, `$or` und `$not`, um Filter zu kombinieren.
- `$meta` prüft, wohin die Zustellung geht: `{"$meta": {"endpoint": {"id": "ep_3f9a…"}}}`.

### `drop` {#step-drop}

Entfernt Felder aus dem Body: eine Liste von 1 bis 50 Pfaden. `*` steht für genau eine Ebene und `**` für beliebig viele, sodass `**.email` jedes Feld `email` entfernt, wo immer es steht. Ein Pfad, der nichts trifft, ist kein Fehler.

```json
{ "drop": ["data.customer.email", "data.cards[*].number", "**.phone"] }
```

### `set` {#step-set}

Fügt Felder hinzu oder überschreibt sie: 1 bis 50 Paare aus einem Pfad und einem [Wert](#values). Fehlende Objekte auf dem Weg werden angelegt, und jeder Wert liest den Body so, wie der Schritt ihn vorgefunden hat. Ein Pfad, der auf einen Wert trifft, der kein Objekt ist, lässt die Ausführung mit `set_conflict` fehlschlagen.

```json
{ "set": { "event_type": "{{ type }}", "data.total_cents": { "$ref": "data.amount" } } }
```

### `map` {#step-map}

Ersetzt den Body durch einen [Wert](#values), den Sie schreiben, meist ein Objekt.

```json
{ "map": {
    "invoice_id": "{{ data.id }}",
    "amount": { "$ref": "data.amount" },
    "amount_display": "{{ data.amount | money(data.currency) }}",
    "event": "{{ type }}"
} }
```

Bei einem Event `invoice.paid`, dessen `data` `{"id": "in_42", "amount": 150000, "currency": "usd"}` ist, sendet dieser Schritt:

```json
{ "invoice_id": "in_42", "amount": 150000, "amount_display": "1,500.00 USD", "event": "invoice.paid" }
```

### `headers` {#step-headers}

Setzt Header mit `set`, entfernt sie mit `remove` und benennt sie mit `rename` um, in der Reihenfolge remove, rename, set. Namen passen unabhängig von Groß- und Kleinschreibung. Eine Pipeline beginnt ohne eigene Header: Die Custom-Header des Endpoints und unsere werden hinzugefügt, nachdem sie gelaufen ist, ein Header, den sie setzt, ersetzt einen gleichnamigen Custom-Header, und `remove` und `rename` erreichen nur Header, die frühere Schritte gesetzt haben.

```json
{ "headers": { "set": { "X-Event-Type": "{{ type }}", "Content-Type": "application/json" } } }
```

Eine Pipeline kann keinen Header setzen, den wir selbst senden, also weder einen Header `X-Webhook-*`, darunter die Signatur, noch `User-Agent`, und auch keinen, der zur Verbindung gehört, etwa `Host`, `Content-Length` oder `Expect`. `Content-Type` kann sie setzen, und er wird zum Content-Type der Zustellung. Ohne ihn wird die Zustellung als `application/json` gesendet.

### `auth` {#step-auth}

Fügt Credentials aus einem [gespeicherten Secret](#credentials) hinzu, das über seine ID angegeben wird:

| `type` | Fügt hinzu |
|---|---|
| `bearer` | `Authorization: Bearer` und das Secret. |
| `basic` | `Authorization: Basic`, aus einem `username` und dem Secret als Passwort. |
| `api_key`, `"in": "header"` | Das Secret im Header namens `name`, nach einem optionalen `prefix` wie `"Token "`. |
| `api_key`, `"in": "query"` | Das Secret als Query-Parameter `name` an der URL des Endpoints, nur für diesen Request. |

```json
{ "auth": { "type": "api_key", "in": "header", "name": "X-Api-Key", "secret": "sec_…" } }
```

Auth-Schritte stehen nach allen anderen Schritten, sodass kein Schritt die Credentials lesen, kopieren oder prüfen kann.

## Pfade und Werte {#values}

Ein Pfad benennt ein Feld des Bodys:

| Pfad | Benennt |
|---|---|
| `data.customer.email` | Ein Feld. |
| `data.items[0].sku` | Ein Element einer Liste. |
| `data['first name']` | Einen Schlüssel mit einem Leerzeichen, einem Punkt oder einer Klammer darin. |
| `data.items[*].sku` | Jedes Element; in einem Wert die Liste davon. |
| `**.email` | `email` in beliebiger Tiefe; nur in einem `drop`. |
| `$meta.endpoint.id` | Den Endpoint, an den die Zustellung geht, und `$meta.endpoint.description` seine Beschreibung; nur in einem Wert. |

`set` nimmt nur einfache Pfade, `drop` nimmt `*` und `**`, und ein Wert liest mit `*`, aber nicht mit `**`.

Ein Wert in `set`, `map` oder einem Header ist JSON und wird so übernommen, wie er geschrieben ist, mit zwei Ausnahmen:

- **`{{ path }}`** in einem String fügt einen Wert als Text ein. Ein fehlender Wert oder `null` fügt nichts ein, ein Objekt oder eine Liste wird als JSON eingefügt. `{{ 'text' }}` und `{{ 42 }}` sind Literale; ein wörtliches `{{` schreiben Sie daher als `{{ '{{' }}`.
- **`{"$ref": "path"}`** fügt den Wert selbst ein und behält seinen Typ: Eine Zahl bleibt eine Zahl, eine Liste eine Liste. Mit `"default"` geben Sie einen Wert für den Fall an, dass der Pfad fehlt.

Ein Ausdruck kann seinen Wert von links nach rechts durch Filter leiten: `{{ data.amount | money(data.currency) }}` ergibt `1,500.00 USD` für einen Betrag von 150000 in `usd`.

| Filter | Ergibt |
|---|---|
| `upper`, `lower` | Den Text in Groß- oder Kleinbuchstaben. |
| `default(x)` | `x`, wenn der Wert fehlt, `null` oder leer ist. |
| `truncate(n)` | Höchstens `n` Zeichen, danach `…`. |
| `join(sep)` | Eine Liste als Text, verbunden mit `", "`, sofern Sie kein `sep` angeben. |
| `length` | Die Zahl der Elemente, Schlüssel oder Zeichen. |
| `json`, `json(indent)` | Den Wert als kompaktes JSON oder mit 1 bis 8 Leerzeichen eingerückt. |
| `number(digits)` | Eine Zahl mit so vielen Nachkommastellen. |
| `money(currency)` | Einen Betrag in der kleinsten Währungseinheit, formatiert; Währungen ohne oder mit drei Nachkommastellen eingeschlossen. |
| `date(format)` | Einen Zeitpunkt nach ISO 8601 oder in Epoch-Sekunden, in UTC, mit `%Y`, `%m`, `%d`, `%H`, `%M`, `%S` und weiteren. |
| `escape(target)` | Text, der eine Chat-Nachricht nicht formatieren kann: `slack` (Standard), `discord` oder `markdown`. |
| `code(target, max, language)` | Text als Codeblock in der Auszeichnung von `slack`, `discord` oder `markdown`, den der Text nicht vorzeitig beenden kann, auf `max` Zeichen gekürzt. |

Es gibt keine Schleifen, Bedingungen oder Rechenoperationen: Eine Bedingung ist ein `filter`-Schritt, und eine Liste wird mit `[*]` und `join` zu Text.

## Vorlagen {#templates}

Die Galerie enthält fertige Pipelines als Ausgangspunkt. In der Konsole stehen sie unter **Start from a template**, unterhalb der Schritte: **Use Slack message** oder die Schaltfläche einer anderen Vorlage übernimmt deren Schritte in den Editor, nach einer Rückfrage, falls sie Ihre ersetzen würden. Über die API liefert `GET /v1/transformations/templates` jede Vorlage mit ihrer `pipeline`.

| Vorlage | Was sie sendet |
|---|---|
| **Slack message** | Für einen Incoming Webhook von Slack: den Typ des Events als Überschrift, seine ID und Uhrzeit und seine Daten als Codeblock. |
| **Discord message** | Für den Webhook eines Discord-Kanals: ein Embed mit dem Typ des Events, seinen Daten als Codeblock sowie ID und Uhrzeit. Sie erwähnt niemanden. |
| **Microsoft Teams card** | Für einen Workflow-Webhook in Teams: eine Adaptive Card mit dem Typ des Events, seiner ID und Uhrzeit und seinen Daten in Festbreitenschrift. |
| **Keep only these fields** | `id`, `type`, `created_at` und `version` des Events und nur die Felder von `data`, die ihr `map` aufführt, anfangs `data.id`. Ein aufgeführtes Feld, das dem Event fehlt, wird als `null` gesendet. |
| **Drop personal data** | Das Event ohne `email`, `phone`, `first_name`, `last_name`, `address`, `billing_address`, `shipping_address`, `date_of_birth` und `ip_address`, in beliebiger Tiefe. Ein einfaches `name` bleibt, weil es oft einen Tarif oder ein Produkt benennt. |

Wenn Sie eine Vorlage speichern, entsteht eine Pipeline, die Ihnen gehört: Ändern Sie sie wie jede andere; nichts verweist auf die Vorlage zurück. Jede Chat-Vorlage besteht aus einem `map`-Schritt und einem `headers`-Schritt, der `Content-Type: application/json` setzt, und funktioniert mit jedem Event. Ein fehlender Typ erscheint als „Event“ und eine fehlende ID oder Uhrzeit als „—“, die Daten werden auf die Limits der App gekürzt, und nichts im Event kann die Nachricht formatieren, jemanden erwähnen oder den Codeblock vorzeitig beenden.

Slack, Discord und Teams können die [Challenge der Verifizierung](/docs/product-webhooks/endpoint-verification#cannot-echo) nicht beantworten. Ein Endpoint, der auf einen von ihnen zielt, braucht daher für sein Projekt ausgeschaltete Verifizierung; ausschalten lässt sie sich in bezahlten Tarifen.

**Presets sind jetzt Vorlagen.** Ein Endpoint, der bereits ein Preset ausführt, also ein Skript, führt es unverändert weiter aus, und nur ein solcher Endpoint bietet noch **Preset** zur Auswahl an. Die gleichnamige Vorlage erledigt dieselbe Aufgabe ohne Skript, in jedem Tarif.

## Credentials {#credentials}

Ein `auth`-Schritt gibt ein Secret über seine ID an (`sec_…`), nie über seinen Wert. Ein Secret gehört zu einem Projekt, wie eine Transformation, und nur die Pipelines dieses Projekts können es angeben. Sein Wert wird verschlüsselt gespeichert und nie wieder herausgegeben: Die API listet Secrets mit Name und ID auf, eine abgerufene Pipeline enthält nur die ID, ein Test zeigt die Credentials als `••••`, und eine Zustellung behält nur die Namen der Header und Query-Parameter, die sie hinzugefügt hat.

In der Konsole listet **Secret** in einem Schritt **Credential** die Secrets des Projekts auf. Für ein neues wählen Sie **New secret…**, füllen **Secret name** und **Secret value** aus und wählen **Save secret**.

Über die API, mit dem Wert aus einer Umgebungsvariable:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/secrets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": \"prj_…\", \"name\": \"CRM token\", \"value\": \"$CRM_TOKEN\"}"
```

```json
{ "id": "sec_…", "project_id": "prj_…", "name": "CRM token", "transformation_count": 0, "created_at": "…", "updated_at": "…" }
```

`PATCH /v1/secrets/{id}` benennt ein Secret um oder ersetzt seinen Wert; jede Pipeline, die es angibt, sendet ab dem nächsten Versuch den neuen Wert, auch bei Retries früherer Zustellungen. `DELETE /v1/secrets/{id}` wird mit `409 secret_in_use` abgewiesen, solange die aktuelle Version einer Pipeline das Secret angibt. Die Konsole legt Secrets nur an; umbenennen, ersetzen und löschen Sie sie über die API.

## Skripte {#script}

Ein Skript ist eine einzelne Funktion namens `transform`, in Starter, Pro und Custom:

```js
function transform(event, context) {
  // event:   { id, type, created_at, data, version }, the envelope we would otherwise send
  // context: { endpoint: { id, description }, attempt }
  if (event.type !== "invoice.paid") return null; // send nothing
  return {
    body: { text: `Invoice ${event.data.id} paid` },
    headers: { "X-Team": "billing" },
  };
}
```

Sie gibt den Request zurück, der gesendet werden soll, oder `null`, damit nichts gesendet wird. Ein `body`, der ein Objekt oder eine Liste ist, wird als JSON gesendet, ein String unverändert als `text/plain; charset=utf-8`. `contentType` setzt einen anderen Content-Type, anstelle eines Headers `Content-Type`, und `headers` fügt Header hinzu, für die die Regeln der Custom-Header eines Endpoints gelten. URL und Methode bleiben die des Endpoints. Was das Skript mit `console.log` ausgibt, wird mit der Zustellung aufbewahrt, bis zu 4 KiB.

Das Skript ist schlichtes JavaScript in einer einzigen Datei, ohne Netzwerkzugriff, Dateisystem, Timer und Importe; eine Bibliothek, die es braucht, muss daher in das Skript gebündelt werden. Beim Speichern laden wir es zuerst in der Sandbox, ohne es aufzurufen: Ein Syntaxfehler, eine fehlende Funktion `transform` oder Code auf oberster Ebene, der fehlschlägt, wird mit `422 invalid_transformation` abgewiesen, und es wird nichts gespeichert.

## Testen {#test}

**Test** unterhalb des Editors führt aus, was im Editor steht, ob gespeichert oder nicht, mit **A recent event** aus den letzten Zustellungen des Endpoints oder mit **An event you paste**. Wählen Sie **Run test**: Es wird nichts gesendet und nichts gespeichert. Eine Pipeline läuft mit den Secrets ihres Projekts, und das Ergebnis zeigt alle Credentials als `••••`. Das Ergebnis ist eines davon:

- **Would send**: Content-Type, Größe, Header und Body, die der Empfänger erhalten würde.
- **Would send nothing**: Ein Filter hat die Zustellung beim angezeigten Schritt verworfen, oder das Skript hat `null` zurückgegeben.
- **Failed**: warum, und bei einer Pipeline, bei welchem Schritt.

Über die API senden Sie die Pipeline oder den `code` eines Skripts zusammen mit einem Event:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations/test \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "prj_…",
       "pipeline": {"version": 1, "steps": [
         {"map": {"text": "{{ type }}: {{ data.id }}"}},
         {"auth": {"type": "bearer", "secret": "sec_…"}}]},
       "event": {"id": "evt_1", "type": "invoice.paid", "created_at": "2026-11-03T10:00:00Z", "data": {"id": "in_42"}, "version": "1"}}'
```

```json
{ "status": "ok", "body": "{\"text\":\"invoice.paid: in_42\"}", "content_type": null, "headers": { "Authorization": "Bearer ••••" }, "logs": "", "reason": null, "error": null, "fuel": 0, "duration_ms": 0.2, "query": {}, "step": null }
```

`status` ist `ok`, `dropped` oder `failed`. Beim Verwerfen oder bei einem Fehlschlag ist `step` der Schritt, ab 0 gezählt; `reason` ist das Kennwort, etwa `no_match` (oder `matched` bei einem Filter mit `"action": "drop"`) oder `set_conflict`; und `error` sagt es in Worten, beim Verwerfen mit der Notiz des Filters. `content_type` ist `null`, sofern kein Schritt ihn gesetzt hat. Auch ein Test, der verwirft oder fehlschlägt, antwortet mit `200`; eine Pipeline, die nie laufen könnte, wird dagegen mit `422 invalid_pipeline` abgewiesen, wie beim Speichern.

Das Testen einer Pipeline funktioniert in jedem Tarif. Das Testen eines Skripts setzt einen Tarif mit Skripten voraus, teilt sich mit dem Speichern von Skripten ein Kontingent von 60 pro Minute und Workspace, mit Bursts von bis zu 10, und liefert zusätzlich `logs` und `fuel` des Skripts.

**Send test ping** an einem Endpoint sendet den festen Ping ohne die Transformation und damit auch ohne die Credentials einer Pipeline: Ein Empfänger, der sie prüft, weist ihn ab. Was Ihr Empfänger erhalten wird, zeigen **Test** und echte Events.

## Versionen und Pausieren {#versions}

Jedes Speichern einer geänderten Pipeline oder eines geänderten Skripts erzeugt die nächste Version; speichern Sie eine Fassung, die der aktuellen Version gleicht, entsteht keine neue. Die letzten 50 Versionen werden aufbewahrt, und jede Zustellung hält fest, welche Version sie geformt hat. In der Konsole listet **Versions** sie auf, und **Load into editor** lädt eine frühere in den Editor; wenn Sie sie speichern, wird sie zur neuesten Version. Über die API listet `GET /v1/transformations/{id}/versions` sie auf, die neueste zuerst, und `GET /v1/transformations/{id}/versions/{version}` liefert eine mit ihrer Pipeline oder ihrem Code.

**Pause** hält eine Transformation an, ohne sie von ihren Endpoints zu trennen, ebenso `PATCH /v1/transformations/{id}` mit `{"status": "disabled"}`. Die Zustellungen an ihre Endpoints warten, statt ohne Transformation gesendet zu werden: Sie erscheinen als `failed`, mit dem `last_error` „paused: the endpoint's transformation is not running“, und werden gesendet, sobald Sie die Transformation mit **Resume** fortsetzen (`{"status": "enabled"}`), und zwar mit der dann aktuellen Version. Pausieren und Fortsetzen einer Pipeline funktioniert in jedem Tarif.

## Mit einem Endpoint verknüpfen {#set-up}

Öffnen Sie in der Konsole auf der Seite **Endpoints** das Menü des Endpoints und wählen Sie **Transformation**, oder klicken Sie auf seinen Eintrag in der Spalte **Transformation**. Dann:

1. Wählen Sie **Pipeline** und bauen Sie sie auf: mit **Add a step**, ausgehend von einer Vorlage oder indem Sie unter **JSON** ein ganzes Dokument einfügen und **Apply JSON** wählen. Oder wählen Sie **Script** und schreiben Sie die Funktion.
2. [Testen Sie sie](#test).
3. Wählen Sie **Save**. Die nächsten Zustellungen des Endpoints durchlaufen sie.

**Off** und **Save** schalten sie nach einer Bestätigung aus, und die Zustellungen gehen wieder als Event-Envelope hinaus. Führt kein anderer Endpoint die Transformation aus, wird sie mit ihren Versionen gelöscht. Da sich die Art nicht ändern kann, speichert der Wechsel eines Endpoints von einem Skript zu einer Pipeline oder umgekehrt eine neue Transformation anstelle der alten und löscht die alte, wenn kein anderer Endpoint sie ausführt. Läuft eine Transformation auf mehreren Endpoints, ändert das Speichern sie für alle.

Über die API legen Sie die Transformation im Projekt des Endpoints an und verknüpfen den Endpoint dann mit ihr:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Paid invoices to the CRM", "project_id": "prj_…",
       "pipeline": {"version": 1, "steps": [
         {"filter": {"type": "invoice.paid"}, "note": "Paid invoices only"},
         {"drop": ["**.email"]},
         {"auth": {"type": "bearer", "secret": "sec_…"}}]}}'

curl -sX PATCH {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a… \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"transformation_id": "trf_…"}'
```

Ein Skript nimmt `code` anstelle von `pipeline`; beides oder keines von beiden zu senden, wird abgewiesen. Um das Dokument später zu ändern, senden Sie `PATCH /v1/transformations/{id}` mit einer neuen `pipeline`. Hat die neue Version einen `auth`-Schritt und führen Endpoints die Transformation aus, muss der `PATCH` außerdem `confirm_destinations` enthalten: die URL jedes dieser Endpoints, wie sie `destinations` der Transformation auflistet, denn die Credentials gehen an alle. `POST /v1/endpoints` nimmt ebenfalls `transformation_id`, `{"transformation_id": null}` trennt die Transformation wieder vom Endpoint, und eine Transformation aus einem anderen Projekt wird als nicht gefunden abgewiesen. Anlegen, Ändern und Testen von Transformationen und Secrets erfordert einen Key mit dem Scope `admin`; ein Key mit `read` kann sie auflisten und lesen. Eine Person braucht, anders als ein Key, außerdem die Rolle Owner oder Admin, um ein Secret zu hinterlegen oder zu ändern, eine Pipeline zu speichern, deren `auth`-Schritt auf eines verweist, oder eine solche Pipeline mit einem Endpoint zu verknüpfen.

## Was eine Zustellung zeigt {#deliveries}

Eine Transformation läuft einmal pro Zustellung, beim ersten Versuch. Was sie erzeugt hat, wird mit der Zustellung gespeichert, und jeder Retry sendet genau diesen Body erneut, neu signiert, mit den Headern des Endpoints, wie sie bei diesem Versuch sind. Die Credentials einer Pipeline werden nie gespeichert: Jeder Versuch fügt sie neu aus dem Wert hinzu, den das Secret in diesem Moment hat. Eine [erneute Zustellung](/docs/product-webhooks/deliveries#replay) führt die aktuelle Version der Transformation erneut aus.

Öffnen Sie in der Konsole eine Zustellung auf der Seite **Deliveries**. **Transformed by** nennt die Transformation und die Version, die gelaufen ist, und das Ergebnis ist eines davon:

- **Transformed**: Content-Type, Größe, die gesetzten Header, die Namen der hinzugefügten Credentials und der gesendete Body.
- **Dropped**: Ein Filter hat die Zustellung verworfen oder das Skript hat `null` zurückgegeben, daher wurde nichts gesendet.
- **Failed**: warum die Ausführung fehlgeschlagen ist. Die Zustellung liegt in der Dead-Letter-Queue.

Über die API liefert `GET /v1/deliveries/{id}/transform` die Ausführung oder `null`, wenn keine gelaufen ist: `transformation_id`, `version`, `status` (`ok`, `dropped` oder `failed`), `reason`, `error`, `body`, `content_type`, `header_names`, `credential_headers` und `credential_query` (Namen, nie Werte) sowie `duration_ms`. Die Ausführung eines Skripts hat zusätzlich `logs` und `fuel`.

### Verworfene Zustellungen {#dropped}

Wenn ein Filter eine Zustellung verwirft oder ein Skript `null` zurückgibt, wird nichts gesendet und kein Versuch unternommen. Die Zustellung endet im Status `sent` mit `"dropped": true`, die Konsole zeigt sie als **dropped**, und die Statistiken von Endpoint und Workspace zählen sie getrennt von den zugestellten: Eine Erfolgsquote wird über das berechnet, was gesendet werden sollte. Ein Verwerfen ist kein Fehlschlag, weder für den Endpoint noch für die Transformation. Auch auf das [monatliche Kontingent für Zustellungen](/docs/product-webhooks#objects) zählt eine verworfene Zustellung nicht: Das Kontingent zählt jede Zustellung, sobald ihr Event veröffentlicht wird, also bevor ein Filter oder Skript gelaufen ist, und zählt sie nicht mehr, sobald sie verworfen wird. Deshalb wird eine Veröffentlichung bei aufgebrauchtem Kontingent weiterhin abgelehnt, auch wenn ein Filter jede ihrer Zustellungen verwerfen würde.

## Wenn eine Ausführung fehlschlägt {#failures}

Eine Pipeline, die sich speichern ließ, kann bei einem bestimmten Event trotzdem fehlschlagen: ein `set`, das in einen Wert schreiben würde, der kein Objekt ist (`set_conflict`), ein Body oder ein Wert über seinem [Limit](#limits), ein Header-Wert, den ein Header nicht tragen kann, oder Credentials, deren Secret nicht mehr existiert (`secret_missing`) oder sich nicht senden lässt (`invalid_secret`). Dieselbe Pipeline schlägt beim selben Event auf dieselbe Weise fehl; die Zustellung geht daher ungesendet direkt in die Dead-Letter-Queue, mit einem `last_error` wie `pipeline_failed: step 2: set_conflict: …`.

Ein Skript schlägt fehl, wenn es eine Ausnahme wirft, sein Zeit- oder Speicherlimit überschreitet, zu tief rekursiert oder etwas zurückgibt, das kein Request ist (ein Objekt mit einem `body` oder `null`). Seine Zustellung geht in die Dead-Letter-Queue, mit einem `last_error`, das mit `transform_failed:` beginnt.

Das ursprüngliche Event senden wir stattdessen nie: Der Empfänger kann ein Dritter sein, von dem die Transformation Daten fernhalten soll.

Jede fehlgeschlagene Ausführung wird der Transformation angerechnet, so wie fehlgeschlagene Zustellungen einem Endpoint, und eine Ausführung, die sendet oder verwirft, beendet die Serie. Nach 20 Fehlschlägen in Folge wird die Transformation ausgeschaltet (**turned off after failures** in der Konsole, `auto_disabled` in der API), die Zustellungen an ihre Endpoints warten, und wir benachrichtigen den Owner des Workspaces per E-Mail und senden einen [Betriebs-Webhook](/docs/product-webhooks/deliveries#operational) `transformation.disabled`. Korrigieren Sie die Transformation, testen Sie sie und setzen Sie sie mit **Resume** fort, oder senden Sie `PATCH /v1/transformations/{id}` mit `{"status": "enabled"}`: Die wartenden Zustellungen werden gesendet, und die in der Dead-Letter-Queue lassen sich [erneut zustellen](/docs/product-webhooks/deliveries#replay).

## Limits {#limits}

Eine Pipeline hat keine Schleifen, keine Uhr und kein I/O; dieselbe Pipeline tut beim selben Event daher immer dasselbe, und feste Obergrenzen begrenzen jede Ausführung:

| Pipeline | Limit |
|---|---|
| Schritte | 20 |
| Pfade in einem `drop`, Felder in einem `set`, Namen in jedem Teil eines `headers`-Schritts | 50 |
| Die Einstellungen eines Schritts, als kompaktes JSON | 16 KiB |
| Die Notiz eines Schritts | 200 Zeichen |
| Verschachtelung, in einem Schritt und in einem Body | 32 Ebenen |
| Der Body, den ein Schritt liest, und der gesendete Body | 256 KiB |
| Ein Wert, den ein Schritt erzeugt | 64 KiB |
| Arbeit in einer Ausführung | 100.000 gelesene oder kopierte Werte, Text zählt einen pro KiB |
| Header am Ende einer Ausführung | 50 |
| Ein Header-Wert | 8 KiB |
| Der Wert eines Secrets | 4.096 Zeichen druckbares ASCII, ohne Leerzeichen am Anfang oder Ende |

| Skript | Limit |
|---|---|
| CPU | Etwa 50 ms Skriptzeit, in Instruktionen gezählt statt gemessen, sodass dasselbe Skript dasselbe Budget erhält, unabhängig davon, wie ausgelastet wir sind |
| Gesamtlaufzeit | 1 Sekunde |
| Speicher | 64 MiB |
| Skriptgröße | 1 MiB |
| Ausgabe | 256 KiB |
| Logs | 4 KiB |
| Gleichzeitig laufende Skripte pro Workspace | 2 in Starter, 4 in Pro; in Custom so viele wie in dem Tarif, auf dem der Vertrag aufbaut |

## Fehler {#errors}

Eine Pipeline, die nie laufen könnte, wird beim Speichern oder Testen mit `422 invalid_pipeline` abgewiesen. Die Ablehnung nennt das erste Problem: `details.reason`, `details.path` (ein JSON Pointer darauf) und `details.step` (ab 0 gezählt), jeweils sofern zutreffend.

```json
{ "error": { "code": "invalid_pipeline", "message": "…", "details": { "reason": "managed_header", "path": "/steps/0/headers/set/User-Agent", "step": 0 }, "request_id": "…" } }
```

| `reason` | Was nicht stimmt |
|---|---|
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
| `invalid_secret` | Das `secret` eines Auth-Schritts ist nicht die ID eines Secrets. Ein dort eingefügter Wert wird in keiner Meldung wiederholt. |
| `auth_not_last` | Ein Schritt steht nach einem Auth-Schritt. |
| `too_deep` | Etwas ist tiefer als 32 Ebenen verschachtelt. |
| `too_large` | Die Einstellungen eines Schritts sind größer als 16 KiB. |
| `not_json` | Es enthält einen Wert, der kein JSON ist. |
| `managed_header` | Ein Schritt setzt einen Header, den wir selbst senden: `X-Webhook-*` oder `User-Agent`. |
| `forbidden_header` | Ein Schritt setzt einen Hop-by-Hop- oder Steuer-Header, etwa `Expect`. |
| `unknown_secret` | Ein Auth-Schritt nennt ein Secret, das sein Projekt nicht hat. |

Die übrigen Ablehnungen:

| Status | Code | Wann |
|---|---|---|
| `422` | `validation_error` | Eine Transformation mit `code` und `pipeline` zugleich oder mit keinem von beiden, oder ein `PATCH` mit dem Feld der anderen Art. |
| `402` | `not_entitled` (`feature: transformations`) | Beim Anlegen eines Skripts, beim Speichern von neuem Code, beim Fortsetzen oder Testen eines Skripts in einem Tarif ohne Skripte. |
| `422` | `invalid_transformation` | Ein Skript, das sich nicht laden lässt: `syntax_error`, `no_transform`, `code_too_large` oder `load_failed`. |
| `409` | `conflict` (`transformation_in_use`) | Beim Löschen einer Transformation, die ein Endpoint noch ausführt. Trennen Sie sie zuerst vom Endpoint. |
| `409` | `conflict` (`secret_in_use`) | Beim Löschen eines Secrets, das die aktuelle Version einer Pipeline nennt. Ändern Sie zuerst die Pipeline. |
| `409` | `conflict` (`destinations_unconfirmed`) | Bei einem `PATCH`, der einen `auth`-Schritt speichert, ohne in `confirm_destinations` jeden Endpoint zu nennen, der die Transformation ausführt. `details.destinations` listet deren URLs auf, und nichts wird gespeichert. |
| `403` | `forbidden` (`role`) | Wenn ein Member ein Secret hinterlegt oder ändert, eine Pipeline speichert, deren `auth`-Schritt auf eines verweist, oder eine solche Pipeline mit einem Endpoint verknüpft. |
| `404` | `not_found` (`transformation`, `transformation_version`, `secret`) | Es existiert nicht, die Version wird nicht mehr aufbewahrt, oder ein Endpoint nennt eine Transformation aus einem anderen Projekt. |
| `429` | `rate_limited` | Mehr als 60 Speichervorgänge und Tests von Skripten pro Minute und Workspace. |
| `503` | `unavailable` (`transform`) | Die Sandbox konnte das Skript gerade nicht ausführen. Es wurde nichts gespeichert; versuchen Sie es erneut. |

## Nächste Schritte {#next-steps}

- [Slack, Teams und Discord](/docs/product-webhooks/chat-apps) — die Webhook-URL eines Kanals besorgen und Events an ihn senden.
- [Zustellungen und Retries](/docs/product-webhooks/deliveries) — Status, Retries und erneutes Senden.
- [Endpoint-Verifizierung](/docs/product-webhooks/endpoint-verification) — die Challenge und Empfänger, die sie nicht beantworten können.
- [Webhooks-API](/docs/reference/webhooks) — jede Route, darunter `/v1/transformations` und `/v1/secrets`.
- [Überblick über Webhooks](/docs/product-webhooks) — Events, Endpoints und Abos.
