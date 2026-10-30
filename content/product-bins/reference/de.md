---
title: "Referenz für Request Bins"
description: "Jede Route der Request-Bins-API, was eine Bin-URL antwortet und aufzeichnet, wer was darf und die Limits jedes Tarifs."
publishedAt: 2026-10-22
updatedAt: 2026-10-30
kind: reference
---

# Referenz für Request Bins

Request Bins hat zwei Seiten. **Bin-URLs** auf `nnbin.net` nehmen Requests von jedem an und zeichnen sie auf. **Die API** unter `https://bins.nimbusnexus.net/v1` legt Bins an, verwaltet sie und liest, was sie aufgezeichnet haben, nur für Ihren Workspace. Diese Seite behandelt beides, danach, wer was darf, und die Limits jedes Tarifs. Der [Überblick](/docs/product-bins) erklärt das Produkt, und der [Schnellstart](/docs/product-bins/quickstart) führt Schritt für Schritt hindurch.

## Bin-URLs {#edge}

| | |
| --- | --- |
| URL | `https://nnbin.net/b/<slug>` und jeder Pfad darunter: `https://nnbin.net/b/<slug>/<anything>` |
| Slug | 12 Zeichen: die Buchstaben `a`–`z` außer `l` und `o` sowie die Ziffern `2`–`9`. Groß- und Kleinschreibung spielt keine Rolle. |
| Methoden | Jede: `GET`, `POST` und die anderen gängigen, `PROPFIND` oder `COPY` von WebDAV oder eigene Methoden eines Absenders. Eine Methode wird in Großbuchstaben aufgezeichnet und nach 16 Zeichen abgeschnitten. `TRACE` und `CONNECT` werden vor dem Bin abgewiesen und nie aufgezeichnet. |
| Aufgezeichneter Pfad | Alles nach dem Slug, wie gesendet, mit erhaltener Prozentkodierung: `/b/<slug>/stripe/events` zeichnet `/stripe/events` auf und `/b/<slug>` zeichnet `/` auf. |
| Aufgezeichnete Query | Der Query-String wie gesendet, ohne das `?`. |

### Was eine Bin-URL antwortet {#edge-answers}

| Status | Body | Wann |
| --- | --- | --- |
| `200` | `{"status":"accepted"}` | Jeder Request an einen wohlgeformten Slug, ob aufgezeichnet oder nicht, sofern keine der Zeilen darunter zutrifft. Ein Bin, der nicht existiert, gelöscht wurde, abgelaufen ist, deaktiviert oder gesperrt ist oder die monatlichen Requests seines Tarifs überschritten hat, antwortet genauso. |
| `429` | `{"status":"rate_limited"}`, mit `Retry-After: 30` | Die sendende Adresse liegt über 120 Requests pro Minute an Bin-URLs, oder der Bin liegt über 600 pro Minute von allen seinen Absendern zusammen. Wird geprüft, bevor der Body gelesen wird; nichts wird aufgezeichnet oder gezählt. |
| `503` | `{"status":"unavailable"}`, mit `Retry-After: 30` | Der Request konnte gerade nicht gespeichert werden. Nichts wird aufgezeichnet; senden Sie ihn erneut. |
| `404` | keiner | Der Slug kann keiner sein, den Request Bins je vergeben hat: Er hat die falsche Länge oder ein Zeichen außerhalb des Slug-Alphabets. |

Die Antwort `200` ist absichtlich für jedes Ergebnis gleich. Ein Absender, der einen Fehler erhält, stellt das Senden womöglich ein oder schaltet seinen Webhook ab, und eine andere Antwort für einen aktiven Bin würde es jedem ermöglichen, gezielt nach Bins zu suchen. Ob ein Request aufgezeichnet wurde, liest der Inhaber des Bins in der API oder der Konsole, nie der Absender.

Eine Antwort `200` enthält den Header `X-Request-ID`, und das Feld `request_id` des erfassten Requests enthält denselben Wert, sodass sich eine Logzeile des Absenders dem zuordnen lässt, was der Bin aufgezeichnet hat.

### Was ein Bin aufzeichnet {#edge-records}

- **Body:** Ein Body beliebiger Größe wird angenommen. Seine volle Größe wird in `size_bytes` gezählt, und sein erstes 1 MiB wird gespeichert, sodass ein Body bis 1 MiB vollständig gespeichert wird. `truncated` ist `true`, wenn der Body über 1 MiB groß war, und der gespeicherte Body ist dann kürzer als `size_bytes`. Der Body wird als genau die Bytes gespeichert, die angekommen sind, nie geparst oder verändert.
- **Header:** in der Reihenfolge ihres Eintreffens, Duplikate erhalten, bis zu 256 Stück; ein Name wird nach 256 Zeichen abgeschnitten, ein Wert nach 8.192. Die Werte von `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` und `X-API-Key` werden durch `[redacted]` ersetzt, bevor etwas gespeichert wird. Alle anderen Header bleiben so erhalten, wie sie gesendet wurden.
- **Pfad:** nach 2.048 Zeichen abgeschnitten.
- **Inhaltstyp:** der Header `Content-Type`, als `content_type`.
- **Quelladresse:** die Adresse, die den Request gesendet hat, als `source_ip`.

### Jeder Request ist eine Zeile {#edge-repeats}

Jeder Request wird als eigene Zeile gespeichert. Ein erneut gesendeter Request ist eine neue Zeile mit eigenen Headern, eigener Quelladresse, eigenem Zeitpunkt und eigener `request_id`, auch wenn er dieselbe Methode, denselben Pfad, denselben Query-String und denselben Body hat wie einer, den der Bin bereits enthält. Er zählt wie jeder andere zu den Requests des Monats. So erscheinen die Retries eines Anbieters einzeln, jeder mit eigener Signatur und eigenem Timestamp. `seen_count` ist bei jeder neuen Zeile `1`. Ein Request, der vor dem 25.10.2026 gespeichert wurde, kann abweichen, bis seine Aufbewahrung abläuft: Sein Body wurde möglicherweise nach 64 KiB abgeschnitten, und sein `seen_count` zählt möglicherweise jedes Eintreffen desselben Requests.

### Wenn nichts aufgezeichnet wird {#edge-refusals}

Der Absender erhält in jedem der folgenden Fälle `200`. Was der Bin anzeigt:

