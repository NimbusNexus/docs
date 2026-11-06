---
title: "Pipelines"
description: "Die Schritte einer Pipeline, ihre Pfade, Werte und Filter, die Vorlagen als Ausgangspunkt und die Obergrenzen einer Ausführung."
publishedAt: 2026-11-06
updatedAt: 2026-11-06
kind: concept
---

# Pipelines

Eine Pipeline ist ein JSON-Dokument, und diese Seite beschreibt seine Sprache. Webhooks und Request Bins führen dieselbe Sprache auf derselben Engine aus; was Sie hier lernen, gilt daher auch dort, im Rahmen der eigenen Header-Regeln des jeweiligen Produkts. Um etwas davon ohne Konto auszuprobieren, nutzen Sie den [Playground](/transforms/playground).

## Das Dokument {#document}

Diese Pipeline behält bezahlte Rechnungen ab $1,000, entfernt die E-Mail-Adresse des Kunden und jede Telefonnummer, fügt zwei Felder und einen Header hinzu und gibt an, dass dem Request ein Bearer-Token hinzugefügt wird:

```json
{
  "version": 1,
  "steps": [
    { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
    { "drop": ["data.customer.email", "**.phone"] },
    { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } },
    { "headers": { "set": { "X-Event-Type": "{{ type }}" } } },
    { "auth": { "type": "bearer", "secret": "sec_…" } }
  ]
}
```

`version` ist das Format des Dokuments, immer `1`, nicht die Version der Pipeline. Die Schritte laufen in der Reihenfolge, in der sie stehen. Jeder ist ein Objekt mit einem Schritt-Schlüssel und optional einer `note` von bis zu 200 Zeichen, die die Konsole am Schritt anzeigt und die beim Verwerfen gemeldet wird. Ein `filter` kann außerdem eine `action` haben.

Eine Ausführung sieht einen Request: einen `body`, einen beliebigen JSON-Wert; `headers`; und schreibgeschütztes `meta`. In der Ausführungs-API sind alle drei das, was Sie senden. Jeder Schritt sieht den Body so, wie der vorige ihn hinterlassen hat. In der API und in Fehlertexten werden Schritte ab 0 gezählt, im Editor der Konsole ab 1.

| Schritt | In der Konsole | Was er tut |
|---|---|---|
| `filter` | **Filter** | Behält den Request nur, wenn er passt, oder verwirft ihn mit `"action": "drop"`, wenn er passt. |
| `drop` | **Remove fields** | Entfernt Felder aus dem Body. |
| `set` | **Set fields** | Fügt Felder hinzu oder überschreibt sie. |
| `map` | **Reshape the body** | Ersetzt den Body durch einen, den Sie bauen. |
| `headers` | **Headers** | Setzt, entfernt oder benennt Header um. |
| `auth` | **Credential** | Gibt an, dass dem Request ein Bearer-Token, Basic Auth oder ein API-Key hinzugefügt wird, und nennt den zugehörigen Slot. |

### `filter` {#step-filter}

Behält den Request nur, wenn er passt; andernfalls antwortet die Ausführung mit `dropped`. Mit `"action": "drop"` ist es umgekehrt: Was passt, wird verworfen.

```json
{ "filter": { "data": { "status": "paid", "amount": { "$gte": 100000 } } }, "note": "Paid, $1,000 or more" }
```

- Jeder Schlüssel ist eine Bedingung, und alle müssen erfüllt sein. Ein verschachteltes Objekt prüft nach Form, wie hier `data`.
- Ein einfacher Wert passt bei JSON-Gleichheit: `1` ist gleich `1.0`.
- Ein Array passt, wenn es dem Wert gleicht oder wenn eines seiner Elemente passt: `{"data": {"tags": "urgent"}}` gilt für `["billing", "urgent"]`, und `{"data": {"items": {"sku": "A-1", "qty": 2}}}` braucht ein Element mit beidem.
- Ein Feld, das dem Request fehlt, passt nur auf `{"$exists": false}` und auf Verneinungen wie `$neq`.
- Die Operatoren sind `$eq`, `$neq`, `$gt`, `$gte`, `$lt`, `$lte` (Zahlen mit Zahlen, Text mit Text; ISO-Zeitstempel werden nach der Zeit verglichen), `$in`, `$nin`, `$exists`, `$startsWith`, `$endsWith`, `$contains` (Text oder ein Array, das den Wert enthält) sowie `$and`, `$or` und `$not`, um Filter zu kombinieren.
- `$headers`, `$meta` und `$body` prüfen diesen Teil des Requests: `{"$headers": {"x-github-event": "push"}}`.

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

