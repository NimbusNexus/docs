---
title: "Weiterleitung"
description: "Ein Bin kann jeden Request, den er aufzeichnet, an Ihren eigenen Server weiterleiten und behalten, was Ihr Server geantwortet hat — was gesendet wird, eine Pipeline, die das Credential Ihres Servers hinzufügt oder den Request umformt, die Retries, die Limits und die Adresse, von der Weiterleitungen kommen."
publishedAt: 2026-10-26
updatedAt: 2026-11-03
kind: concept
---

# Weiterleitung

Geben Sie einem Bin eine Weiterleitungs-URL, dann wird jeder Request, den er aufzeichnet, außerdem an Ihren eigenen Server weitergeleitet: so, wie er angekommen ist, oder über eine [Pipeline](#pipeline), die das Credential Ihres Servers hinzufügt, Header ändert, Requests überspringt oder den Body umformt. Der Absender erhält weiterhin sofort die Antwort `200` des Bins. Der Bin leitet den Request selbstständig weiter, versucht es erneut, wenn Ihr Server fehlschlägt, und speichert die Antwort Ihres Servers beim Request. So sehen Sie an einer Stelle, was ein Absender gesendet hat und was Ihr Endpoint daraus gemacht hat.

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

Eine Weiterleitung ist der Request so, wie der Bin ihn aufgezeichnet hat, sofern die [Pipeline](#pipeline) des Bins ihn nicht ändert:

- **die Methode**, gleich welche;
- **der Body, Byte für Byte**;
- **die Header, in der Reihenfolge ihres Eintreffens**, ohne die unten genannten, danach unsere.

**Entfernt**, weil sie zu einer Verbindung oder einem Hop gehören statt zum Request: `Connection` und jeder Header, den er nennt, `Keep-Alive`, `Proxy-Connection`, `Proxy-Authenticate`, `TE`, `Trailer`, `Transfer-Encoding` und `Upgrade`; `Host`, der zum Host Ihres Servers wird, und `Content-Length`, der neu berechnet wird; sowie `X-Real-IP`, `X-Forwarded-Proto`, `X-Forwarded-Host`, `CDN-Loop` und alle Header `CF-*`, die einen früheren Hop beschreiben; die Weiterleitung setzt ihre eigenen Header `X-Forwarded-Proto` und `X-Forwarded-Host`. Auch ein eigener `X-Request-Bins-Request` des Absenders wird entfernt, sodass der, den Ihr Server liest, von uns stammt.

**Nicht weitergeleitet: Credentials.** `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` und `X-Api-Key` verlassen den Bin nie. Eine Bin-URL ist öffentlich, daher ersetzt ein Bin diese Werte durch `[redacted]`, bevor etwas gespeichert wird, und nichts, was ein Absender in sie geschrieben hat, wird behalten, nicht einmal für den Moment, in dem eine Weiterleitung es bräuchte. Signatur-Header wie `Stripe-Signature` oder `X-Hub-Signature-256` sind keine Credentials und werden weitergeleitet. Der Body ist unverändert, daher bestehen sie die Prüfung weiterhin, allerdings kann ein Retry ankommen, nachdem die Toleranz einer Signatur mit Timestamp abgelaufen ist. Ein Server, der seinen Aufrufer mit einem der fünf Header authentifiziert, weist weitergeleitete Requests ab, es sei denn, die Pipeline des Bins fügt mit einem [Credential-Schritt](#pipeline) das eigene Credential Ihres Servers hinzu.

**Hinzugefügt**, nach den Headern des Absenders:

| Header | Wert |
| --- | --- |
| `X-Forwarded-For` | Die eigenen Einträge des Absenders in `X-Forwarded-For`, falls er welche gesendet hat, danach die Adresse des Absenders, die `source_ip` des Requests. |
| `Forwarded` | Die eigenen Elemente des Absenders in `Forwarded`, danach unseres: `for=<sender>;proto=https;host=nnbin.net`. |
| `Via` | `1.1 nnbin.net`, nach jedem `Via`, das die eigenen Proxys des Absenders hinzugefügt haben. |
| `X-Forwarded-Proto` | `https` |
| `X-Forwarded-Host` | `nnbin.net` |
| `X-Request-Bins-Request` | Die `id` des Requests, etwa `req_8d2e6b1f4a9c3e7d5b0f2a61`, sodass die Logs Ihres Servers zu ihm zurückführen. |

## Eine Pipeline vor jeder Weiterleitung {#pipeline}

Die Pipeline eines Bins ist eine kurze Liste von Schritten, die jede Weiterleitung der Reihe nach durchläuft, unmittelbar bevor sie gesendet wird. Es sind die deklarativen Schritte einer Webhooks-Transformation, und keiner von ihnen führt Code aus. Eine Pipeline gehört zur Weiterleitung und ist damit in Starter, Pro und Custom enthalten.

| Schritt | Was er tut |
| --- | --- |
| **Credential** (`auth`) | Fügt das Credential Ihres Servers aus einem hinterlegten [Secret](#secrets) hinzu: ein Bearer-Token, Basic Auth oder einen API-Key in einem Header, nach einem Präfix wie `Token` und einem Leerzeichen, oder im Query-String. |
| **Headers** (`headers`) | Setzt die Header des Absenders, entfernt sie oder benennt sie um. Ein Wert kann auf den Request zugreifen, etwa `{{ $meta.bin.label }}`. |
| **Filter** (`filter`) | Leitet nur die passenden Requests weiter oder überspringt genau die passenden. |
| **Remove fields** (`drop`), **Set fields** (`set`), **Reshape the body** (`map`) | Ändern einen JSON-Body. |

**Credential-, Header- und Filter-Schritte lassen die Signatur des Absenders intakt.** Der Body wird weiterhin Byte für Byte gesendet, daher bestehen `Stripe-Signature` und vergleichbare Header die Prüfung nach wie vor. Ein Filter entscheidet nur, ob ein Request weitergeleitet wird.

**Ein Schritt, der den Body ändert, macht die Signatur ungültig.** Die Weiterleitung enthält dann das JSON der Pipeline statt der Bytes, die der Absender signiert hat, sodass eine Signatur über den Body die Prüfung nicht mehr besteht. Bevor Sie eine solche Pipeline speichern, müssen Sie das bestätigen: in der Konsole in einem Dialog und über die API mit `"forward_pipeline_changes_body": true`. Ein geänderter Body wird als `application/json` gesendet, sofern die Pipeline keinen eigenen `Content-Type` setzt.

Was die Schritte lesen:

- **den Body**, als JSON geparst. Ein Body, der kein JSON ist, etwa ein Formular-Post, durchläuft weiterhin Credential- und Header-Schritte sowie einen Filter auf Header oder auf `$meta`, aber ein Schritt, der den Body liest, lässt diese Weiterleitung fehlschlagen;
- **die Header des Absenders**, so wie die Weiterleitung sie mitführt. `Authorization`, `Cookie` und `X-Api-Key` sind nie darunter, da kein Bin sie behält;
- **`$meta`**: `{"bin": {"id", "label"}, "method", "path", "query", "request_id"}`.

Die Header unter [Hinzugefügt](#sent) kommen nach der Pipeline hinzu, und eine Pipeline kann sie weder setzen noch entfernen.

### Secrets {#secrets}

Ein Credential-Schritt verweist auf ein Secret über dessen ID, nie über dessen Wert, sodass eine Pipeline, die Sie aus der Konsole oder der API zurücklesen, kein Credential enthält. Ein Secret hinterlegen Sie in der Konsole über die Liste **Secret** des Credential-Schritts unter **New secret…** oder mit `POST /v1/secrets`:

```bash
curl -X POST https://bins.nimbusnexus.net/v1/secrets \
  -H "Authorization: Bearer $BINS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Orders API\", \"value\": \"$ORDERS_API_TOKEN\"}"
```

```json
{
  "id": "sec_4b7d2e9a1c6f3e8b0d5a7c21",
  "name": "Orders API",
  "bin_count": 0,
  "created_at": "2026-11-03T10:15:00Z",
  "updated_at": "2026-11-03T10:15:00Z"
}
```

- **Nur schreibbar.** Ein Secret wird beim Hinterlegen verschlüsselt, und danach zeigt keine Seite und keine Route seinen Wert mehr an. Sie können es umbenennen oder seinen Wert ersetzen; den neuen Wert sendet jede Weiterleitung ab ihrem nächsten Versuch.
- **Ein Wert** ist druckbares ASCII, bis zu 4.096 Zeichen.
- **Nie aufgezeichnet.** Die Weiterleitungen eines Requests zeigen den Header, den ein Credential-Schritt hinzugefügt hat, mit maskiertem Wert, als `Bearer ••••`. Gibt die Antwort Ihres Servers das Credential zurück, wird die Antwort aufbewahrt, wobei das Credential durch `[redacted]` ersetzt ist.
- **Bleibt erhalten, solange es genutzt wird.** Ein Secret, auf das die Pipeline eines Bins verweist, lässt sich nicht löschen: Die Antwort lautet `409` `secret_in_use`. Ändern Sie zuerst die Pipeline.
- **Für Owner und Admins.** Um ein Secret zu hinterlegen, eine Pipeline zu speichern, deren Credential-Schritt auf eines verweist, oder die Weiterleitungs-URL eines Bins zu ändern, dessen Pipeline eines sendet, brauchen Sie jeweils die Rolle Owner oder Admin oder einen Key mit **Read & write**. Ein Member kann bei einem solchen Bin weiterhin die Weiterleitung fortsetzen oder beenden oder die Pipeline entfernen.

### Pipeline einrichten {#pipeline-set}

Auf der Karte **Forwarding** des Bins öffnet **Add a pipeline** den Editor. Fügen Sie Schritte einzeln hinzu, starten Sie mit einer Vorlage (einer Nachricht für Slack, Discord oder Microsoft Teams, Keep only these fields oder Drop personal data), oder bearbeiten Sie die ganze Pipeline als JSON. **Test on the newest request** zeigt, was eine Weiterleitung für den neuesten Request des Bins senden würde, mit maskiertem Credential, oder an welchem Schritt sie übersprungen wird oder fehlschlägt. Es wird nichts gesendet. Über die API legen Sie `forward_pipeline` mit `PATCH /v1/bins/{id}` fest:

```bash
curl -X PATCH https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17 \
  -H "Authorization: Bearer $BINS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"forward_pipeline": {"version": 1, "steps": [
        {"headers": {"set": {"X-Source": "request-bins"}}},
        {"auth": {"type": "bearer", "secret": "sec_4b7d2e9a1c6f3e8b0d5a7c21"}}
      ]}}'
```

Die Antwort ist der Bin. Er enthält `forward_pipeline`, `forward_pipeline_version`, das bei jeder Änderung weiterzählt, und `forward_pipeline_changes_body`. `"forward_pipeline": null` entfernt die Pipeline. Eine Pipeline, die nie laufen könnte, wird mit `422` `invalid_pipeline` abgewiesen, und die Antwort nennt den Schritt, den Pfad und den Grund; die [Referenz](/docs/product-bins/reference#pipeline) listet jeden Grund auf.

`POST /v1/bins/{id}/forward-pipeline/test` führt eine Pipeline aus, ohne sie zu speichern. **Send a test** wendet die eigene Pipeline des Bins auf das Test-Event an und prüft so auch, ob Ihr Server das Credential annimmt.

### Was eine Weiterleitung damit macht {#pipeline-forwards}

| Die Pipeline | Die Weiterleitung |
| --- | --- |
| Läuft durch | Gesendet wie gewohnt, mit den Headern der Pipeline, danach unseren. |
| Überspringt den Request mit einem Filter | Nicht weitergeleitet, mit dem Grund `filtered`. Sie wird nicht wiederholt und nicht auf eine [Pause](#paused) angerechnet. |
| Schlägt fehl, etwa wenn ein Schritt für den Body auf einen Body trifft, der kein JSON ist, oder ein Secret nicht mehr existiert | Sofort fehlgeschlagen. `last_error` ist `pipeline_failed: step <index>: <reason>: …`, wobei der Schritt wie in `steps` ab 0 gezählt wird. Sie wird auf eine Pause angerechnet, wie ein fehlgeschlagener Sendeversuch. |

Jeder Versuch führt die Pipeline so aus, wie der Bin sie zu diesem Zeitpunkt hat, und entschlüsselt ihre Secrets erneut, sodass ein ersetztes Secret ab dem nächsten Versuch mit seinem neuen Wert gesendet wird. Bei den Weiterleitungen eines Requests sehen Sie die Version, die gelaufen ist, den Schritt, an dem eine Weiterleitung übersprungen wurde oder fehlschlug, ob der Body umgeschrieben wurde, und die gesendeten Header, mit maskiertem Credential.

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
