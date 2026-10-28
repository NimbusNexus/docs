---
title: "Schnellstart für Request Bins"
description: "Einen Bin anlegen, ihm mit curl einen Request senden und lesen, was er aufgezeichnet hat — erst in der Konsole, dann über die API."
publishedAt: 2026-10-22
updatedAt: 2026-10-27
kind: quickstart
---

# Schnellstart für Request Bins

In wenigen Minuten von null zum aufgezeichneten Request. Sie legen einen Bin an, senden ihm mit `curl` einen Request und lesen genau zurück, was angekommen ist: erst in der Konsole, dann über die API.

## Bevor Sie beginnen {#before}

- **In der Konsole, in jedem Tarif.** Öffnen Sie `https://bins.nimbusnexus.net` und melden Sie sich mit Ihrem NimbusNexus-Konto an. Die Schritte 1 bis 3 brauchen nichts weiter, auch in Free.
- **Über die API, mit einem Key.** Schritt 4 braucht einen API-Key, der in Ihrer [Kontokonsole]({{ACCOUNT_BASE_URL}}/api-keys?product=bins) mit **Request Bins** als Produkt und **Read & write** als Berechtigung erstellt wurde. Ein Key kann in jedem Tarif Bins anlegen; um mit einem Key zu lesen, was sie aufgezeichnet haben, brauchen Sie Starter oder höher, und in Free antworten diese Routen mit `402` `not_entitled`.

## 1. Bin anlegen {#create}

Wählen Sie in der Konsole **Create a bin** (**New bin**, sobald Sie einen haben). Die Bezeichnung ist optional, und Absender sehen sie nie. **Lifetime** steht zunächst auf dem Standard Ihres Tarifs, 24 Stunden in Free und bis zum Löschen in bezahlten Tarifen; Sie können eine kürzere Lebensdauer wählen oder mit **Custom…** eine eigene eingeben, bis zum Maximum Ihres Tarifs. Die Lebensdauer lässt sich später nicht ändern. Wählen Sie **Create bin**.

Die Seite des Bins öffnet sich. Oben stehen seine **Bin URL**, etwa `https://nnbin.net/b/k7xq2mbn9tfa`, und ein Befehl unter **Try it**, jeweils mit einer Schaltfläche zum Kopieren.

## 2. Request senden {#send}

Senden Sie dem Bin von einem beliebigen Terminal aus einen `POST` mit einem Pfad und einer Query nach dem Slug. Verwenden Sie Ihre eigene Bin-URL:

```bash
curl -X POST "https://nnbin.net/b/k7xq2mbn9tfa/orders?source=quickstart" \
  -H "Content-Type: application/json" \
  -d '{"order_id": 1042, "status": "paid"}'
```

```json
{"status":"accepted"}
```

Diese Antwort ist für jeden Request an eine Bin-URL gleich, ob aufgezeichnet oder nicht, und verrät einem Absender daher nichts über Ihren Bin. Was angekommen ist, zeigt die Konsole.

Jede Methode, jeder Pfad, Header oder Body funktioniert. Im echten Einsatz tragen Sie die Bin-URL dort ein, wo eine App, die Webhook-Einstellungen eines Anbieters, ein Skript oder ein CI-Job eine URL erwartet, und lassen den Absender senden.

## 3. In der Konsole ansehen {#console}

Zurück auf der Seite des Bins steht der Request innerhalb weniger Sekunden oben in der Liste; die Liste wird alle 3 Sekunden aktualisiert. Wählen Sie ihn aus, um Folgendes zu sehen:

- die Methode und den Pfad nach dem Slug: `POST /orders`;
- die Query, dekodiert: `source=quickstart`;
- die Header in der Reihenfolge ihres Eintreffens;
- den Body, als JSON formatiert, mit dem Rohtext nur einen Klick entfernt;
- die Adresse, von der er kam, seine Größe und wann er ankam.

In Free ist das der gesamte Ablauf: Die Konsole liest in jedem Tarif, was Bins aufgezeichnet haben.

## 4. Dasselbe über die API ausführen {#api}

Legen Sie Ihren Key in einer Umgebungsvariablen ab:

```bash
export BINS_API_KEY="<your-api-key>"
```

Jeder Pfad unten ist relativ zu `https://bins.nimbusnexus.net`, und jeder Request enthält `Authorization: Bearer <your key>`. Legen Sie zuerst einen Bin an:

```bash
curl -X POST https://bins.nimbusnexus.net/v1/bins \
  -H "Authorization: Bearer $BINS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"label": "Quickstart"}'
```

```json
{
  "id": "bin_3f9a1c7e5b2d8f4a6c0e9b17",
  "slug": "w4tz8hcv2qnd",
  "url": "https://nnbin.net/b/w4tz8hcv2qnd",
  "label": "Quickstart",
  "status": "enabled",
  "expires_at": null,
  "created_at": "2026-10-22T09:12:01Z",
  "request_count": 0
}
```