Bei einem Request `invoice.paid`, dessen `data` `{"id": "in_42", "amount": 150000, "currency": "usd"}` ist, wird der Body zu:

```json
{ "invoice_id": "in_42", "amount": 150000, "amount_display": "1,500.00 USD", "event": "invoice.paid" }
```

### `headers` {#step-headers}

Setzt Header mit `set`, entfernt sie mit `remove` und benennt sie mit `rename` um, in der Reihenfolge remove, rename, set. Namen passen unabhängig von Groß- und Kleinschreibung, und ein gesetzter Name ersetzt jede Schreibweise davon.

```json
{ "headers": { "set": { "X-Event-Type": "{{ type }}", "Content-Type": "application/json" } } }
```

Ein Header-Schritt kann keinen Header setzen, der zur Verbindung gehört, etwa `Host` oder `Content-Length`, und auch nicht `Set-Cookie`. Ebenso wenig kann er `Authorization`, `Cookie` oder `X-Api-Key` setzen, denn der Wert stünde dann im Dokument, das jeder Lesezugriff zurückgibt: Ein Credential gehört in einen `auth`-Schritt. Ein Produkt, das die Pipeline per Referenz ausführt, wendet außerdem seine eigenen Header-Regeln auf sie an.

### `auth` {#step-auth}

Gibt an, dass dem Request ein Credential hinzugefügt wird, und nennt den zugehörigen Slot:

| `type` | Fügt hinzu |
|---|---|
| `bearer` | `Authorization: Bearer` und das Credential. |
| `basic` | `Authorization: Basic`, aus einem `username` und dem Credential als Passwort. |
| `api_key`, `"in": "header"` | Das Credential im Header namens `name`, nach einem optionalen `prefix` wie `"Token "`. |
| `api_key`, `"in": "query"` | Das Credential als Query-Parameter `name`, an der URL des Ziels. |

```json
{ "auth": { "type": "api_key", "in": "header", "name": "X-Api-Key", "secret": "sec_…" } }
```