| Der Bin | Was der Bin anzeigt |
| --- | --- |
| existiert nicht, wurde gelöscht oder ist abgelaufen | — |
| ist deaktiviert (`status` `disabled`) | — |
| ist gesperrt | — |
| gehört zu einem Workspace, der wegen einer offenen Zahlung gesperrt ist | `refused_count` steigt; `last_refused_reason` ist `workspace_suspended` |
| hat die Requests des Monats oder seinen eigenen Anteil daran überschritten | `refused_count` steigt; `last_refused_reason` ist `quota_exceeded` |

`last_refused_summary` zeigt den letzten abgewiesenen Request als `METHOD /path` und `last_refused_at`, wann er kam. Abgewiesene Requests zählen nicht zum Monat.

### Sperrung {#suspension}

Zwei Schwellen sperren einen Bin, dessen Traffic eher nach dem Sammeln von Daten Fremder aussieht als nach wenigen bekannten Absendern:

- **Verschiedene Absender:** Ein Bin hat Requests von mehr verschiedenen Adressen erhalten, als der Tarif erlaubt: 50 in Free, 200 in Starter, 500 in Pro und 2.000 in Custom.
- **Formular-Posts aus Browsern:** Ein Request mit einem Browser-Header (`Origin`, `Referer`, `Sec-Fetch-Site` oder `Sec-Fetch-Mode`) und einem Content-Type für Formulare (`application/x-www-form-urlencoded` oder `multipart/form-data`) ist ein Formular-Post aus einem Browser. Ein Bin, der mehr davon erhält, als der Tarif erlaubt (3 in Free, 5 in Starter und Pro, 10 in Custom), von mindestens drei Adressen, wird gesperrt. `browser_post_count`, `last_browser_form_origin` und `last_browser_form_at` zeigen, was er gesehen hat.

Der Request, der eine Schwelle auslöst, wird noch aufgezeichnet, die danach nicht mehr. Ein gesperrter Bin antwortet mit `200` und zeichnet nichts auf, unabhängig von seinem `status`. `suspended_code` nennt den Grund:

| `suspended_code` | Grund | Aufgehoben |
| --- | --- | --- |
| `source_fanout` | Die Schwelle für verschiedene Absender | Von NimbusNexus; wenden Sie sich an den Support |
| `browser_posts` | Die Schwelle für Formular-Posts aus Browsern | Von NimbusNexus; wenden Sie sich an den Support |
| `abuse` | NimbusNexus hat ihn nach einer Meldung gesperrt | Von NimbusNexus |
| `non_payment` | Der Workspace ist wegen einer offenen Zahlung gesperrt | Wenn die Zahlung beglichen ist |
| `plan_downgrade` | Der Tarif erlaubt weniger Bins, als der Workspace hat, und dieser ist einer der neuesten | Wenn der Tarif ihn wieder erlaubt, älteste Bins zuerst |

Behandeln Sie `suspended_code` als offenen String und sehen Sie einen Standardfall für Werte vor, die Sie nicht kennen; `suspended_reason` sagt dasselbe in Worten. Ein Bin kann aus mehreren Gründen gleichzeitig gesperrt sein, und jede Sperrung wird einzeln aufgehoben: Das Begleichen einer Zahlung hebt nie eine Sperrung wegen Missbrauchs auf, und das Aufheben einer Sperrung bringt nie einen Bin zurück, den der Tarif nicht mehr erlaubt.

Um eine missbrauchte Bin-URL zu melden, schreiben Sie mit der vollständigen URL an `abuse@nnbin.net`. Die Seite unter `https://nnbin.net/` sagt dasselbe.

### Browser {#edge-browsers}

Bin-URLs senden keine CORS-Header. Eine Webseite kann einem Bin einen einfachen Request senden, etwa einen Formular-Post, aber die Antwort nicht lesen, und ein Request, der einen Preflight braucht, endet bei seinem `OPTIONS`, das der Bin dann aufzeichnet. `robots.txt` bittet Suchmaschinen, Bin-URLs nicht zu crawlen.

## Die API {#api}