Die Antwort ist hier gekürzt; [das Bin-Objekt](/docs/product-bins/reference#bin) listet jedes Feld auf. Zwei sind jetzt wichtig:

- **`url`** geben Sie einem Absender.
- **`id`** erwartet jeder spätere Aufruf. Bewahren Sie sie auf.

`expires_at` ist `null`, weil ein Bin in einem bezahlten Tarif lebt, bis Sie ihn löschen; in Free liegt der Wert 24 Stunden nach `created_at`. Free erlaubt einen Bin gleichzeitig, daher antwortet dieser Aufruf dort mit `402` `quota_exceeded`, solange der Bin aus Schritt 1 existiert. Finden Sie stattdessen diesen über seine URL, mit `GET /v1/bins?url=https://nnbin.net/b/k7xq2mbn9tfa`.

Senden Sie dem neuen Bin den Request aus Schritt 2, mit seiner eigenen URL, und listen Sie dann auf, was er aufgezeichnet hat:

```bash
curl https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17/requests \
  -H "Authorization: Bearer $BINS_API_KEY"
```

```json
{
  "items": [
    {
      "id": "req_8d2e6b1f4a9c3e7d5b0f2a61",
      "bin_id": "bin_3f9a1c7e5b2d8f4a6c0e9b17",
      "method": "POST",
      "path": "/orders",
      "query": "source=quickstart",
      "source_ip": "203.0.113.24",
      "content_type": "application/json",
      "size_bytes": 36,
      "truncated": false,
      "seen_count": 1,
      "received_at": "2026-10-22T09:12:04Z",
      "expires_at": "2026-10-29T09:12:04Z"
    }
  ],
  "next_offset": null,
  "next_until": null
}
```

Der neueste Request steht an erster Stelle. Sein `expires_at` gibt an, wann er gelöscht wird: hier nach 7 Tagen, der Aufbewahrung von Starter.

Um einen Request vollständig zu lesen, mit Query, Headern und Body:

```bash
curl https://bins.nimbusnexus.net/v1/requests/req_8d2e6b1f4a9c3e7d5b0f2a61 \
  -H "Authorization: Bearer $BINS_API_KEY"
```

```json
{
  "id": "req_8d2e6b1f4a9c3e7d5b0f2a61",
  "method": "POST",
  "path": "/orders",
  "query": "source=quickstart",
  "headers": [
    {"name": "user-agent", "value": "curl/8.7.1"},
    {"name": "accept", "value": "*/*"},
    {"name": "content-type", "value": "application/json"},
    {"name": "content-length", "value": "36"}
  ],
  "body_base64": "eyJvcmRlcl9pZCI6IDEwNDIsICJzdGF0dXMiOiAicGFpZCJ9",
  "size_bytes": 36,
  "truncated": false,
  "request_id": "4b8f2c1d9e7a46b3a0c5d8e2f1a7b9c3"
}
```

Auch diese Antwort ist gekürzt: Die vollständige Antwort enthält jedes Feld des Listeneintrags, und die echte Header-Liste enthält auch die Header, die die Proxys vor `nnbin.net` hinzufügen, etwa `x-forwarded-for`. Der Body ist base64-kodiert, weil ein Body kein Text sein muss. So geben Sie ihn aus:

```bash
curl -s https://bins.nimbusnexus.net/v1/requests/req_8d2e6b1f4a9c3e7d5b0f2a61 \
  -H "Authorization: Bearer $BINS_API_KEY" | jq -r .body_base64 | base64 --decode
```

```text
{"order_id": 1042, "status": "paid"}
```

## Polling statt Push {#polling}

Es gibt keinen Stream und keinen Callback. Um auf einen Request zu warten, fragen Sie die Liste mit `since` ab, gesetzt auf das neueste `received_at`, das Sie gesehen haben; sie liefert nur Requests, die nach diesem Zeitpunkt eingegangen sind:

```bash
curl -G https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17/requests \
  --data-urlencode "since=2026-10-22T09:12:04Z" \
  -H "Authorization: Bearer $BINS_API_KEY"
```

`-G` mit `--data-urlencode` setzt `since` kodiert in den Query-String, sodass ein Offset wie `+00:00` unverändert ankommt. Ein erneut gesendeter Request ist eine eigene, neue Zeile und erscheint daher ebenfalls in dieser Liste, mit eigener `id` und eigenem `received_at`.

Fragen Sie nicht eine feste Anzahl von Malen ab, um dann die letzte Antwort zu prüfen. Prüfen Sie mit einem Timeout, dass der Request *erscheint*, sonst sieht ein langsamer Absender aus wie einer, der nie gesendet hat.

## Aufräumen {#cleanup}

Ein Bin in einem bezahlten Tarif lebt, bis Sie ihn löschen, es sei denn, Sie haben ihn mit `expires_in_minutes` angelegt, und jeder Tarif begrenzt, wie viele Bins Sie gleichzeitig haben dürfen. Löschen Sie ihn daher, wenn Sie fertig sind:

```bash
curl -X DELETE https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17 \
  -H "Authorization: Bearer $BINS_API_KEY"
```

Löschen ist **endgültig**: Die URL hört sofort auf aufzuzeichnen, was der Bin aufgezeichnet hat, wird gelöscht, und sein Slug wird nie wieder vergeben, weder an Sie noch an jemand anderen. Absender erhalten von der URL weiterhin `200`. Um stattdessen eine Zeit lang nicht aufzuzeichnen, setzen Sie den Bin per `PATCH` auf `{"status": "disabled"}` und später wieder auf `{"status": "enabled"}`. Um den Bin zu behalten und seinen Inhalt zu entfernen, leeren Sie ihn mit `DELETE /v1/bins/{id}/requests`. In der Konsole finden Sie alle drei im Menü ⋯ auf der Seite des Bins: **Delete bin…**, **Disable** und **Empty bin…**. In Free läuft ein Bin spätestens 24 Stunden nach dem Anlegen ab, was ihn genauso beendet wie Löschen.

## Nächste Schritte {#next-steps}

- [Produktüberblick](/docs/product-bins) — Tarife und Limits, gesperrte Bins und was Request Bins nicht tut.
- [Weiterleitung](/docs/product-bins/forwarding) — jeden Request in einem bezahlten Tarif zusätzlich an Ihren eigenen Server weiterleiten.
- [Referenz für Request Bins](/docs/product-bins/reference) — jede Route und jedes Feld, was eine Bin-URL antwortet, Rollen und Scopes.
- [Request-Bins-API](/docs/reference/bins) — jede Operation, mit dem Request in curl, TypeScript, Python oder Go.
