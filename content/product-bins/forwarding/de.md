---
title: "Weiterleitung"
description: "Ein Bin kann jeden Request, den er aufzeichnet, an Ihren eigenen Server weiterleiten und behalten, was Ihr Server geantwortet hat — was gesendet wird, die Retries, die Limits und die Adresse, von der Weiterleitungen kommen."
publishedAt: 2026-10-26
updatedAt: 2026-10-26
kind: concept
---

# Weiterleitung

Geben Sie einem Bin eine Weiterleitungs-URL, dann wird jeder Request, den er aufzeichnet, außerdem so, wie er angekommen ist, an Ihren eigenen Server weitergeleitet. Der Absender erhält weiterhin sofort die Antwort `200` des Bins. Der Bin leitet den Request selbstständig weiter, versucht es erneut, wenn Ihr Server fehlschlägt, und speichert die Antwort Ihres Servers beim Request. So sehen Sie an einer Stelle, was ein Absender gesendet hat und was Ihr Endpoint daraus gemacht hat.

## Wer weiterleiten kann und wohin {#target}

Die Weiterleitung ist in Starter, Pro und Custom enthalten. Wenn Sie in Free eine Weiterleitungs-URL festlegen, lautet die Antwort `402` `not_entitled`, mit `details.feature` `forwarding`.

Ein Bin leitet an eine URL weiter, und diese URL muss folgende Bedingungen erfüllen:

- **https**, auf einem beliebigen Port. Das Zertifikat wird gegen den Hostnamen der URL geprüft.
- **Ohne Benutzernamen oder Passwort.**
- **Im öffentlichen Internet.** Jede Adresse, auf die ihr Host auflöst, muss öffentlich sein: Eine private, Loopback-, Link-Local- oder anderweitig reservierte Adresse wird abgewiesen, ebenso ein Host, der nicht auflöst.
- **Nicht unsere eigene.** `nnbin.net`, `nimbusnexus.net` und jeder Name darunter werden abgewiesen, ebenso jeder Name, der auf eine unserer eigenen Adressen auflöst: Ein Bin kann weder in einen Bin noch in die eigenen Dienste von NimbusNexus weiterleiten.
- **Höchstens 2.048 Zeichen lang.**

Die URL wird geprüft, wenn Sie sie festlegen, und vor jedem Senden erneut, und gesendet wird jeweils nur an die Adressen, die diese Prüfung ermittelt hat. So kann eine DNS-Änderung in der Zwischenzeit das Senden nicht auf ein anderes Ziel lenken. Der Bin folgt keinen Redirects: Eine Antwort `3xx` wird als Antwort Ihres Servers gespeichert und gilt als gesendet, denn ein Redirect könnte zu einem beliebigen Ziel führen, das die Prüfung nie gesehen hat.

Pfad und Query jedes Requests werden an die Weiterleitungs-URL angehängt. Mit der Weiterleitungs-URL `https://api.example.com/hooks` geht ein Request an `https://nnbin.net/b/k7xq2mbn9tfa/stripe/events?x=1` an `https://api.example.com/hooks/stripe/events?x=1`. Ein Request an die bloße Bin-URL geht an die Weiterleitungs-URL so, wie Sie sie festgelegt haben, und ein Query-String, den die Weiterleitungs-URL enthält, kommt zuerst.

Legen Sie die URL in der Konsole mit **Set up forwarding** auf der Karte **Forwarding** des Bins fest oder mit `forward_url` bei `PATCH /v1/bins/{id}`:

```bash
curl -X PATCH https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17 \
  -H "Authorization: Bearer $BINS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"forward_url": "https://api.example.com/hooks"}'
```

