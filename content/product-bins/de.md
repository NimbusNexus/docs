---
title: "Request Bins"
description: "Öffentliche URLs, die jeden an sie gesendeten HTTP-Request aufzeichnen — eine App, ein Skript oder einen Dienst darauf richten und in der Konsole oder über die API genau lesen, was gesendet wurde."
publishedAt: 2026-10-22
updatedAt: 2026-10-30
kind: concept
---

# Request Bins

Request Bins stellt Ihnen **Bins** bereit: öffentliche URLs, die jeden an sie gesendeten HTTP-Request aufzeichnen, mit beliebiger Methode, an jeden Pfad unter der URL und mit beliebigem Body. Richten Sie alles, was HTTP sendet, auf einen Bin — einen Webhook-Anbieter, Ihre eigene App, ein Skript, einen CI-Job — und lesen Sie genau, was angekommen ist: Methode, Pfad, Query, Header, Body und die Adresse, von der der Request kam, in der Konsole oder über die REST-API.

> **Nicht die gesuchte Seite?** Ein Bin zeichnet auf, was er empfängt, und antwortet jedem Absender gleich. In einem bezahlten Tarif kann er außerdem jeden Request so, wie er angekommen ist, an eine Ihrer URLs weiterleiten ([Weiterleitung](/docs/product-bins/forwarding)), aber er prüft keine Signaturen und stellt nicht an mehrere Endpoints zu. Um die Webhooks eines Anbieters zu prüfen und als Events an Ihre Endpoints zuzustellen, mit Dead-Letter-Queue und erneuter Zustellung, nutzen Sie eine [Webhooks-Quelle](/docs/product-webhooks/sources).

## Auf einen Blick {#at-a-glance}

| | |
| --- | --- |
| Was Sie anlegen | Einen **Bin**: eine URL wie `https://nnbin.net/b/k7xq2mbn9tfa` |
| Was er aufzeichnet | Jeden Request an diese URL oder einen beliebigen Pfad darunter, mit beliebiger Methode (`GET`, `POST`, `PROPFIND` von WebDAV, eigene Methoden eines Absenders), beliebigen Headern und beliebigem Body |
| Was ein Absender zurückbekommt | `200` und `{"status":"accepted"}`, sofort |
| Weiterleitung | In Starter, Pro und Custom kann ein Bin außerdem jeden Request an Ihre eigene https-URL weiterleiten ([Weiterleitung](/docs/product-bins/forwarding)) |
| Konsole | `https://bins.nimbusnexus.net` |
| Basis-URL der API | `https://bins.nimbusnexus.net/v1` |
| Authentifizierung | `Authorization: Bearer <key>`, mit einem Key, der in der Kontokonsole mit **Request Bins** als Produkt erstellt wurde |
| Kennung, die jede Route erwartet | Die `id` des Bins, zum Beispiel `bin_3f9a1c7e5b2d8f4a6c0e9b17` — nicht seine URL |
| Einen Bin über seine URL finden | `GET /v1/bins?url=<url>` |
| Lesen, was angekommen ist | `GET /v1/bins/{id}/requests` oder `GET /v1/requests` für alle Bins auf einmal (bezahlte Tarife; in Free lesen Sie in der Konsole) |
| Alle Routen, was eine Bin-URL antwortet, Rollen und Limits | Die [Referenz für Request Bins](/docs/product-bins/reference) |

## So funktioniert es {#how}