Die Basis-URL ist `https://bins.nimbusnexus.net/v1`. Requests und Antworten sind JSON. Senden Sie einen Key als `Authorization: Bearer <key>` oder `X-API-Key: <key>` ([Zugang erhalten](/docs/product-bins#access)). Timestamps sind ISO 8601 in UTC, und einer, den Sie ohne Offset senden, wird als UTC gelesen. Fehler verwenden das Format aus [Fehler](/docs/errors).

| Route | Was sie tut | Benötigt |
| --- | --- | --- |
| `POST /v1/bins` | Einen Bin anlegen; `201` mit [dem Bin](#bin) | write |
| `GET /v1/bins` | Die Bins des Workspaces, neueste zuerst; `url` oder `slug` findet einen bestimmten | read |
| `GET /v1/bins/{id}` | Ein Bin | read |
| `PATCH /v1/bins/{id}` | Einen Bin umbenennen, deaktivieren und aktivieren oder seine [Weiterleitungs-URL](#forwarding) festlegen | write |
| `POST /v1/bins/{id}/forward-test` | Einen [Test](#forward-test) an die Weiterleitungs-URL des Bins senden und zurückgeben, was sie geantwortet hat | write |
| `DELETE /v1/bins/{id}` | Einen Bin löschen; `204` | admin |
| `GET /v1/bins/{id}/requests` | Die [erfassten Requests](#requests) eines Bins, neueste zuerst | read; mit einem Key ein bezahlter Tarif |
| `GET /v1/requests` | Die [erfassten Requests](#all-requests) aller Bins in einer Liste, neueste zuerst | read; mit einem Key ein bezahlter Tarif |
| `GET /v1/bins/{id}/paths` | Die Requests eines Bins, [nach Pfad gruppiert](#paths) | read; mit einem Key ein bezahlter Tarif |
| `GET /v1/requests/{id}` | Ein erfasster Request vollständig, mit seinen [Weiterleitungen](#forwards) | read; mit einem Key ein bezahlter Tarif |
| `DELETE /v1/bins/{id}/requests` | Einen Bin leeren; `200` mit `{"deleted": <count>}` | admin |
| `GET /v1/plan` | Der Tarif des Workspaces und seine Limits | read |
| `GET /v1/usage` | Die Requests dieses Monats und die vorhandenen Bins, gemessen am Tarif | read |

**read**, **write** und **admin** sind unter [Wer was darf](#authority) erklärt.

### Bin anlegen {#create}

`POST /v1/bins` erwartet einen JSON-Body, `{}`, wenn Sie nichts festlegen:

| Feld | Bedeutung |
| --- | --- |
| `label` | Ihr Name für den Bin, bis zu 200 Zeichen. Absender sehen ihn nie. |
| `expires_in_minutes` | Wie lange der Bin lebt: 1 bis 525.600 (ein Jahr). Ohne das Feld gilt der Standard des Tarifs: 24 Stunden in Free, bis zum Löschen in bezahlten Tarifen. Eine Lebensdauer, die länger ist, als der Tarif erlaubt, wird auf dessen Maximum gekürzt, nicht abgewiesen: 24 Stunden in Free, 7 Tage in Starter, 30 Tage in Pro und ein Jahr in Custom. `expires_at` in der Antwort zeigt das Ergebnis. |

Die Lebensdauer eines Bins lässt sich nach dem Anlegen nicht ändern. Hat der Workspace bereits so viele Bins, wie sein Tarif erlaubt, lautet die Antwort `402` `quota_exceeded`, mit `details.metric` `bins`, `details.limit` und `details.current`. Bins, die wegen eines Downgrades zurückgehalten werden, zählen nicht.

### Bin finden {#list}

`GET /v1/bins` listet die Bins des Workspaces auf, neueste zuerst. Mit `url` (einer Bin-URL, mit oder ohne Pfad nach dem Slug) oder `slug` (in beliebiger Groß- und Kleinschreibung) liefert es genau diesen Bin oder eine leere Liste. Gelöschte und abgelaufene Bins werden nie aufgelistet, und das Lesen eines solchen Bins antwortet mit `404`.

Listen werden mit `limit` (1 bis 200, Standard 50) und `offset` (0 bis 10.000) paginiert. Die Antwort ist `{"items": [...], "next_offset": <offset>}`: Übergeben Sie `next_offset` als `offset`, um die nächste Seite zu erhalten. Auf der letzten Seite und jenseits von Offset 10.000 ist der Wert `null`.

### Das Bin-Objekt {#bin}

| Feld | Bedeutung |
| --- | --- |
| `id` | `bin_` und 24 Hexadezimalzeichen. Jede Route erwartet sie. |
| `slug` | Der Teil der URL nach `/b/`. |
| `url` | Die URL, die Sie Absendern geben. |
| `label` | Ihr Name für den Bin. |
| `status` | `enabled` oder `disabled`: Ihr Schalter. Ein deaktivierter Bin antwortet Absendern und zeichnet nichts auf. |
| `expires_at` | Wann der Bin endet, oder `null`, wenn er bis zum Löschen lebt. |
| `created_at` | Wann er angelegt wurde. |
| `suspended` | `true`, solange NimbusNexus den Bin abgeschaltet hat ([Sperrung](#suspension)). |
| `suspended_code`, `suspended_reason` | Der Grund, als Kennwort und in Worten; leer, wenn der Bin nicht gesperrt ist. |
| `refused_count` | Requests, die beantwortet und nicht aufgezeichnet wurden, weil der Workspace seine Requests überschritten hatte oder gesperrt war. |
| `last_refused_summary`, `last_refused_reason`, `last_refused_at` | Der letzte davon, als `METHOD /path`; `quota_exceeded` oder `workspace_suspended`; und wann er kam. |
| `browser_post_count` | Formular-Posts aus Browsern, die der Bin erhalten hat. |
| `last_browser_form_origin`, `last_browser_form_at` | Die Seite, die den letzten gesendet hat, und wann. |
| `request_count` | Requests, die aufgezeichnet wurden, seit der Bin angelegt oder zuletzt geleert wurde. |
| `last_request_at` | Wann der letzte ankam, oder `null`. |
| `period_requests` | Die für den Bin gezählten Requests dieses Monats, gemessen an `bin_request_ceiling` in [`GET /v1/usage`](#plan). |
| `forward_url` | Wohin der Bin jeden aufgezeichneten Request [weiterleitet](#forwarding), oder `null`, wenn er nicht weiterleitet. |
| `forward_paused_at`, `forward_paused_reason` | Wann die Weiterleitung nach fehlgeschlagenen Sendeversuchen [pausierte](/docs/product-bins/forwarding#paused), und warum: `failed_in_a_row` oder `failing_for_an_hour`. `null` und leer, solange sie nicht pausiert ist. |
| `forward_last_error`, `forward_last_error_at` | Der letzte fehlgeschlagene Sendeversuch: was schiefging, etwa `HTTP 503` oder ein Timeout, nie, was der Request enthielt; und wann. |

### Bin ändern oder löschen {#change}

`PATCH /v1/bins/{id}` erwartet `label`, `status` (`enabled` oder `disabled`), `forward_url` ([Weiterleitung](#forwarding)) oder eine beliebige Kombination davon und antwortet mit dem Bin. Deaktivieren beendet das Aufzeichnen und behält, was der Bin enthält. Ein deaktivierter Bin zählt weiterhin zu den Bins des Tarifs.

Wo `status` jetzt `enabled` ist, war es früher `active`, und keine Antwort enthält mehr `active`. `PATCH` akzeptiert weiterhin `"status": "active"`, und der Bin kommt als `enabled` zurück, aber diese Schreibweise ist als veraltet markiert und wird ab einem Datum, das noch angekündigt wird, abgewiesen. Senden Sie daher `enabled`.

In der Konsole enthält das Menü ⋯ auf der Seite eines Bins **Rename…**, **Disable** oder **Enable**, **Empty bin…** und **Delete bin…**, und die Weiterleitung legen Sie auf seiner Karte **Forwarding** fest. Die Seite eines deaktivierten Bins weist darauf hin, mit einer Schaltfläche **Enable**.

`DELETE /v1/bins/{id}` löscht einen Bin endgültig. Seine URL hört sofort auf aufzuzeichnen, auch wenn Absender weiterhin `200` erhalten; sein Slug wird nie wieder vergeben, weder an Sie noch an jemand anderen; und was er aufgezeichnet hat, wird kurz danach gelöscht. Sein Platz unter den Bins des Tarifs wird sofort frei.

`DELETE /v1/bins/{id}/requests` leert einen Bin: Jeder Request darin wird gelöscht, und `request_count` geht auf `0` zurück. Der Bin behält seine URL und zeichnet weiter auf.

### Erfasste Requests {#requests}

`GET /v1/bins/{id}/requests` listet die Requests eines Bins auf, neueste zuerst, und `GET /v1/requests` listet die Requests [aller Bins](#all-requests) in einer Liste auf. Beide akzeptieren diese Parameter:

| Parameter | Bedeutung |
| --- | --- |
| `since` | Nur Requests, die nach diesem Zeitpunkt eingegangen sind. Übergeben Sie das neueste `received_at`, das Sie gesehen haben, um neue abzufragen. |
| `until` | Nur Requests, die zu oder vor diesem Zeitpunkt eingegangen sind: der Weg zurück durch ältere. |
| `method` | Nur Requests, die mit dieser Methode gesendet wurden, in beliebiger Schreibweise. Wiederholen Sie den Parameter für mehrere Methoden: `?method=PUT&method=DELETE`. |
| `path` | Nur Requests, die an genau diesen Pfad gesendet wurden: was auf den Slug folgte, ab dem `/`, ohne den Query-String, so wie die Liste ihn anzeigt. Groß- und Kleinschreibung spielt eine Rolle. [Requests nach Pfad](#paths) listet die Pfade eines Bins auf. |
| `q` | Nur Requests, die diesen Text enthalten, bis zu 200 Zeichen, ohne Beachtung der Groß- und Kleinschreibung: im Pfad und Query-String wie gesendet (`/orders?id=42`), in einem Header als `name: value` oder im gespeicherten Body. Ein Body, der kein UTF-8-Text ist, wird so durchsucht, dass jedes Byte über 127 (und NUL) als `\` mit drei Oktalziffern geschrieben und ein Backslash verdoppelt wird. |
| `in` | Wo `q` sucht: `all`, der Standard, oder nur `path` (Pfad und Query-String), `headers` (jeder Header als `name: value`) oder `body`. |
| `header` | Nur die Werte dieses Headers, mit dem Namen in beliebiger Schreibweise, und jeder davon, wenn der Header mehrmals gesendet wurde. Ohne `q` jeder Request, der den Header enthält. Der Parameter passt zu `in` `all` oder `headers`. |
| `field` | Nur dieses Feld eines JSON-Bodys, angegeben als `data.object.id` oder `items[0].sku`: Ein String wird so durchsucht, wie er ist, eine Zahl so, wie JSON sie schreibt, ein Objekt oder Array als JSON-Text. Ohne `q` jeder Request, dessen Body das Feld hat. Ein Body, der kein JSON ist oder bei 1 MiB abgeschnitten wurde, hat keine Felder. Der Parameter passt zu `in` `all` oder `body` und nicht zu `header`. |
| `limit`, `offset` | Paginierung wie bei Bins. Jenseits von Offset 10.000 grenzen Sie das Fenster stattdessen mit `until` ein. |

Eine Suche mit `header` oder `field` und einem anderen `in` oder mit `header` und `field` zugleich wird mit einem `422` `validation_error` abgewiesen, dessen Eintrag den Typ `bins.search_conflict` hat.

Eine Suche (`q`, `header` oder `field`) paginiert anders als der Rest. Sie liest die Requests der Liste vom neuesten an und stoppt, sobald sie `limit` Treffer hat oder 16 MiB an Requests (oder 5.000 davon) gelesen hat, je nachdem, was zuerst eintritt. Eine Seite kann daher weniger Treffer als `limit` enthalten oder gar keine, während ältere Requests noch ungelesen sind. Die Seite einer Suche hat `next_offset` `null` und, bis die Suche den ältesten Request der Liste gelesen hat, ein `next_until`: Übergeben Sie es als `until`, mit derselben Suche und denselben Werten für `method`, `path` und `since`, um dort weiterzusuchen, wo die Suche aufgehört hat. Mit einer Suche überspringt `offset` so viele Requests, bevor die Suche zu lesen beginnt.

```json
{
  "items": [],
  "next_offset": null,
  "next_until": "2026-10-23T14:02:11.408211+00:00"
}
```

Jeder Eintrag:

| Feld | Bedeutung |
| --- | --- |
| `id` | `req_` und 24 Hexadezimalzeichen. |
| `bin_id` | Der Bin, an den er ging. |
| `method` | Die HTTP-Methode. |
| `path` | Was auf den Slug folgte, wie gesendet; `/` für die bloße Bin-URL. |
| `query` | Der Query-String wie gesendet, ohne das `?`; leer, wenn es keinen gab. |
| `source_ip` | Die Adresse, von der er kam. |
| `content_type` | Sein Header `Content-Type`, oder leer. |
| `size_bytes` | Die volle Größe des Bodys, wie gesendet. |
| `truncated` | `true`, wenn der Body über 1 MiB groß war, sodass nur sein erstes 1 MiB gespeichert ist. |
| `seen_count` | `1`: Jeder Request ist eine [eigene Zeile](#edge-repeats). |
| `received_at` | Wann er ankam. |
| `expires_at` | Wann er gelöscht wird: wenn die Aufbewahrung des Tarifs ab `received_at` abläuft, oder zum `expires_at` des Bins, falls das früher ist. |

`GET /v1/requests/{id}` liefert einen Request mit allen obigen Feldern und zusätzlich:

| Feld | Bedeutung |
| --- | --- |
| `headers` | Objekte mit `name` und `value`, in der Reihenfolge des Eintreffens, Duplikate erhalten, Credentials als `[redacted]`. |
| `body_base64` | Der gespeicherte Body, base64-kodiert, weil er kein Text sein muss: höchstens 1 MiB. |
| `request_id` | Die ID, die die Bin-URL diesem Request gegeben hat; das ist die `X-Request-ID`, die sein Absender zurückbekam. |
| `forwards` | Was aus seinen [Weiterleitungen](#forwards) wurde, die neueste zuerst; leer, wenn sein Bin beim Eintreffen nicht weiterleitete. |

Mit einem API-Key brauchen `GET /v1/bins/{id}/requests`, `GET /v1/requests` und `GET /v1/requests/{id}` einen bezahlten Tarif: In Free antworten sie mit `402` `not_entitled`, mit `details.feature` `read_api`. Die Konsole liest sie in jedem Tarif. Ein Request nach seinem `expires_at` oder in einem Bin, der geleert oder gelöscht wurde oder abgelaufen ist, antwortet mit `404`.

### Requests aller Bins {#all-requests}

`GET /v1/requests` listet die Requests aller Bins des Workspaces in einer Liste auf, neueste zuerst. Die Route akzeptiert die oben beschriebenen Parameter der Liste eines Bins und paginiert genauso, über `next_offset` oder bei einer Suche über `next_until`. Ihre Einträge sind die Einträge der Liste eines Bins, jeder mit der `bin_id` des Bins, an den er ging; um neben jedem die Bezeichnung oder URL seines Bins anzuzeigen, gleichen Sie `bin_id` mit `GET /v1/bins` ab.

Die Liste enthält die Requests der Bins, die noch existieren. Die Requests eines gelöschten oder abgelaufenen Bins verschwinden sofort daraus, und die eines deaktivierten oder gesperrten Bins bleiben, so wie sie in der eigenen Liste dieses Bins bleiben. Die Seite **All bins** in der Konsole zeigt diese Liste, mit derselben Suche und denselben Methodenfiltern wie die Seite eines Bins und ohne **By path**.

### Requests nach Pfad {#paths}

`GET /v1/bins/{id}/paths` gruppiert die neuesten 10.000 Requests eines Bins nach Pfad, zuletzt verwendete Pfade zuerst. Der Query-String bleibt außen vor, daher sind `/orders?id=1` und `/orders?id=2` ein Pfad. Pfade werden dagegen so verglichen, wie sie gesendet wurden, daher sind `/users/1` und `/users/2` zwei. `method` berücksichtigt nur die angegebenen Methoden, wie bei der Liste der Requests, und `limit` und `offset` paginieren wie bei Bins.

```json
{
  "items": [
    {
      "path": "/stripe/events",
      "requests": 42,
      "methods": ["POST", "GET"],
      "last_received_at": "2026-10-26T09:12:04Z"
    }
  ],
  "next_offset": null,
  "counted": 57,
  "capped": false
}
```

| Feld | Bedeutung |
| --- | --- |
| `path` | Was auf den Slug folgte, ohne den Query-String. |
| `requests` | Wie viele der gezählten Requests an diesen Pfad gesendet wurden. |
| `methods` | Die Methoden, mit denen sie gesendet wurden, die meistgenutzte zuerst. |
| `last_received_at` | Wann der letzte davon ankam. |

`counted` gibt an, wie viele Requests gruppiert wurden, und `capped` ist `true`, wenn der Bin mehr enthält, sodass ältere Pfade und Zählungen fehlen. Weil nur die neuesten 10.000 gezählt werden, ist ein Aufruf bei einem Bin mit Millionen Requests so schnell wie bei einem mit zehn. Um die Requests eines Pfads aufzulisten, übergeben Sie ihn als `path` an `GET /v1/bins/{id}/requests`. Mit einem API-Key braucht die Route einen bezahlten Tarif, wie die Routen für Requests.

In der Konsole zeigt **By path** über der Liste eines Bins dieselben Gruppen, alle 10 Sekunden aktualisiert und nach den Methoden-Chips gefiltert. Die Auswahl eines Pfads listet dessen Requests auf, wobei der Pfad als Chip über der Liste erscheint; wenn Sie den Chip entfernen, werden wieder alle Requests aufgelistet.

### Weiterleitung {#forwarding}

Ein Bin in Starter, Pro oder Custom kann jeden Request, den er aufzeichnet, an eine Ihrer https-URLs weiterleiten. [Weiterleitung](/docs/product-bins/forwarding) behandelt, was gesendet wird, die Retries, die Limits und wann die Weiterleitung pausiert; dieser Abschnitt behandelt die API.

`PATCH /v1/bins/{id}` mit `forward_url` legt die URL fest, und `null` oder `""` beendet die Weiterleitung. Wenn Sie eine URL erneut festlegen, auch dieselbe, wird die [pausierte](/docs/product-bins/forwarding#paused) Weiterleitung eines Bins fortgesetzt, und die Zählung seiner fehlgeschlagenen Sendeversuche beginnt von vorn. In Free lautet die Antwort `402` `not_entitled`, mit `details.feature` `forwarding`. Eine URL, an die ein Bin nicht weiterleitet, ergibt ein `422` `validation_error`, dessen Eintrag den Typ `bins.forward_target`, den `loc` `["body", "forward_url"]` und einen `params.reason` hat:

| `reason` | Grund |
| --- | --- |
| `scheme` | Die URL ist nicht `https`. |
| `credentials` | Die URL enthält einen Benutzernamen oder ein Passwort. |
| `host` | Die URL hat keinen Host, oder ihr Host ist kein gültiger Name. |
| `port` | Der Port der URL liegt nicht zwischen 1 und 65535. |
| `length` | Die URL ist länger als 2.048 Zeichen. |
| `own_domain` | Der Host ist `nnbin.net`, `nimbusnexus.net` oder ein Name darunter, oder er löst auf eine unserer eigenen Adressen auf. |
| `not_public` | Der Host löst nicht auf, oder er löst auf eine Adresse auf, die nicht öffentlich ist, etwa eine private, eine Loopback- oder eine Link-Local-Adresse. |
| `missing` | Ein Test für einen Bin ohne Weiterleitungs-URL. |

Behandeln Sie `reason`, `forward_paused_reason` und den `reason` einer Weiterleitung als offene Strings und sehen Sie einen Standardfall für Werte vor, die Sie nicht kennen.

Wenn die Weiterleitung pausiert, wird der Workspace einmal benachrichtigt, per E-Mail und über einen Webhook mit dem Event-Typ `bind.forwarding.paused`; [Wenn die Weiterleitung pausiert](/docs/product-bins/forwarding#paused) zeigt den Body des Webhooks.

### Weiterleitungs-URL testen {#forward-test}

`POST /v1/bins/{id}/forward-test` erwartet keinen Body. Der Aufruf sendet sofort ein Test-Event an die Weiterleitungs-URL des Bins und antwortet mit `200` und dem, was zurückkam ([URL vorab prüfen](/docs/product-bins/forwarding#test) zeigt das Event):

| Feld | Bedeutung |
| --- | --- |
| `ok` | `true`, wenn Ihr Server mit `2xx` oder `3xx` geantwortet hat. |
| `answer` | Was Ihr Server geantwortet hat: `status`; `headers`, Objekte mit `name` und `value`, in der Reihenfolge, in der sie gesendet wurden; die ersten 8 KiB des Bodys als `body_base64`; und `truncated`, `true`, wenn der Body darüber hinausging. `null`, wenn keine Antwort kam. |
| `duration_ms` | Wie lange das Senden gedauert hat. |
| `error` | Warum keine Antwort kam, etwa ein Timeout oder eine abgelehnte Verbindung; leer, wenn eine kam. |

Der Aufruf wartet bis zu 13 Sekunden auf die Antwort; bei einem langsameren Server ist `ok` `false`, und ein `error` sagt das. Ein Bin kann 10 Tests pro Minute senden: Darüber hinaus lautet die Antwort `429` `rate_limited`, und `details.retry_after` gibt an, wie viele Sekunden es dauert, bis der nächste erlaubt ist. `503` `unavailable` mit `details.reason` `forwarder_unavailable` bedeutet, dass der Test nicht innerhalb von 3 Sekunden zum Senden übernommen wurde und daher nichts gesendet wurde: Versuchen Sie es in Kürze erneut. Eine URL, die sich beim Senden als nicht öffentlich erweist, wird mit dem `422` von oben abgewiesen.

### Die Weiterleitungen eines Requests {#forwards}

`GET /v1/requests/{id}` enthält `forwards`: was aus den Weiterleitungen des Requests wurde, die neueste zuerst, und leer, wenn sein Bin beim Eintreffen nicht weiterleitete. [Nachvollziehen, was passiert ist](/docs/product-bins/forwarding#forwards) zeigt eine davon vollständig. Jeder Eintrag:

| Feld | Bedeutung |
| --- | --- |
| `id` | `fwd_` und 24 Hexadezimalzeichen. |
| `state` | Der Stand der Weiterleitung, aus der Tabelle unten. |
| `reason` | Warum der Request nicht weitergeleitet wurde, wenn `state` `not_forwarded` ist; sonst leer. |
| `url` | Wohin sie geht: die Weiterleitungs-URL, wie sie beim Eintreffen des Requests lautete, ergänzt um Pfad und Query des Requests. |
| `attempts`, `max_attempts` | Die bisherigen Versuche und die Höchstzahl, die der Tarif erlaubte, als sie eingereiht wurde. |
| `next_attempt_at` | Wann der nächste Versuch fällig ist, solange `state` `retrying` ist; sonst `null`. |
| `last_error` | Was beim letzten Versuch schiefging, etwa `HTTP 503` oder ein Timeout, oder warum sie wartet; leer, sobald sie gesendet ist. |
| `answer` | Was Ihr Server beim letzten Versuch geantwortet hat, aufgebaut wie bei einem [Test](#forward-test). `null`, wenn dieser Versuch keine Antwort erhielt. |
| `duration_ms` | Wie lange der letzte Versuch gedauert hat; vor dem ersten `null`. |
| `created_at` | Wann sie eingereiht wurde. |
| `sent_at` | Wann sie gesendet wurde; bis dahin `null`. |

| `state` | Bedeutung |
| --- | --- |
| `queued` | Wartet auf den ersten Versuch. |
| `sending` | Ein Versuch läuft. |
| `sent` | Ihr Server hat mit `2xx` oder `3xx` geantwortet. |
| `retrying` | Ein Versuch ist fehlgeschlagen, und ein weiterer ist zu `next_attempt_at` fällig. |
| `failed` | Aufgegeben: Die Versuche des Tarifs sind aufgebraucht, oder ein Versuch endete auf eine Weise, die nicht wiederholt wird, etwa mit einem `404`. |
| `not_forwarded` | Aufgezeichnet und nie gesendet; `reason` nennt den Grund. |

| `reason` | Warum der Request nicht weitergeleitet wurde |
| --- | --- |
| `paused` | Die Weiterleitung war pausiert, als der Request ankam oder als er an der Reihe war. |
| `body_too_large` | Der Body ist größer, als der Tarif weiterleitet, oder war größer als 1 MiB. |
| `url_too_long` | Die Weiterleitungs-URL ist samt Pfad und Query des Requests länger als 8.192 Zeichen. |
| `queue_full` | 1.000 Weiterleitungen des Bins waren noch nicht abgeschlossen. |
| `forwarding_off` | Die Weiterleitung wurde beendet, bevor der Request an der Reihe war. |
| `bin_gone` | Der Bin wurde gelöscht oder ist abgelaufen, bevor der Request an der Reihe war. |
| `suspended` | Der Bin oder sein Workspace wurde gesperrt, bevor der Request an der Reihe war. |
| `not_entitled` | Der Tarif enthielt keine Weiterleitung mehr, bevor der Request an der Reihe war. |
| `request_gone` | Die Aufbewahrung des Requests ist abgelaufen, bevor er an der Reihe war. |

### Tarif und Verbrauch {#plan}

`GET /v1/plan` gibt an, welche Limits gelten:

```json
{
  "plan": "starter",
  "enforced_as": "starter",
  "ceilings": {
    "max_bins": 5,
    "monthly_requests": 25000,
    "retention_days": 7,
    "bin_ttl_minutes": 0,
    "bin_ttl_max_minutes": 10080,
    "read_api": 1,
    "bin_max_sources": 200,
    "bin_max_browser_posts": 5,
    "bin_share_pct": 50,
    "forwarding": 1,
    "forward_max_body_bytes": 262144,
    "forward_rate_per_min": 60,
    "forward_max_attempts": 3
  },
  "past_due": false,
  "suspended": false,
  "system": false
}
```

`plan` ist der hinterlegte Tarif, leer, wenn der Workspace keinen hat; `enforced_as` ist der Tarif, dessen Limits gelten, `free`, wenn es keinen gibt. `ceilings` enthält die Limits nach Namen ([Tarife und Limits](#limits)). `past_due` ist `true`, solange eine Zahlung offen ist, und `suspended`, sobald die Nachfrist danach abgelaufen ist. `system` ist für den eigenen Workspace von NimbusNexus.

`GET /v1/usage` gibt an, wie viel davon verbraucht ist:

```json
{
  "period": "2026-10-01",
  "requests": 26834,
  "monthly_requests": 35000,
  "purchased_requests": 10000,
  "credit": null,
  "bins": 2,
  "max_bins": 5,
  "bin_request_ceiling": 17500
}
```

`period` ist der Monat, angegeben als sein erster Tag. `requests` zählt, was die Bins des Workspaces in diesem Monat aufgezeichnet haben, gemessen an `monthly_requests`: den monatlichen Requests des Tarifs plus `purchased_requests`, den in diesem Monat mit [Guthaben](#credit) gekauften Requests. Hier hat ein Workspace im Tarif Starter zusätzlich zu seinen 25.000 einen Block gekauft. `bins` zählt die vorhandenen Bins, gemessen an `max_bins`. `bin_request_ceiling` ist das Maximum, das ein einzelner Bin in diesem Monat aufzeichnen darf, gekaufte Requests eingeschlossen.

`credit` ist `null`, solange der Monat noch Requests übrig hat. Sind sie aufgebraucht, zeigt das Feld, was mit dem Guthaben geschieht: `pending`, während weitere gekauft werden, sodass Bins innerhalb weniger Minuten wieder aufzeichnen; `empty`, wenn das Guthaben für einen Block nicht reicht; und `off`, wenn die Nutzung des Guthabens für Request Bins ausgeschaltet ist oder im Tarif keine gekauft werden, wie in Custom. Behandeln Sie das Feld als offenen String und sehen Sie einen Standardfall für Werte vor, die Sie nicht kennen.

## Wer was darf {#authority}

| | Bins, Tarif und Verbrauch lesen | Erfasste Requests lesen | Bins anlegen, umbenennen, deaktivieren und aktivieren sowie die Weiterleitung einrichten | Bins löschen und leeren |
| --- | --- | --- | --- | --- |
| Owner oder Admin des Workspaces | ja | ja | ja | ja |
| Member | ja | ja | ja | nein |
| Viewer oder jede andere Rolle | ja | ja | nein | nein |
| Key mit **Read & write** (Scope `admin`) | ja | in bezahlten Tarifen | ja | ja |
| Key mit **Read** (Scope `read`) | ja | in bezahlten Tarifen | nein | nein |

Eine abgewiesene Aktion antwortet mit `403` `forbidden` und `details.reason` `role`, und `details.required` nennt die nötige Rolle: `member`, um einen Bin anzulegen oder zu ändern, `admin`, um einen zu löschen oder zu leeren. Für einen Key bedeuten beide **Read & write** (den Scope `admin`). Die Kontokonsole erstellt Keys mit **Read** und **Read & write**, und ein Key mit einem anderen Scope, etwa `write`, wird wie **Read** behandelt.

Request Bins bedient ganze Workspaces. Ein Gastzugang oder ein Key, der auf ein Projekt beschränkt ist, wird auf jeder Route mit `403` `project_confined` abgewiesen.

Ein Workspace hat Request Bins, sobald ein Owner oder Admin die Konsole geöffnet oder das Produkt über **Add a product** hinzugefügt hat. Bis dahin werden andere Mitglieder mit `403` `product_not_enabled` abgewiesen. Keys sind davon nicht betroffen.

## Tarife und Limits {#limits}

| Feld in `ceilings` | Bedeutung | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- | --- |
| `max_bins` | Bins gleichzeitig | 1 | 5 | 25 | 250 |
| `monthly_requests` | Aufgezeichnete Requests pro Monat | 1.000 | 25.000 | 250.000 | 5.000.000 |
| `bin_share_pct` | Größter Anteil am Monat, den ein Bin verbrauchen darf | 100 % | 50 % | 40 % | 25 % |
| `retention_days` | Wie lange ein Request gespeichert wird | 1 Tag | 7 Tage | 30 Tage | 90 Tage |
| `bin_ttl_minutes` | Standard-Lebensdauer eines neuen Bins | 24 Stunden | bis zum Löschen | bis zum Löschen | bis zum Löschen |
| `bin_ttl_max_minutes` | Längste Lebensdauer, die Sie festlegen dürfen | 24 Stunden | 7 Tage | 30 Tage | kein Limit des Tarifs; das Maximum der API ist ein Jahr |
| `read_api` | Erfasste Requests mit einem Key lesen | nein | ja | ja | ja |
| `bin_max_sources` | Verschiedene Absender, bevor ein Bin gesperrt wird | 50 | 200 | 500 | 2.000 |
| `bin_max_browser_posts` | Formular-Posts aus Browsern, bevor ein Bin gesperrt wird | 3 | 5 | 5 | 10 |
| `forwarding` | [Weiterleitung](#forwarding) jedes Requests an Ihren eigenen Server | nein | ja | ja | ja |
| `forward_max_body_bytes` | Größter Body, den eine Weiterleitung überträgt | — | 256 KiB | 1 MiB | 1 MiB |
| `forward_rate_per_min` | Weiterleitungen, die ein Bin pro Minute sendet; weitere warten, bis sie an der Reihe sind | — | 60 | 300 | 600 |
| `forward_max_attempts` | Versuche, eine Weiterleitung zu senden | — | 3 | 5 | 5 |

`GET /v1/plan` gibt Lebensdauern in Minuten an, wobei `0` „bis zum Löschen“ (`bin_ttl_minutes`) oder „kein Limit des Tarifs“ (`bin_ttl_max_minutes`) bedeutet, `read_api` und `forwarding` als `1` oder `0`, `forward_max_body_bytes` in Bytes und die Zahlen zur Weiterleitung in Free als `0`. Die Preise stehen im [Überblick](/docs/product-bins#limits).

- **Der Monat** ist ein Kalendermonat in UTC: `period` in `GET /v1/usage`. Jeder Request, den ein Bin aufzeichnet, zählt. Ein abgewiesener oder durch das Rate-Limit gebremster Request zählt nicht.
- **Nach Überschreiten der Requests des Monats** oder des Anteils eines Bins daran (`bin_request_ceiling`) antworten Bins mit `200` und zeichnen nichts auf, bis mit [Guthaben](#credit) weitere gekauft werden oder der nächste Monat beginnt, und `refused_count` zeigt das an. Kein API-Aufruf wird deswegen abgewiesen.
- **Aufbewahrung und Lebensdauer sind getrennte Uhren.** Ein Request wird gelöscht, wenn die Aufbewahrung des Tarifs abläuft oder sein Bin endet, je nachdem, was zuerst eintritt.
- **Hinweise:** Wenn der Workspace 80 % und dann 100 % der Requests des Monats erreicht, gekaufte Requests eingeschlossen, wird er per E-Mail benachrichtigt, die an den Owner des Workspaces geht, sofern Sie keine andere Adresse wählen, und über einen Webhook mit dem Event-Typ `bind.quota.threshold_reached`, falls Sie einen einrichten. Beides finden Sie unter **Notifications** in Ihrer Kontokonsole. Die E-Mail sagt, was das Guthaben tun wird.
- **Solange eine Zahlung überfällig ist,** werden das Anlegen und Ändern von Bins mit `402` `workspace_frozen` abgewiesen, und Bins zeichnen weiter auf. Endet die Nachfrist, wird der Workspace gesperrt: Dieselben Abweisungen kommen als `402` `workspace_suspended`, und Bins antworten mit `200` und zeichnen nichts auf. Löschen und Lesen funktionieren weiterhin, und nichts wird gelöscht.
- **In einem kleineren Tarif** werden Bins über dessen `max_bins` zurückgehalten, die neuesten zuerst, als [`plan_downgrade`](#suspension), und kommen zurück, die ältesten zuerst, sobald der Tarif sie erlaubt.

### Weitere Requests mit Guthaben {#credit}

Guthaben ist ein Betrag, den Ihr Workspace bereithält und den NimbusNexus-Produkte ausgeben, wenn ihr Monat aufgebraucht ist. Sie laden es in der [Kontokonsole]({{ACCOUNT_BASE_URL}}/billing#credit) unter **Billing** auf, wo Sie auf der Karte **Credit** außerdem für jedes Produkt die Nutzung des Guthabens ein- oder ausschalten. Für Request Bins ist sie eingeschaltet, bis Sie sie ausschalten.

- **Der Block:** 10.000 Requests für $4, in Free, Starter und Pro. In Custom gibt es weitere Requests nach Vertrag, daher werden dort keine mit Guthaben gekauft.
- **Wann:** Etwa alle 5 Minuten kauft Request Bins einen Block für jeden Workspace, dessen Monat zu 90 % verbraucht ist und der weniger als 10.000 Requests übrig hat, solange das Guthaben reicht.
- **Was ein Block hinzufügt:** 10.000 Requests zum Monat, und der Anteil jedes Bins wächst um seinen Teil davon, auf Starter etwa um 5.000, sodass `monthly_requests`, `purchased_requests` und `bin_request_ceiling` in [`GET /v1/usage`](#plan) mitwachsen.
- **Nur für den Monat:** Gekaufte Requests verfallen, wenn der Monat endet. Ein teilweise genutzter Block wird nicht erstattet, und nichts wird in den nächsten Monat übertragen.
- **Wenn nichts gekauft werden kann:** Ist die Nutzung des Guthabens ausgeschaltet oder reicht das Guthaben für keinen Block, antworten Bins nach Überschreiten der Requests des Monats mit `200` und zeichnen bis zum nächsten Monat nichts auf, und `credit` in `GET /v1/usage` sagt, welcher Fall vorliegt. Auch ein Absender, der schnell genug sendet, um die letzten Requests vor dem nächsten Kauf aufzubrauchen, findet den Monat für einige Minuten aufgebraucht vor, und was er dann sendet, wird nicht aufgezeichnet.

## Fehler {#errors}

Die Fehler der API verwenden das unter [Fehler](/docs/errors) beschriebene Format, mit den Codes, die Inboxes in denselben Situationen sendet:

| Status | `code` | Wann |
| --- | --- | --- |
| `400` | `bad_request` | Ein JSON-Body, der kein gültiges UTF-8 ist. |
| `401` | `unauthorized` | Kein Credential, ein widerrufenes oder eine beendete Anmeldung in der Konsole; `details.reason` nennt den Fall. |
| `401` | `invalid_credential` | Ein Key, der sich nicht verifizieren lässt, abgelaufen ist oder für ein anderes Produkt erstellt wurde. |
| `402` | `quota_exceeded` | Einen Bin anlegen, während alle Bins des Tarifs belegt sind. |
| `402` | `not_entitled` | In Free: erfasste Requests mit einem Key lesen (`details.feature` `read_api`) oder eine Weiterleitungs-URL festlegen oder einen Test senden (`forwarding`). |
| `402` | `workspace_frozen`, `workspace_suspended` | Einen Bin anlegen oder ändern, während eine Zahlung überfällig ist oder nachdem der Dienst eingestellt wurde. |
| `403` | `forbidden` | `details.reason` ist `role`, `project_confined`, `product_not_enabled`, `csrf` oder `no_workspace`. |
| `404` | `not_found` | Kein solcher Bin oder Request in Ihrem Workspace, oder er wurde gelöscht oder ist abgelaufen; `details.reason` ist `bin` oder `request`. |
| `405` | `method_not_allowed` | Der Pfad existiert, aber nicht für diese Methode. |
| `413` | `payload_too_large` | Ein Request-Body über 2 MiB. |
| `422` | `validation_error` | Ein Parameter oder Feld hat die Validierung nicht bestanden. Ein NUL-Zeichen im Pfad, in der Query oder in einem JSON-Body ergibt den Eintragstyp `bins.nul_character`, eine Weiterleitungs-URL, an die ein Bin nicht weiterleitet, ergibt `bins.forward_target` ([Weiterleitung](#forwarding)), und eine Suche, deren Teile einander widersprechen, ergibt `bins.search_conflict` ([Erfasste Requests](#requests)). |
| `429` | `rate_limited` | Mehr als 10 Tests für einen Bin innerhalb einer Minute; `details.retry_after` gibt an, wann Sie es erneut versuchen können. |
| `500` | `internal_error` | Auf unserer Seite ist etwas kaputtgegangen. |
| `503` | `unavailable` | Eine Weiterleitungs-URL festlegen oder einen Test senden, während die Weiterleitung für den gesamten Dienst ausgeschaltet ist (`details.reason` `forwarding_disabled`), oder ein Test, der nicht innerhalb von 3 Sekunden zum Senden übernommen wurde, sodass nichts gesendet wurde (`forwarder_unavailable`). |

Die API sendet kein `409` und ein `429` nur bei Tests.

## Nächste Schritte {#next-steps}

- [Schnellstart](/docs/product-bins/quickstart) — einen Bin anlegen und lesen, was er aufgezeichnet hat.
- [Weiterleitung](/docs/product-bins/forwarding) — was eine Weiterleitung sendet, die Retries, die Limits und woher Weiterleitungen kommen.
- [Request-Bins-API](/docs/reference/bins) — jede Operation, mit dem Request in curl, TypeScript, Python oder Go.
- [Fehler](/docs/errors) — das Fehlerformat, jedes Feld in `details` und ein Muster für den Umgang damit.
- [Produktüberblick](/docs/product-bins) — Preise und was Request Bins nicht tut.