Die Antwort ist der Bin, in dem `forward_url` gesetzt ist. **Stop forwarding** auf der Karte oder `"forward_url": null` schaltet die Weiterleitung aus. Um die URL festzulegen, brauchen Sie die Rolle Member oder einen Key mit **Read & write**. Eine URL, die gegen eine der Regeln oben verstößt, wird mit `422` abgewiesen, und die [Referenz](/docs/product-bins/reference#forwarding) listet jeden Grund auf.

## URL vorab prüfen {#test}

**Send a test** auf der Karte Forwarding oder `POST /v1/bins/{id}/forward-test` sendet Ihrem Server sofort ein kleines JSON-Event und zeigt, was er geantwortet hat. So wissen Sie, dass die URL funktioniert, bevor echter Traffic von ihr abhängt:

```bash
curl -X POST https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17/forward-test \
  -H "Authorization: Bearer $BINS_API_KEY"
```

```json
{
  "ok": true,
  "answer": {
    "status": 200,
    "headers": [
      {"name": "content-type", "value": "text/plain"}
    ],
    "body_base64": "b2s=",
    "truncated": false
  },
  "duration_ms": 142,
  "error": ""
}
```

Ihr Server erhält einen `POST`, dessen Body `{"type":"request_bins.forward_test","bin":"<slug>","sent_at":"<when>"}` ist, mit `Content-Type: application/json`, `User-Agent: NimbusNexus-Request-Bins (forward test)`, `X-Request-Bins-Request: test` und den Headern `Via` und `X-Forwarded-Host`, die jede Weiterleitung mitführt. `ok` ist `true` bei einer Antwort `2xx` oder `3xx`. Kommt keine Antwort, ist `answer` `null`, und `error` nennt den Grund, etwa ein Timeout. Ein Bin kann 10 Tests pro Minute senden.

## Was gesendet wird {#sent}

Eine Weiterleitung ist der Request so, wie der Bin ihn aufgezeichnet hat:

- **die Methode**, gleich welche;
- **der Body, Byte für Byte**;
- **die Header, in der Reihenfolge ihres Eintreffens**, ohne die unten genannten, danach unsere.

**Entfernt**, weil sie zu einer Verbindung oder einem Hop gehören statt zum Request: `Connection` und jeder Header, den er nennt, `Keep-Alive`, `Proxy-Connection`, `Proxy-Authenticate`, `TE`, `Trailer`, `Transfer-Encoding` und `Upgrade`; `Host`, der zum Host Ihres Servers wird, und `Content-Length`, der neu berechnet wird; sowie `X-Real-IP`, `X-Forwarded-Proto`, `X-Forwarded-Host`, `CDN-Loop` und alle Header `CF-*`, die einen früheren Hop beschreiben; die Weiterleitung setzt ihre eigenen Header `X-Forwarded-Proto` und `X-Forwarded-Host`. Auch ein eigener `X-Request-Bins-Request` des Absenders wird entfernt, sodass der, den Ihr Server liest, von uns stammt.

**Nicht weitergeleitet: Credentials.** `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` und `X-Api-Key` verlassen den Bin nie. Eine Bin-URL ist öffentlich, daher ersetzt ein Bin diese Werte durch `[redacted]`, bevor etwas gespeichert wird, und nichts, was ein Absender in sie geschrieben hat, wird behalten, nicht einmal für den Moment, in dem eine Weiterleitung es bräuchte. Signatur-Header wie `Stripe-Signature` oder `X-Hub-Signature-256` sind keine Credentials und werden weitergeleitet. Der Body ist unverändert, daher bestehen sie die Prüfung weiterhin, allerdings kann ein Retry ankommen, nachdem die Toleranz einer Signatur mit Timestamp abgelaufen ist. Der Preis dafür: Ein Server, der seinen Aufrufer mit einem der fünf Header authentifiziert, weist weitergeleitete Requests ab.

**Hinzugefügt**, nach den Headern des Absenders:

| Header | Wert |
| --- | --- |
| `X-Forwarded-For` | Die eigenen Einträge des Absenders in `X-Forwarded-For`, falls er welche gesendet hat, danach die Adresse des Absenders, die `source_ip` des Requests. |
| `Forwarded` | Die eigenen Elemente des Absenders in `Forwarded`, danach unseres: `for=<sender>;proto=https;host=nnbin.net`. |
| `Via` | `1.1 nnbin.net`, nach jedem `Via`, das die eigenen Proxys des Absenders hinzugefügt haben. |
| `X-Forwarded-Proto` | `https` |
| `X-Forwarded-Host` | `nnbin.net` |
| `X-Request-Bins-Request` | Die `id` des Requests, etwa `req_8d2e6b1f4a9c3e7d5b0f2a61`, sodass die Logs Ihres Servers zu ihm zurückführen. |

## Zustellung und Retries {#delivery}

Der Absender erhält sofort `200` und `{"status":"accepted"}`, wie von jedem Bin, was auch immer Ihr Server tut, und sieht die Antwort Ihres Servers nie. Der Bin sendet die Weiterleitung selbstständig, meist innerhalb von Sekunden, nachdem er den Request aufgezeichnet hat.

Bei einem Versuch tritt ein Timeout ein, wenn Ihr Server mehr als 10 Sekunden braucht, um die Verbindung anzunehmen, oder mehr als 10 Sekunden, um zu antworten. Was danach geschieht, hängt davon ab, wie der Versuch endete:

| Der Versuch endete mit | Was geschieht |
| --- | --- |
| Einer Antwort `2xx` oder `3xx` | Gesendet. Der Bin folgt keinem Redirect. |
| Einem Verbindungsfehler, einem Timeout, `408`, `429` oder einem `5xx` | Wird wiederholt, bis die Versuche des Tarifs aufgebraucht sind. |
| Jedem anderen `4xx` | Sofort fehlgeschlagen: Denselben Request erneut zu senden, ändert nichts an einem `400` oder einem `404`. |
| Einer Weiterleitungs-URL, die [die Prüfungen](#target) nicht mehr besteht | Sofort fehlgeschlagen. |

Ein fehlgeschlagener Versuch wird 30 Sekunden später wiederholt, danach 2 Minuten, 10 Minuten und 30 Minuten nach dem jeweils folgenden Versuch, bis die Versuche des Tarifs aufgebraucht sind: 3 in Starter, sodass der letzte etwa zweieinhalb Minuten nach dem ersten kommt, und 5 in Pro und Custom, etwa 43 Minuten danach. Wenn eine Antwort `408`, `429` oder `5xx` einen Header `Retry-After` enthält, der eine längere Wartezeit verlangt, wartet der Bin stattdessen so lange, bis zu einer Stunde.

Vor jedem Versuch prüft der Bin erneut, ob er senden darf. Eine Weiterleitung wird als nicht weitergeleitet verworfen, sobald der Bin gelöscht oder gesperrt wurde, die Weiterleitung beendet wurde oder [pausiert](#paused) ist, der Workspace gesperrt wurde oder der Tarif keine Weiterleitung mehr enthält. Eine Weiterleitung geht an die URL, die beim Eintreffen ihres Requests festgelegt war, daher verschiebt eine Änderung der URL keine Weiterleitungen, die bereits warten.

Gesendet werden nur Requests, die ankommen, während ein Bin weiterleitet: Wenn Sie die Weiterleitung einschalten, wird nichts gesendet, was der Bin vorher aufgezeichnet hat. Jeder Request wird einzeln weitergeleitet, daher wird ein zweimal gesendeter Request zweimal aufgezeichnet und zweimal weitergeleitet. Die Reihenfolge der Requests bleibt nicht erhalten: Ein Request, der wiederholt wird, kann Ihren Server nach einem erreichen, der später ankam.

## Nachvollziehen, was passiert ist {#forwards}

Öffnen Sie in der Konsole einen Request. Sein Abschnitt **Forwarding** zeigt, wohin er ging und wie es um ihn steht (**Queued**, **Sending**, **Sent**, **Retrying**, **Failed** oder **Not forwarded** mit dem Grund), die bisherigen Versuche, den letzten Fehler und die Antwort Ihres Servers: ihren Status, ihre Header und die ersten 8 KiB ihres Bodys. Die Karte Forwarding des Bins zeigt den letzten fehlgeschlagenen Sendeversuch.

Über die API listet `GET /v1/requests/{id}` die Weiterleitungen des Requests in `forwards` auf, die neueste zuerst. Eine davon:

```json
{
  "id": "fwd_5a1e8c3b7d2f9a4e6c0b1d83",
  "state": "sent",
  "reason": "",
  "url": "https://api.example.com/hooks/orders?source=quickstart",
  "attempts": 1,
  "max_attempts": 3,
  "next_attempt_at": null,
  "last_error": "",
  "answer": {
    "status": 200,
    "headers": [
      {"name": "content-type", "value": "application/json"}
    ],
    "body_base64": "eyJyZWNlaXZlZCI6dHJ1ZX0=",
    "truncated": false
  },
  "duration_ms": 142,
  "created_at": "2026-10-26T09:12:04Z",
  "sent_at": "2026-10-26T09:12:05Z"
}
```

Jedes Feld, jeden Status und jeden Grund finden Sie in der [Referenz](/docs/product-bins/reference#forwards). Die Antwort Ihres Servers wird so lange aufbewahrt wie der Request und mit ihm gelöscht. Am Bin geben `forward_last_error` und `forward_last_error_at` an, was beim letzten fehlgeschlagenen Sendeversuch schiefging, etwa `HTTP 503` oder ein Timeout, und nie, was der Request enthielt.

## Limits {#limits}

| | Starter | Pro | Custom |
| --- | --- | --- | --- |
| Größter weitergeleiteter Body | 256 KiB | 1 MiB | 1 MiB |
| Weiterleitungen pro Minute und Bin | 60 | 300 | 600 |
| Versuche pro Request | 3 | 5 | 5 |

- **Ein größerer Body wird aufgezeichnet und nicht weitergeleitet**, mit dem Grund `body_too_large`. Dasselbe gilt in jedem Tarif für einen Body über 1 MiB, da ein Bin nur sein erstes 1 MiB speichert ([Was ein Bin aufzeichnet](/docs/product-bins/reference#edge-records)).
- **Nach Überschreiten der Weiterleitungen pro Minute eines Bins** warten Weiterleitungen, bis sie an der Reihe sind. Keine wird deswegen verworfen.
- **Ein Bin hat höchstens 1.000 Weiterleitungen, die noch nicht abgeschlossen sind**: eingereiht, gerade beim Senden oder wartend auf einen erneuten Versuch. Ein Request, der ankommt, während der Bin so viele hat, wird aufgezeichnet und nicht weitergeleitet, mit dem Grund `queue_full`.
- **Die Weiterleitungs-URL samt Pfad und Query eines Requests** darf höchstens 8.192 Zeichen lang sein, sonst wird der Request nicht weitergeleitet (`url_too_long`).
- **Die Weiterleitung kostet keine eigenen Requests.** Ein weitergeleiteter Request zählt einmal zu den Requests des Monats, wenn er aufgezeichnet wird, und seine Versuche zählen nicht. Ein Request, den der Bin nicht aufgezeichnet hat, weil die Requests des Monats aufgebraucht waren oder der Bin gesperrt war, wird auch nicht weitergeleitet.

## Wenn die Weiterleitung pausiert {#paused}

Wenn Ihr Server wiederholt fehlschlägt, hört der Bin auf, an ihn zu senden: Die Weiterleitung pausiert nach 20 fehlgeschlagenen Versuchen in Folge oder nach einer Stunde, in der jeder Versuch fehlgeschlagen ist. Ein einziger erfolgreicher Versuch setzt beide Zählungen zurück.

Solange die Weiterleitung pausiert ist, zeichnet der Bin weiter auf, sendet aber nichts: Jeder Request, der ankommt, und jede Weiterleitung, die gewartet hat, wird als nicht weitergeleitet markiert, mit dem Grund `paused`, und nichts davon wird später gesendet. Der Bin zeigt, wann und warum seine Weiterleitung pausiert hat: **Paused** auf seiner Karte Forwarding und `forward_paused_at` und `forward_paused_reason` (`failed_in_a_row` oder `failing_for_an_hour`) in der API.

**Der Workspace wird benachrichtigt**, einmal pro Pause, so wie er über die Requests seines Monats benachrichtigt wird: per E-Mail, die an den Owner des Workspaces geht, sofern Sie keine andere Adresse wählen, und über einen Webhook, falls Sie einen einrichten. Beides finden Sie unter **Notifications** in Ihrer Kontokonsole. Beim Fortsetzen wird nichts gesendet.

Die E-Mail „Request Bins: forwarding was paused on one of your bins“ nennt den Bin mit seiner Bezeichnung und seiner URL sowie den Host, an den er weitergeleitet hat, nie den Pfad oder die Query. Sie nennt den Grund, aus dem die Weiterleitung pausiert hat, mit dem letzten Fehler und sagt, dass Requests weiterhin aufgezeichnet, aber keine weitergeleitet werden, sodass die in der Zwischenzeit aufgezeichneten auch später nicht weitergeleitet werden. Am Ende steht, wie Sie die Weiterleitung fortsetzen.

Der Event-Typ des Webhooks ist `bind.forwarding.paused`, und sein Body lautet:

```json
{
  "type": "bind.forwarding.paused",
  "workspace_id": "{{WORKSPACE_ID}}",
  "data": {
    "bin_id": "bin_3f9a1c7e5b2d8f4a6c0e9b17",
    "label": "Quickstart",
    "url": "https://nnbin.net/b/w4tz8hcv2qnd",
    "forward_host": "api.example.com",
    "reason": "failed_in_a_row",
    "paused_at": "2026-10-26T14:05:12.345678Z",
    "failures": 20,
    "last_error": "HTTP 503"
  }
}
```

`reason` ist `failed_in_a_row` oder `failing_for_an_hour`, `failures` gibt an, wie viele Sendeversuche in Folge fehlgeschlagen waren, und `last_error`, was beim letzten davon schiefging. `forward_host` ist nur der Host der Weiterleitungs-URL: Ein Hinweis enthält nie den Pfad oder die Query der URL, die ein Secret enthalten können.

Um die Weiterleitung fortzusetzen, sobald Ihr Server repariert ist, wählen Sie **Resume** auf der Karte Forwarding, oder setzen Sie `forward_url` mit `PATCH /v1/bins/{id}` erneut, auf dieselbe oder eine neue URL. Die Weiterleitung beginnt wieder mit dem nächsten Request, den der Bin aufzeichnet, und **Send a test** zeigt, ob Ihr Server antwortet.

## Woher Weiterleitungen kommen {#source-address}

Weiterleitungen und Tests erreichen Ihren Server von `23.247.240.155` aus, über IPv4. Ein Server, dessen Host nur IPv6-Adressen hat, kann sie daher nicht empfangen. Das ist die heutige Adresse, und sie kann sich ändern: Diese Seite kündigt es an, bevor es geschieht. Wenn Ihr Server nur Requests von Adressen annimmt, die er kennt, lassen Sie diese Adresse zu.

## Was die Weiterleitung nicht ist {#not}

- **Ein Proxy.** Der Absender erhält die Antwort `200` des Bins, nie die Antwort Ihres Servers, und ein Bin kann nicht mit einem Status, Headern oder einem Body Ihrer Wahl antworten.
- **Replay.** Ein aufgezeichneter Request lässt sich nicht auf Wunsch erneut senden: Jeder wird einmal weitergeleitet, sobald er ankommt, mit seinen Retries.
- **Verteilung.** Ein Bin leitet an eine URL weiter. Um die Signaturen eines Anbieters zu prüfen und seine Webhooks an mehrere Ihrer Endpoints zuzustellen, mit Dead-Letter-Queue und erneuter Zustellung, nutzen Sie eine [Webhooks-Quelle](/docs/product-webhooks/sources).

## Nächste Schritte {#next-steps}

- [Referenz für Request Bins](/docs/product-bins/reference#forwarding) — `forward_url`, der Test und jedes Feld einer Weiterleitung.
- [Produktüberblick](/docs/product-bins) — was ein Bin aufzeichnet und die Limits jedes Tarifs.
- [Webhooks-Quellen](/docs/product-webhooks/sources) — die Webhooks eines Anbieters, geprüft und an Ihre Endpoints zugestellt.
