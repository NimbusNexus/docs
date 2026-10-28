---
title: "Inboxes"
description: "Wegwerf-E-Mail-Adressen für Tests — eine Adresse anlegen, das zu testende System darauf richten und im Dashboard oder über die API lesen, was ankommt."
publishedAt: 2026-08-18
updatedAt: 2026-10-27
kind: concept
---

# Inboxes

Inboxes stellt Ihnen **E-Mail-Adressen** zum Wegwerfen bereit, die echte Mail annehmen. Sie legen eine an, richten ein Registrierungsformular oder eine Testsuite darauf und lesen im Dashboard oder über die REST-API, was angekommen ist.

> **Nicht die gesuchte Seite?** Inboxes empfängt ausschließlich E-Mails. Um aus Ihrer Anwendung Mail zu *senden*, ist dies nicht das richtige Produkt. Um **HTTP-Requests** zu erfassen — die Webhooks eines Anbieters oder das, was Ihre eigene App sendet —, nutzen Sie [Request Bins](/docs/product-bins).

## Auf einen Blick {#at-a-glance}

| | |
| --- | --- |
| Was Sie anlegen | Eine **Inbox**: eine Wegwerf-E-Mail-Adresse |
| Basis-URL der API | `{{INBOXES_BASE_URL}}` |
| Authentifizierung | `Authorization: Bearer <key>`, mit einem Key, der in der Kontokonsole mit **Inboxes** als Produkt erstellt wurde |
| Kennung, die jede Route erwartet | Die `id` der Inbox, zum Beispiel `inb_7f820a77f64ea18174499945` — nie die Adresse |
| Eine Inbox über ihre Adresse finden | `GET /v1/inboxes?address=<address>` |
| Lesen, was angekommen ist | `GET /v1/inboxes/{id}/messages` oder `GET /v1/messages` für alle Inboxen auf einmal (bezahlte Tarife; im kostenlosen Tarif lesen Sie im Dashboard) |
| Durchsuchen, was angekommen ist | `q` bei beiden Listen, eingegrenzt mit `in` oder `header` ([Nachrichten durchsuchen](#search)) |
| Eine Inbox löschen | `DELETE /v1/inboxes/{id}` — endgültig, und die Adresse wird nie wieder vergeben |
| Alle Routen, mit Beispielen | Die [Referenz für die Inboxes-API](/docs/reference/inboxes) |

## So funktioniert es {#how}

1. **Legen Sie eine Inbox an** — im Dashboard mit **Create an inbox** oder mit `POST /v1/inboxes`.
2. **Senden Sie Mail an ihre Adresse**, aus dem zu testenden System und mit der Phrase der Inbox (`phrase`) im Betreff, falls sie eine hat.
3. **Lesen Sie, was angekommen ist.** Es erscheint innerhalb von Sekunden im Dashboard und in bezahlten Tarifen unter `GET /v1/inboxes/{id}/messages`. Um eine Nachricht unter vielen zu finden, durchsuchen Sie Betreffzeilen, Absender, Header und Bodys: im Dashboard mit **Search** über der Liste, in der API mit `q` ([Nachrichten durchsuchen](#search)). **All inboxes** im Dashboard und `GET /v1/messages` in der API listen auf, was bei allen Inboxen auf einmal angekommen ist.
4. **Löschen Sie die Inbox**, wenn Sie fertig sind, oder lassen Sie sie ablaufen.

Der [Schnellstart](/docs/product-inboxes/quickstart) führt alle vier Schritte mit `curl` aus.

Verwenden Sie den Wert von `address` genau so, wie die API ihn zurückgibt. Adressen liegen auf einer eigenen Domain, nicht auf `{{ROOT_DOMAIN}}`, damit Wegwerf-Traffic nie die Reputation mit der Domain teilt, die Ihre echte Mail verwendet.

## Wie die Annahme funktioniert {#acceptance}

Mail wird direkt an der Tür abgewiesen, statt angenommen und versteckt zu werden. Eine Nachricht wird nur gespeichert, wenn alle diese Bedingungen erfüllt sind:

- die Empfängeradresse ist eine bestehende, aktivierte Inbox;
- der **Betreff enthält die Phrase dieser Inbox**, falls sie eine hat;
- der Workspace liegt innerhalb seines Monatskontingents;
- die Nachricht ist nicht größer als 5 MiB.

Alles andere wird während des SMTP-Dialogs abgewiesen, sodass der sendende Server davon erfährt und den Bounce erzeugt. Eine abgewiesene Nachricht wird nie gespeichert und nie auf Ihren Verbrauch angerechnet.

Angenommene Mail wird vor dem Speichern bereinigt: HTML durchläuft einen Sanitizer mit Allow-List, und das Dashboard rendert es in einem Sandbox-Frame, in dem externe Bilder blockiert sind, bis Sie sie anfordern. Jeder kann einer Wegwerf-Adresse Mail senden, daher wird der Inhalt so behandelt, als stamme er von einem Angreifer.

## Limits nach Tarif {#limits}

| | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- |
| Inboxen gleichzeitig | 1 | 5 | 25 | 250 |
| Nachrichten pro Monat | 1.000 | 25.000 | 250.000 | 5.000.000 |
| Gespeichert für (Aufbewahrung) | 1 Tag | 7 Tage | 30 Tage | 90 Tage |
| Lebensdauer einer Inbox | 24 Stunden | bis zum Löschen oder bis zu 7 Tage, wenn Sie eine festlegen | bis zum Löschen oder bis zu 30 Tage | bis zum Löschen oder eine beliebige Lebensdauer |
| Phrase im Betreff | immer erforderlich | optional | optional | optional |
| Lesen über die API | nein (nur Dashboard) | ja | ja | ja |
| Angenommene Mails pro Minute und Inbox | 60 | 300 | 1.200 | 6.000 |

Die Größenlimits sind in jedem Tarif gleich:

| | Limit |
| --- | --- |
| Eine E-Mail | 5 MiB. Größere Mail wird abgewiesen, nie gekürzt. |
| Text- oder HTML-Body | Je 256K Zeichen werden behalten; der Rest wird abgeschnitten und die Nachricht mit `truncated: true` markiert. |
| Anhänge | Name, Content-Type, Größe und Hashwert werden behalten. Die Datei selbst wird in keinem Tarif gespeichert. |

## Wie eine Inbox endet {#lifecycle}

| | Was passiert | Lässt es sich rückgängig machen? |
| --- | --- | --- |
| **Deaktivieren** | Die Inbox nimmt keine Mail mehr an und behält, was sie hat; an sie gesendete Mail wird abgewiesen. | Ja — aktivieren Sie sie wieder |
| **Löschen** | Die Inbox und ihre Mail werden gelöscht, und ihre Adresse wird stillgelegt: Sie wird nie wieder vergeben, weder an Sie noch an jemand anderen. | Nein |
| **Ablauf** | Zu `expires_at`, dasselbe wie Löschen. Jede kostenlose Inbox läuft ab, nach höchstens 24 Stunden; in einem bezahlten Tarif nur eine Inbox, die mit einer Lebensdauer angelegt wurde. | Nein |

Im Dashboard enthält das Menü ⋯ auf der Seite einer Inbox **Rename…**, **Disable** oder **Enable**, **Empty inbox…**, womit Sie die Mail der Inbox löschen und die Inbox behalten, und **Delete inbox…**. Gelöscht wird mit `DELETE /v1/inboxes/{id}`; ältere Versionen dieser Dokumentation und das Audit-Log der API nennen das *release*. Eine stillgelegte Adresse wird absichtlich nie neu vergeben: Eine wiederverwendete Adresse würde die Passwort-Zurücksetzung eines Fremden an den nächsten Inhaber zustellen. Details, auch dazu, wie Ablauf und Aufbewahrung zusammenwirken, finden Sie unter [Adressen und die Phrase](/docs/product-inboxes/addresses#lifecycle).

## Lesen über die API {#reading}

Nachrichten lassen sich in jedem Tarif im Dashboard lesen, auch im kostenlosen. Das **programmatische** Lesen kommt mit den bezahlten Tarifen hinzu: `GET /v1/inboxes/{id}/messages` listet die Nachrichten einer Inbox auf, neueste zuerst, jeweils mit Absender, Betreff und den Prüfergebnissen der Authentifizierung und, mit `extract=otp`, einem Feld `extracted` mit einem gefundenen Einmalcode — meist das Einzige, was ein Test braucht. `GET /v1/messages` listet die Nachrichten aller Inboxen des Workspaces in einer Liste auf, jede mit ihrer `inbox_id`. `GET /v1/inboxes/{id}/messages/{message_id}` liefert eine Nachricht vollständig: beide Body-Teile, die Angaben zu ihren Anhängen und ihre [Header](#headers).

Jede Route erwartet die `id` der Inbox. Das Dashboard zeigt sie auf der Seite der Inbox neben **ID**, mit einer Schaltfläche zum Kopieren. Wenn Sie nur die Adresse haben, schlagen Sie die Inbox nach:

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes?address=ff25m3tue9vm@nninbox.com" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

Die Antwort ist die übliche Liste mit höchstens einem Eintrag. `GET /v1/inboxes` und `GET /v1/inboxes/{id}` liefern `id`, `address` und `phrase` zusammen, sodass ein Aufruf alles liefert, was Sie zum Senden und Lesen brauchen.

## Nachrichten durchsuchen {#search}

Beide Listen von Nachrichten lassen sich durchsuchen: `GET /v1/inboxes/{id}/messages` für eine Inbox und `GET /v1/messages` für alle. Das Feld **Search** über jeder Liste im Dashboard sendet dieselben Parameter:

| Parameter | Bedeutung |
| --- | --- |
| `q` | Nur Nachrichten, die diesen Text enthalten, bis zu 200 Zeichen, ohne Beachtung der Groß- und Kleinschreibung. |
| `in` | Wo `q` sucht: `all`, der Standard, oder nur `subject`, `from` (der Absender, wie er im From-Header steht), `headers` (jeder Header als `name: value`) oder `body` (der Text-Body oder, bei einer E-Mail, die nur einen HTML-Body hat, der Text ihres HTML). |
| `header` | Nur die Werte dieses Headers, mit dem Namen in beliebiger Schreibweise, und jeder davon, wenn der Header mehrmals ankam. Ohne `q` jede Nachricht, die den Header enthält. Der Parameter passt zu `in` `all` oder `headers`. |

```bash
curl -G "{{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945/messages" \
  --data-urlencode "q=verification code" \
  --data-urlencode "in=subject" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

`since`, `until`, `extract` und `limit` funktionieren mit einer Suche genauso wie ohne. Ein `header` zusammen mit `in` gleich `subject`, `from` oder `body` wird mit einem `422` `validation_error` abgewiesen, dessen Eintrag den Typ `inboxes.search_conflict` hat.

Eine Suche paginiert anders als die einfache Liste. Sie liest die Nachrichten von der neuesten an und stoppt, sobald sie `limit` Treffer hat oder 16 MiB an Mail (oder 5.000 Nachrichten) gelesen hat, je nachdem, was zuerst eintritt. Eine Seite kann daher weniger Treffer als `limit` enthalten oder gar keine, während ältere Nachrichten noch ungelesen sind. Die Seite einer Suche hat `next_offset` `null` und, bis die Suche die älteste Nachricht der Liste gelesen hat, ein `next_until`: Übergeben Sie es als `until`, mit derselben Suche und demselben `since`, um dort weiterzusuchen, wo die Suche aufgehört hat. Mit einer Suche überspringt `offset` so viele Nachrichten, bevor die Suche zu lesen beginnt. Ohne Suche ist `next_until` immer `null`, und die Liste paginiert über `next_offset`.

Eine Suche in den Headern findet nur Mail, die angekommen ist, nachdem Inboxes begonnen hat, Header zu speichern ([Header](#headers)).

## Header {#headers}

`GET /v1/inboxes/{id}/messages/{message_id}` enthält die Header-Zeilen der E-Mail als `headers`: Objekte mit `name` und `value`, in der Reihenfolge ihres Eintreffens, Duplikate erhalten, jeder Wert entfaltet und seine Encoded Words (RFC 2047) dekodiert. Bis zu 256 Zeilen werden behalten, ein Name wird nach 256 Zeichen abgeschnitten und ein Wert nach 8.192. Die Listen enthalten keine Header. Im Dashboard stehen sie im Abschnitt **Headers** der Nachricht.

`headers` ist `null` bei einer E-Mail, die angekommen ist, bevor Inboxes begonnen hat, Header zu speichern: Ihre Header wurden nicht gespeichert und lassen sich nicht nachträglich hinzufügen. Die rohe E-Mail wird nicht gespeichert, nur ihre geparsten Teile.

## Zugang erhalten {#access}

Wenn Sie sich für Inboxes registrieren, erhalten Sie einen Workspace im kostenlosen Tarif: eine Inbox gleichzeitig, 24 Stunden Aufbewahrung und Lesen im Dashboard. Die Preise finden Sie auf der [Inboxes-Seite](/inboxes).

Keys werden nicht mit dem Workspace ausgestellt, und die Inboxes-API stellt keine aus. Erstellen Sie einen in Ihrer NimbusNexus-Kontokonsole unter **API keys** und wählen Sie **Inboxes** als Produkt — Identity stellt als einzige Stelle API-Keys für das gesamte Angebot aus. Ein Key ist ein JWT und beginnt deshalb mit `eyJ`. Senden Sie ihn als `Authorization: Bearer <key>` oder `X-API-Key: <key>`.

Wählen Sie beim Erstellen den Scope: `admin` kann Inboxen anlegen, ändern, leeren und löschen sowie lesen, `read` kann nur lesen. Ein Key für Inboxes lässt sich nicht auf ein einzelnes Projekt beschränken.

> **Ein Key mit `inbx_…` authentifiziert nicht mehr.** Inboxes hat früher eigene Keys mit diesem Präfix ausgestellt. Wenn Sie einen besitzen, erstellen Sie in der Kontokonsole einen Ersatz.

## Was das Produkt nicht tut {#not}

- **Es sendet nicht.** Es gibt keine API zum Senden und keine Relay-API. Eine Adresse, von der Mail ausgehen könnte, wäre ein Spam-Dienst.
- **Es ist kein Archiv.** Eine Nachricht wird gelöscht, wenn die Aufbewahrung des Tarifs abläuft, und alles in einer Adresse verschwindet, wenn die Adresse gelöscht wird oder abläuft.
- **Es leitet noch nicht weiter.** Eingehende Mail an eine URL weiterzuleiten, die Ihnen gehört, ist geplant, aber nicht umgesetzt.
- **Es erfasst kein HTTP.** Eine Inbox empfängt ausschließlich Mail. Für Webhooks und andere HTTP-Requests nutzen Sie [Request Bins](/docs/product-bins), dessen URLs jeden an sie gesendeten Request aufzeichnen.

## Nächste Schritte {#next-steps}

- [Schnellstart](/docs/product-inboxes/quickstart) — eine Inbox anlegen, ihr eine Nachricht senden, die Nachricht zurücklesen.
- [Adressen und die Phrase](/docs/product-inboxes/addresses) — die Schwelle im Betreff, Ablauf und Aufbewahrung.
- [Referenz für die Inboxes-API](/docs/reference/inboxes) — jede Route, mit dem Request in curl, TypeScript, Python oder Go.
