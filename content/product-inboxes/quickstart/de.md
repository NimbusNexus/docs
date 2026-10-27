---
title: "Schnellstart für Inboxes"
description: "Eine Wegwerf-E-Mail-Adresse anlegen, ihr eine Nachricht senden und die Nachricht zurücklesen — im Dashboard oder mit curl."
publishedAt: 2026-08-18
updatedAt: 2026-10-27
kind: quickstart
---

# Schnellstart für Inboxes

Von null zu etwas, das Sie in einem Test prüfen können. Sie legen eine Inbox an, senden echte Mail an ihre Adresse und lesen ihren Einmalcode zurück.

## Bevor Sie beginnen {#before}

- **Im Dashboard, in jedem Tarif.** Öffnen Sie Inboxes, wählen Sie **Create an inbox** und dann **Create inbox**: Die Bezeichnung ist optional, und die Lebensdauer steht zunächst auf dem Standard Ihres Tarifs. Die Seite der neuen Inbox zeigt genau, wohin Sie senden, jeweils mit einer Schaltfläche zum Kopieren: die Adresse und ihre Phrase, falls sie eine hat. Was ankommt, erscheint innerhalb von Sekunden in der Liste darunter. Das ist der gesamte Ablauf im kostenlosen Tarif.
- **Über die API, in einem bezahlten Tarif.** Programmatisches Lesen erfordert Starter oder höher — im kostenlosen Tarif antworten die Routen für Nachrichten mit `not_entitled`. Außerdem brauchen Sie einen API-Key, der in der Kontokonsole mit **Inboxes** als Produkt erstellt wurde; siehe [Zugang erhalten](/docs/product-inboxes#access).

Jeder Pfad unten ist relativ zu `{{INBOXES_BASE_URL}}`, und jeder Request enthält `Authorization: Bearer <your key>`.

## 1. Inbox anlegen {#allocate}

```bash
curl -X POST {{INBOXES_BASE_URL}}/v1/inboxes \
  -H "Authorization: Bearer $INBOXES_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phrase": true}'
```

```json
{
  "id": "inb_7f820a77f64ea18174499945",
  "address": "ff25m3tue9vm@nninbox.com",
  "transport": "email",
  "phrase": "nn-re89dr",
  "status": "enabled",
  "expires_at": null
}
```

Drei Felder sind wichtig:

- **`address`** geben Sie dem zu testenden System.
- **`phrase`** muss im Betreff von allem stehen, was an diese Adresse gesendet wird, sonst wird die Mail abgewiesen — das verhindert, dass sich jemand mit einer geleakten Adresse irgendwo registriert. In einem bezahlten Tarif erhalten Sie die Phrase nur auf Anfrage: Ohne `"phrase": true` erhalten Sie `"phrase": ""`, und die Adresse nimmt jeden Betreff an.
- **`id`** erwartet jeder spätere Aufruf. Bewahren Sie sie auf.

`expires_at` ist `null`, weil eine Adresse in einem bezahlten Tarif lebt, bis Sie sie löschen; senden Sie `expires_in_minutes`, um eine zu erhalten, die von selbst abläuft.

`transport` ist immer `"email"`, weil eine Inbox nur Mail empfängt. `POST /v1/inboxes` akzeptiert `"transport": "email"` oder gar kein `transport`; jeder andere Wert, etwa `"http"`, wird mit `422` `validation_error` abgewiesen. Um HTTP-Requests aufzuzeichnen, nutzen Sie [Request Bins](/docs/product-bins).

## 2. Nachricht senden {#send}

Hier gibt es nichts Spezifisches für NimbusNexus — senden Sie aus dem, was Sie testen. Die einzige Regel betrifft den Betreff:

```text
To:      ff25m3tue9vm@nninbox.com
Subject: nn-re89dr Your verification code
```

Ein Betreff ohne die Phrase wird während des SMTP-Dialogs abgewiesen. Ihr Absender erfährt davon, und nichts wird gespeichert — eine fehlende Nachricht ist hier also eine echte Abweisung, kein stilles Verwerfen.

## 3. Nachricht zurücklesen {#read}

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945/messages?extract=otp" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

```json
{
  "items": [
    {
      "id": "msg_bd160c0bcf8db20fba4e535d",
      "from_addr": "noreply@example.test",
      "subject": "nn-re89dr Your verification code",
      "received_at": "2026-08-18T09:12:04Z",
      "extracted": { "otp": "100017" }
    }
  ],
  "next_offset": null,
  "next_until": null
}
```

Auf `extracted.otp` kommt es an. Ein Test, der einen Registrierungsablauf prüft, will meist genau eines — den Code —, und `?extract=otp` setzt ihn in die Antwort der Liste, sodass der übliche Fall keinen zweiten Request braucht. Ohne `extract` ist `extracted` `null`; `extract=links` liefert stattdessen die Links der Nachricht, und `extract=all` liefert beides.

Um eine Nachricht unter vielen zu finden, durchsuchen Sie die Liste: `q=verification` behält die Nachrichten, die den Text enthalten, und `in=subject` (oder `from`, `headers` oder `body`) grenzt ein, wo gesucht wird. Eine Suche paginiert über `next_until` statt über `next_offset`; alle Parameter finden Sie unter [Nachrichten durchsuchen](/docs/product-inboxes#search).

Für die vollständige Nachricht, einschließlich beider Body-Teile, der SPF-, DKIM- und DMARC-Prüfergebnisse und der Header:

```bash
curl {{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945/messages/msg_bd160c0bcf8db20fba4e535d \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

**Sie haben nur die Adresse?** Schlagen Sie die Inbox nach, um ihre `id` zu erhalten:

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes?address=ff25m3tue9vm@nninbox.com" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

## Polling statt Push {#polling}

Es gibt keinen Stream und keinen Callback. Mail kommt innerhalb von Sekunden an, fragen Sie also die Listen-Route ab — ein kurzes Intervall über wenige Sekunden reicht, und genau das tut auch das Dashboard.

Fragen Sie nicht eine feste Anzahl von Malen ab, um dann das letzte Ergebnis zu prüfen. Prüfen Sie mit einem Timeout, dass die Nachricht *erscheint*, sonst sieht ein langsamer Absender aus wie ein defekter.

## Aufräumen {#cleanup}

Eine Adresse in einem bezahlten Tarif läuft nie ab, es sei denn, Sie haben sie mit `expires_in_minutes` angelegt, und jeder Tarif begrenzt, wie viele Sie gleichzeitig haben dürfen — löschen Sie sie also, wenn Sie fertig sind:

```bash
curl -X DELETE {{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945 \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

Löschen ist **endgültig**: Die Inbox und ihr Inhalt werden gelöscht, und die Adresse wird stillgelegt, sodass sie nie wieder vergeben werden kann, weder an Sie noch an jemand anderen. Das ist Absicht — eine wiederverwendete Wegwerf-Adresse würde die Mail eines Fremden in Ihre Inbox zustellen. Um eine Adresse stattdessen zu pausieren, setzen Sie sie per `PATCH` auf `{"status": "disabled"}` und aktivieren sie später wieder. Im Dashboard finden Sie beides im Menü ⋯ auf der Seite der Inbox: **Delete inbox…** und **Disable**.

## Nächste Schritte {#next-steps}

- [Adressen und die Phrase](/docs/product-inboxes/addresses) — die Annahmeregeln im Detail und wie Ablauf und Aufbewahrung zusammenwirken.
- [Produktüberblick](/docs/product-inboxes) — jedes Limit nach Tarif und was das Produkt nicht tut.
- [Referenz für die Inboxes-API](/docs/reference/inboxes) — jede Route, mit dem Request in curl, TypeScript, Python oder Go.