1. **Legen Sie einen Bin an** — in der Konsole mit **Create a bin** (**New bin**, sobald Sie einen haben) oder mit `POST /v1/bins`. Ab diesem Moment zeichnet seine URL auf.
2. **Senden Sie ihm Requests.** Geben Sie die URL an das weiter, was Sie beobachten wollen — die Webhook-Einstellungen eines Anbieters, die Konfiguration Ihrer App, ein Skript, einen CI-Job — oder rufen Sie sie selbst mit `curl` auf. Was nach dem Slug folgt, bestimmen Sie selbst: Ein Request an `https://nnbin.net/b/k7xq2mbn9tfa/orders/42` wird mit dem Pfad `/orders/42` aufgezeichnet.
3. **Lesen Sie, was angekommen ist.** Es erscheint innerhalb von Sekunden in der Konsole und in bezahlten Tarifen unter `GET /v1/bins/{id}/requests`. Um einen Request unter vielen zu finden, suchen Sie nach Text in Pfaden, Headern und Bodys oder nur in einem davon, in einem einzelnen Header oder in einem einzelnen Feld eines JSON-Bodys, oder beschränken Sie die Liste auf bestimmte Methoden: in der Konsole mit **Search**, **Search in** und den Methoden-Chips über der Liste, in der API mit `q`, `in`, `header`, `field` und `method` ([Erfasste Requests](/docs/product-bins/reference#requests)). Um zu sehen, welche Pfade ein Absender verwendet hat, schalten Sie die Liste auf **By path** um: Die Liste zählt die Requests pro Pfad, und wenn Sie einen Pfad auswählen, listet sie dessen Requests auf. `GET /v1/bins/{id}/paths` tut dasselbe in der API ([Requests nach Pfad](/docs/product-bins/reference#paths)). **All bins** in der Konsole und `GET /v1/requests` in der API listen in einer Liste auf, was alle Bins aufgezeichnet haben, mit derselben Suche.
4. **Löschen Sie den Bin**, wenn Sie fertig sind, oder lassen Sie ihn ablaufen.

Der [Schnellstart](/docs/product-bins/quickstart) führt alle vier Schritte aus.

Verwenden Sie den Wert von `url` genau so, wie die API ihn zurückgibt. Bin-URLs liegen auf einer eigenen Domain, `nnbin.net`, nicht auf `{{ROOT_DOMAIN}}`.

## Was ein Absender zurückbekommt {#answers}

Ein Bin beantwortet jeden Request sofort mit `200` und dem Body `{"status":"accepted"}`, ob er den Request aufgezeichnet hat oder nicht. Ein Bin, der deaktiviert oder gesperrt ist oder die monatlichen Requests seines Tarifs überschritten hat, antwortet genauso, und ebenso eine URL, deren Bin nie existiert hat oder gelöscht wurde. Das ist Absicht: Ein Absender, der einen Fehler erhält, stellt das Senden womöglich ein oder schaltet Ihren Webhook ab, und eine andere Antwort für einen aktiven Bin würde es jedem ermöglichen, gezielt nach Bins zu suchen.

Etwas anderes antwortet eine Bin-URL nur, wenn nichts aufgezeichnet wurde:

- `429` mit `Retry-After`, wenn der Absender oder der Bin sein Limit pro Minute überschritten hat;
- `503` mit `Retry-After`, wenn der Request gerade nicht gespeichert werden konnte und der Absender ihn erneut senden sollte;
- `404`, wenn der Slug in der URL keiner ist, den Request Bins je vergeben haben könnte.

Details finden Sie in der Referenz: [Was eine Bin-URL antwortet](/docs/product-bins/reference#edge-answers).

## Was aufgezeichnet wird {#recorded}

Für jeden Request speichert ein Bin die Methode, den Pfad nach dem Slug, den Query-String, die Header in der Reihenfolge ihres Eintreffens, den Body, die Adresse, von der er kam, und den Zeitpunkt seines Eintreffens. Einige Regeln bestimmen, was Sie zurücklesen:

- **Bodys werden bis 1 MiB vollständig gespeichert.** Von einem größeren Body bleibt das erste 1 MiB erhalten, `truncated` ist `true` und `size_bytes` gibt weiterhin an, wie groß er tatsächlich war.
- **Credentials werden geschwärzt.** Die Werte von `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` und `X-API-Key` werden durch `[redacted]` ersetzt, bevor etwas gespeichert wird. Alle anderen Header bleiben so erhalten, wie sie gesendet wurden, Signatur-Header eingeschlossen, denn eine Signatur ist genau das, was Sie sehen müssen, wenn ihre Prüfung fehlschlägt.
- **Nichts wird verändert oder ausgeführt.** Ein Body wird als genau die Bytes gespeichert, die angekommen sind, und die Konsole zeigt ihn als Text an, nie als Markup.
- **Jeder Request ist eine eigene Zeile.** Wird ein Request mit derselben Methode, demselben Pfad, demselben Query-String und demselben Body noch einmal gesendet, wird er noch einmal gespeichert, mit eigenen Headern, eigener Adresse und eigenem Zeitpunkt. So lässt sich jeder Retry eines Absenders einzeln öffnen.

## Weiterleitung {#forwarding}

In Starter, Pro und Custom kann ein Bin außerdem jeden Request, den er aufzeichnet, an Ihren eigenen Server weiterleiten. Geben Sie ihm eine Weiterleitungs-URL, dann gehen Methode, Pfad, Query, Header und Body so, wie sie angekommen sind, an diese URL weiter, während der Absender weiterhin sofort die Antwort `200` des Bins erhält. Der Bin versucht es erneut, wenn Ihr Server fehlschlägt, und speichert beim Request, was Ihr Server geantwortet hat. So sehen Sie, was ein Absender gesendet hat und was Ihr Endpoint daraus gemacht hat. Credentials werden nicht weitergeleitet: Die Header, die ein Bin schwärzt, verlassen ihn nie. Die Regeln, die Retries, die Limits und die Adresse, von der Weiterleitungen kommen, finden Sie unter [Weiterleitung](/docs/product-bins/forwarding).

## Tarife und Limits {#limits}

| | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- |
| Preis | $0 | $9 pro Monat oder $86,40 pro Jahr | $29 pro Monat oder $278,40 pro Jahr | nach Vertrag |
| Bins gleichzeitig | 1 | 5 | 25 | 250 |
| Aufgezeichnete Requests pro Monat | 1.000 | 25.000 | 250.000 | 5.000.000 |
| Weitere Requests, mit [Guthaben](#credit) gekauft | 10.000 für $4 | 10.000 für $4 | 10.000 für $4 | nach Vertrag |
| Gespeichert für (Aufbewahrung) | 1 Tag | 7 Tage | 30 Tage | 90 Tage |
| Lebensdauer eines Bins | 24 Stunden | bis zum Löschen oder bis zu 7 Tage, wenn Sie eine festlegen | bis zum Löschen oder bis zu 30 Tage | bis zum Löschen oder bis zu einem Jahr |
| Lesen über die API | nein (nur Konsole) | ja | ja | ja |
| [Weiterleitung](/docs/product-bins/forwarding), pro Bin | nein | 60 Requests pro Minute | 300 Requests pro Minute | 600 Requests pro Minute |
| Verschiedene Absender pro Bin | 50 | 200 | 500 | 2.000 |
| Formular-Posts aus Browsern pro Bin | 3 | 5 | 5 | 10 |

Free reicht, um genau zu sehen, was eine App, ein Skript oder ein Dienst sendet: ein Bin, 1.000 Requests pro Monat, gelesen in der Konsole.

Der Monat ist ein Kalendermonat in UTC, und jeder Request, den ein Bin aufzeichnet, zählt. Gehen die Requests des Monats zur Neige, werden mit dem Guthaben Ihres Workspaces weitere gekauft, sofern Sie das nicht ausschalten ([Weitere Requests mit Guthaben](#credit)). Ohne Guthaben antworten Bins, sobald die Requests des Monats aufgebraucht sind, weiter mit `200` und zeichnen nichts auf, bis der nächste Monat beginnt; so abgewiesene Requests zählen nicht. Ein einzelner Bin darf nur einen Teil der Requests des Monats verbrauchen, gekaufte Requests eingeschlossen — in Free alle, in Starter die Hälfte, in Pro 40 % und in Custom ein Viertel —, damit eine viel genutzte oder geleakte URL nicht die Requests der anderen Bins im Workspace aufbrauchen kann.

Die letzten beiden Zeilen sind Limits gegen Missbrauch, beschrieben unter [Gesperrte Bins](#suspended).

### Weitere Requests mit Guthaben {#credit}

Guthaben ist ein Betrag, den Ihr Workspace bereithält und den NimbusNexus-Produkte ausgeben, wenn ihr Monat aufgebraucht ist. Sie laden es in der [Kontokonsole]({{ACCOUNT_BASE_URL}}/billing#credit) unter **Billing** auf, wo Sie auf der Karte **Credit** außerdem für jedes Produkt die Nutzung des Guthabens ein- oder ausschalten. Für Request Bins ist sie eingeschaltet, bis Sie sie ausschalten.

Sind 90 % der Requests des Monats verbraucht und weniger als 10.000 übrig, kauft Request Bins in Free, Starter und Pro mit Guthaben 10.000 weitere für $4, solange das Guthaben reicht. In Custom gibt es weitere Requests nach Vertrag. Gekaufte Requests gelten für den Rest des Monats, den Anteil jedes Bins eingeschlossen, und verfallen, wenn der Monat endet: Ein teilweise genutzter Block wird nicht erstattet. Details finden Sie in der [Referenz](/docs/product-bins/reference#credit).

## Gesperrte Bins {#suspended}

Eine Bin-URL ist öffentlich: Wer sie kennt, kann an sie senden. Damit wäre ein Bin ein bequemer Ort, um zu sammeln, was das Formular einer Phishing-Seite übermittelt, oder Daten, die von fremden Rechnern abgegriffen wurden. Deshalb wird ein Bin gesperrt, wenn sein Traffic danach aussieht:

- er erhält Requests von mehr verschiedenen Adressen, als der Tarif bei **Verschiedene Absender** zulässt; oder
- er erhält mehr Formular-Posts von Webbrowsern, als der Tarif bei **Formular-Posts aus Browsern** zulässt, von mindestens drei Adressen.

Ein gesperrter Bin antwortet weiter mit `200` und zeichnet nichts auf. Die Konsole nennt den Grund, ebenso `suspended_code` in der API. Eine Sperrung setzen wir, sie ist nicht Ihr Schalter: Wenn Sie den Bin aktivieren, hebt das die Sperrung nicht auf. Wenden Sie sich daher an den Support, wenn Sie eine Sperrung für einen Fehler halten. Bins werden außerdem zurückgehalten, ohne gelöscht zu werden, wenn der Workspace nach einem Tarifwechsel mehr Bins hat, als der neue Tarif erlaubt, und solange der Workspace wegen einer offenen Zahlung gesperrt ist; jeder Bin kommt zurück, sobald seine Ursache behoben ist.

Um eine missbrauchte Bin-URL zu melden, schreiben Sie mit der vollständigen URL an `abuse@nnbin.net`.

## Zugang erhalten {#access}

Öffnen Sie die Konsole unter `https://bins.nimbusnexus.net` und melden Sie sich mit Ihrem NimbusNexus-Konto an, oder fügen Sie Request Bins in einer beliebigen NimbusNexus-Konsole über **Add a product** hinzu. Beim ersten Besuch eines Owners oder Admins des Workspaces wird Request Bins zum Workspace hinzugefügt; andere Mitglieder können es ab dann öffnen. Ein persönlicher Workspace beginnt mit Free, ein Team-Workspace mit einer 7-tägigen Testphase im Tarif Starter.

Die Request-Bins-API stellt keine Keys aus. Erstellen Sie einen in Ihrer [Kontokonsole]({{ACCOUNT_BASE_URL}}/api-keys?product=bins) unter **API keys**, mit **Request Bins** als Produkt. Ein Key ist ein JWT und beginnt deshalb mit `eyJ`. Senden Sie ihn als `Authorization: Bearer <key>` oder `X-API-Key: <key>`.

Wählen Sie beim Erstellen seine Berechtigung: **Read** liest Bins und das, was sie aufgezeichnet haben, und **Read & write** kann Bins außerdem anlegen, ändern, leeren und löschen. In Free kann ein Key Bins verwalten, aber um über die API zu lesen, was sie aufgezeichnet haben, brauchen Sie Starter oder höher; die Konsole liest es in jedem Tarif. Die vollständige Tabelle, einschließlich der Workspace-Rollen, finden Sie unter [Wer was darf](/docs/product-bins/reference#authority).

## Was das Produkt nicht tut {#not}

- **Es antwortet nicht mit einer Antwort Ihrer Wahl.** Jeder Bin antwortet mit `200` und `{"status":"accepted"}`; einen Status, Header oder Body Ihrer Wahl zurückzugeben ist nicht umgesetzt.
- **Es spielt nichts erneut ab.** Ein aufgezeichneter Request lässt sich nicht auf Wunsch erneut senden. Die [Weiterleitung](/docs/product-bins/forwarding) sendet jeden Request einmal weiter, sobald er ankommt.
- **Es liefert nichts per Push aus.** Es gibt keinen Stream und keinen Callback: Fragen Sie `GET /v1/bins/{id}/requests` mit `since` ab, wie es die Konsole alle 3 Sekunden tut.
- **Es ist kein Archiv.** Ein Request wird gelöscht, wenn die Aufbewahrung des Tarifs abläuft, und alles in einem Bin verschwindet, wenn der Bin gelöscht wird oder abläuft.
- **Es teilt einen Workspace nicht nach Projekten auf.** Request Bins bedient ganze Workspaces, daher werden Gastzugänge und Keys, die auf ein Projekt beschränkt sind, abgewiesen.

## Nächste Schritte {#next-steps}

- [Schnellstart](/docs/product-bins/quickstart) — einen Bin anlegen, ihm einen Request senden, ihn zurücklesen.
- [Weiterleitung](/docs/product-bins/forwarding) — jeden Request an Ihren eigenen Server weiterleiten und sehen, was er geantwortet hat.
- [Referenz für Request Bins](/docs/product-bins/reference) — jede Route und jedes Feld, was eine Bin-URL antwortet, Rollen, Scopes und Limits.
- [Request-Bins-API](/docs/reference/bins) — jede Operation, mit dem Request in curl, TypeScript, Python oder Go.
- [Fehler](/docs/errors) — das Fehlerformat und die Codes, die die API sendet.