`secret` ist die ID eines [Slots](/docs/product-transforms/reference#slots) des Workspaces. Es ist nie ein Wert: Ein dort eingefügter Wert wird mit `invalid_secret` abgewiesen, und die Ablehnung wiederholt ihn nicht. Das Produkt, das die Pipeline per Referenz ausführt, ordnet dem Slot ein eigenes Secret zu ([Credentials](/docs/product-transforms#credentials)). Der Test und die Ausführungs-API zeigen den Header oder Parameter mit maskiertem Wert.

Auth-Schritte stehen nach allen anderen Schritten, sodass kein Schritt ein Credential lesen, kopieren oder prüfen kann.

## Pfade und Werte {#values}

Ein Pfad benennt ein Feld des Bodys:

| Pfad | Benennt |
|---|---|
| `data.customer.email` | Ein Feld. |
| `data.items[0].sku` | Ein Element einer Liste. |
| `data['first name']` | Einen Schlüssel mit einem Leerzeichen, einem Punkt oder einer Klammer darin. |
| `data.items[*].sku` | Jedes Element; in einem Wert die Liste davon. |
| `**.email` | `email` in beliebiger Tiefe; nur in einem `drop`. |
| `$meta.source`, `$headers.x-name`, `$body.data` | Die Metadaten des Requests, einen seiner Header oder seinen Body; nur in einem Wert. |

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

Die Galerie enthält fertige Pipelines als Ausgangspunkt. In der Konsole stehen sie unter **Start from a template**. Über die API liefert `GET /v1/pipelines/templates` jede Vorlage mit ihrer `pipeline`. Wenn Sie eine Vorlage speichern, entsteht eine Pipeline, die Ihnen gehört: Ändern Sie sie wie jede andere; nichts verweist auf die Vorlage zurück.

| `id` | Vorlage | Was sie sendet |
|---|---|---|
| `slack` | **Slack message** | Für einen Incoming Webhook von Slack: den Typ des Events als Überschrift, seine ID und Uhrzeit und seine Daten als Codeblock. |
| `discord` | **Discord message** | Für den Webhook eines Discord-Kanals: ein Embed mit dem Typ des Events, seinen Daten als Codeblock sowie ID und Uhrzeit. Sie erwähnt niemanden. |
| `teams` | **Microsoft Teams card** | Für einen Workflow-Webhook in Teams: eine Adaptive Card mit dem Typ des Events, seiner ID und Uhrzeit und seinen Daten in Festbreitenschrift. |
| `keep_fields` | **Keep only these fields** | `id`, `type`, `created_at` und `version` des Events und nur die Felder von `data`, die ihr `map` aufführt, anfangs `data.id`. Ein aufgeführtes Feld, das dem Event fehlt, wird als `null` gesendet. |
| `drop_personal` | **Drop personal data** | Das Event ohne `email`, `phone`, `first_name`, `last_name`, `address`, `billing_address`, `shipping_address`, `date_of_birth` und `ip_address`, in beliebiger Tiefe. Ein einfaches `name` bleibt, weil es oft einen Tarif oder ein Produkt benennt. |

Jede Chat-Vorlage besteht aus einem `map`-Schritt und einem `headers`-Schritt, der `Content-Type: application/json` setzt, und funktioniert mit jedem Event. Ein fehlender Typ erscheint als „Event“ und eine fehlende ID oder Uhrzeit als „—“, die Daten werden auf die Limits der App gekürzt, und nichts im Event kann die Nachricht formatieren, jemanden erwähnen oder den Codeblock vorzeitig beenden.

## Limits {#limits}

Eine Pipeline hat keine Schleifen, keine Uhr und kein Netzwerk, und feste Obergrenzen begrenzen jede Ausführung. Ist eine überschritten, antwortet die Ausführung mit `failed` und dem Grund, und ein Dokument, das eine überschreitet, wird beim Speichern abgewiesen.

| Was | Limit | Abgewiesen als |
|---|---|---|
| Ein Dokument, als kompaktes JSON | 64 KiB | `too_large` |
| Schritte | 20 | `too_many_steps` |
| Pfade in einem `drop`, Felder in einem `set`, Namen in jedem Teil eines `headers`-Schritts | 50 | `invalid_value` |
| Die Einstellungen eines Schritts, als kompaktes JSON | 16 KiB | `too_large` |
| Die Notiz eines Schritts | 200 Zeichen | `invalid_value` |
| Verschachtelung, in einem Schritt und in einem Body | 32 Ebenen | `too_deep`, `input_too_deep` |
| Der Body, den ein Schritt liest | 256 KiB | `input_too_large` |
| Der Body, mit dem eine Ausführung antwortet | 256 KiB | `output_too_large` |
| Ein Wert, den ein Schritt erzeugt | 64 KiB | `value_too_large` |
| Arbeit in einer Ausführung | 100,000 gelesene oder kopierte Werte, Text zählt einen pro 128 Zeichen | `too_many_nodes` |
| Header am Ende einer Ausführung | 50 | `too_many_headers` |
| Ein Header-Wert | 8 KiB | `header_too_large` |

Der Playground hat niedrigere Obergrenzen: ein Dokument von 16 KiB, ein Body von 32 KiB und 10,000 gelesene oder kopierte Werte in einer Ausführung.

## Nächste Schritte {#next-steps}

- [Schnellstart](/docs/product-transforms/quickstart) — eine Pipeline testen, speichern und ausführen.
- [Referenz für Transforms](/docs/product-transforms/reference) — jede Route und jedes Feld und was jede Ablehnung bedeutet.
- [Transformationen in Webhooks](/docs/product-webhooks/transformations) — dieselbe Sprache an einem Webhooks-Endpoint.
