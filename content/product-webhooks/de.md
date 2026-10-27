---
title: "Webhooks"
description: "Die Managed-Webhook-Plattform — Sie veröffentlichen ein Event einmal, wir signieren jede Zustellung an Ihre Abonnenten, wiederholen sie und spielen sie erneut ab."
publishedAt: 2026-08-05
updatedAt: 2026-10-19
kind: concept
---

# Webhooks

Webhooks ist ein eigenständiges Produkt von NimbusNexus, mit dem Sie Webhooks an *Ihre* Abonnenten senden. Sie veröffentlichen ein Event einmal; wir verteilen es an jeden Endpoint, der diesen Typ abonniert hat, signieren jede Zustellung, wiederholen die fehlgeschlagenen und halten alles, was nie ankommt, in einer Dead-Letter-Queue bereit, die Sie erneut abspielen können.

> **Nicht die gesuchte Seite?** Wenn Sie Benachrichtigungen über *Ihre eigene Infrastruktur bei NimbusNexus* empfangen möchten — `vm.created`, `snapshot.completed`, `invoice.generated` —, ist das eine andere Funktion, dokumentiert unter [Plattform-Webhooks](/docs/webhooks). Die beiden sind voneinander unabhängige Systeme, und **ihre Signatur-Header unterscheiden sich**, daher weist Prüfcode, der für das eine geschrieben wurde, jede Zustellung des anderen ab.

Der Unterschied in einem Satz: Plattform-Webhooks sind Events, die *wir* Ihnen über Ihr Konto senden; dieses Produkt stellt Events zu, die *Sie* Ihren eigenen Kunden senden.

## Wofür es gedacht ist {#what-for}

Die Zustellung von Webhooks selbst zu betreiben, sieht einfach aus, bis es das nicht mehr ist. Die Zustellung selbst ist ein POST — die Arbeit steckt in allem drumherum: signieren, damit Abonnenten der Payload vertrauen können; wiederholen, ohne einen Endpoint zu überlasten, der ohnehin schon ausgefallen ist; den Body über alle Retries byte-identisch halten, damit Signaturen gültig bleiben; Endpoints deaktivieren, die seit einer Woche fehlschlagen; und dem Support eine Möglichkeit geben, die Frage „Haben Sie es gesendet?“ mit Belegen zu beantworten.

Dieses Produkt ist genau diese Maschinerie drumherum. Es empfängt auch in die andere Richtung — [Quellen](/docs/product-webhooks/sources) nehmen Webhooks von Stripe, GitHub oder jedem anderen Absender an, der seine Payloads signiert —, sodass ein einziges System beide Seiten Ihres Webhook-Traffics abdeckt.

## Die Objekte {#objects}

| Objekt | Bedeutung |
|---|---|
| **Workspace** | Ihr Konto. Alles, was Ihnen gehört, ist ihm zugeordnet und von anderen Workspaces isoliert. |
| **Projekt** | Eine Gruppierung innerhalb des Workspaces. Wer Staging von Produktion trennt, nutzt zwei Projekte; ebenso, wer zwei Produkte nebeneinander betreibt. Wird über die ID adressiert (`prj_…`). |
| **Event** | Etwas, das passiert ist — ein Typ wie `order.created` plus eine JSON-Payload. Sie veröffentlichen es, oder eine Quelle empfängt es. |
| **Quelle** | Eine URL, an die ein Anbieter Webhooks sendet. Jeder signierte Request wird zu einem Event. Siehe [Quellen](/docs/product-webhooks/sources). |
| **Endpoint** | Eine HTTPS-URL, die für den Empfang von Webhooks registriert ist und ein oder mehrere Abos trägt. |
| **Abo** | Eine Abgleichsregel an einem Endpoint: `exact`, `prefix`, `suffix` oder `all`, plus ein Muster wie `order.`. |
| **Zustellung** | Ein Versand eines Events an einen passenden Endpoint, bei dem jeder Versuch erfasst wird. Signiert, wiederholt, nachvollziehbar. Siehe [Zustellungen und Retries](/docs/product-webhooks/deliveries). |
| **Event-Typ** | Ein Eintrag im Katalog der Typnamen, mit optionalem JSON Schema. Siehe [Event-Typen](/docs/product-webhooks/event-types). |
| **Signatur-Secret** | Secret pro Endpoint, mit dem jede Zustellung per HMAC signiert wird. Wird **einmal** angezeigt, beim Erstellen. |

Wenn Sie ein Event veröffentlichen, wird es mit jedem aktivierten Endpoint abgeglichen, dessen Abos diesen Typ abdecken, und pro Treffer wird eine Zustellung erstellt. Wenn der Workspace [Endpoint-Verifizierung](/docs/product-webhooks/endpoint-verification) verlangt, zählen nur verifizierte Endpoints.

Darüber laufen zwei Zähler, und der Unterschied ist wichtig, wenn Sie einen Tarif wählen. Ein Publish ist immer ein **Event**, und diese von der Verteilung unabhängige Zahl meldet `GET /v1/usage` als `messages_used`. Das **durchgesetzte** Monatskontingent zählt dagegen *Zustellungen* — eine pro passendem Endpoint —, sodass ein einzelnes Event, das an zehn Endpoints verteilt wird, zehn verbraucht. Der Zähler pro Event wird erfasst und wird zur Abrechnungseinheit werden; das Kontingent für Zustellungen ist die Obergrenze, die heute tatsächlich einen Publish abweist.

## Wie sich eine Zustellung verhält {#delivery}

- **Der Body wird einmal erzeugt.** Der Envelope wird beim Veröffentlichen serialisiert und Byte für Byte gespeichert, sodass jeder Retry identische Bytes sendet. Jeder *Versuch* wird mit einem frischen Timestamp neu signiert. So können Ihre Abonnenten ein enges Replay-Fenster durchsetzen, ohne dass eine Zustellung, die eine Stunde später gelingt, an der Prüfung scheitert.
- **Mindestens einmal.** Retries sind echt; dasselbe Event kann zweimal ankommen. Deduplizieren Sie anhand der Event-ID, die sowohl im Body als auch im Header `X-Webhook-Event-Id` mitgesendet wird.
- **Retries mit Backoff.** Fehlgeschlagene Zustellungen werden mit exponentiellem Backoff wiederholt, bis `max_attempts` des Endpoints erreicht ist. Ein Endpoint kann einen eigenen `retry_schedule` haben — eine explizite Liste von Verzögerungen in Sekunden —, wenn die Standardkurve nicht zur Gegenseite passt.
- **Ausgeschöpfte Zustellungen werden aufbewahrt, nicht verworfen.** Sie landen in der Dead-Letter-Queue, wo Sie sie filtern und gesammelt erneut abspielen können, sobald der Empfänger wieder funktioniert.
- **Dauerhaft fehlschlagende Endpoints werden deaktiviert**, automatisch und mit festgehaltenem Grund. Wir senden einen [Betriebs-Webhook](/docs/product-webhooks/deliveries#operational) `endpoint.disabled` an die Betriebs-Endpoints des Workspaces; richten Sie also einen ein, um davon zu erfahren. Wieder aktivieren müssen Sie den Endpoint ausdrücklich.

## Orientierung in der Konsole {#console}

| Bereich | Seiten | Wofür |
|---|---|---|
| **Build** | Sources, Endpoints, Event types | Einrichten, woher Events kommen und wohin sie gehen. |
| **Observe** | Events, Deliveries, Captured requests, Operational webhooks | Sehen, was angekommen ist, was hinausging und was fehlschlug, und benachrichtigt werden, wenn etwas kaputtgeht. |
| **Manage** | Audit log, Settings | Wer was geändert hat; Ihr Tarif und Verbrauch für Webhooks, Verifizierung und Entwicklerwerkzeuge. |

Die Seite Overview hat Schaltflächen, um eine Quelle oder einen Endpoint hinzuzufügen und ein Test-Event zu senden, und führt einen neuen Workspace durch seine erste Zustellung.

## Sicher veröffentlichen {#publishing}

Senden Sie bei jedem Publish einen `Idempotency-Key`. Ein wiederholter Publish liefert dann das ursprüngliche Event zurück, statt ein zweites Mal verteilt zu werden. Das zählt genau in der Situation am meisten, die Retries auslöst — ein Timeout, bei dem Sie nie erfahren haben, ob der erste Aufruf erfolgreich war.

Derselbe Key mit einem *anderen* Body wird abgewiesen statt stillschweigend angenommen, sodass eine Kollision von Keys als Fehler sichtbar wird statt als stillschweigend verlorenes Event.

Für Produzenten, die kein Event verlieren dürfen, wenn die API nicht erreichbar ist, liefern die SDKs eine Outbox, die zuerst lokal schreibt: `enqueue()` speichert lokal und kehrt ohne Netzwerkaufruf zurück, und ein Drainer sendet den Rückstand später mit derselben Idempotenzgarantie. Siehe [SDKs](/docs/product-webhooks/sdks).

## Zugang erhalten {#access}

Wenn Sie sich für Webhooks registrieren, erhalten Sie einen Workspace im kostenlosen Tarif, der bei Ihrer ersten Anmeldung in der Konsole angelegt wird. Die Preise finden Sie auf der [Webhooks-Seite](/webhooks).

Keys werden nicht mit dem Workspace ausgestellt, und die Webhooks-API stellt keine aus. Sie erstellen einen selbst in Ihrer NimbusNexus-Kontokonsole unter **API keys** und wählen **Webhooks** als Produkt — Identity stellt als einzige Stelle API-Keys für das gesamte Angebot aus. Ein von Identity ausgestellter Key ist ein JWT und beginnt deshalb mit `eyJ`, statt ein Produktpräfix zu tragen. Er wird genau wie bisher gesendet: `Authorization: Bearer <key>` oder `X-API-Key: <key>`.

Wählen Sie den Scope beim Erstellen. `admin` hat volle Kontrolle; `publish` kann Events erzeugen und nichts lesen; `read` kann alles lesen und nichts erzeugen. `publish` und `read` sind getrennt statt gestuft — ein Key mit dem Scope `publish` kann keine Zustellungen auflisten, und ein Key mit dem Scope `read` kann nichts veröffentlichen, daher braucht ein Job, der beides tut, `admin`. Ein Key lässt sich beim Erstellen außerdem auf ein einzelnes Projekt beschränken.

> **Ein vorhandener Key mit `whsk_…` authentifiziert nicht mehr.** Die Familie `whsk_` gibt es nicht mehr, und ein Request, der einen solchen Key enthält, wird wie jedes andere unbekannte Credential abgewiesen. Wenn Sie einen besitzen, erstellen Sie in der Kontokonsole einen Ersatz.

## Nächste Schritte {#next-steps}

- [Schnellstart](/docs/product-webhooks/quickstart) — einen Endpoint registrieren, ein Event veröffentlichen, die Zustellung prüfen.
- [Quellen](/docs/product-webhooks/sources) — Webhooks von Stripe, GitHub oder jedem HMAC-Absender empfangen.
- [Zustellungen und Retries](/docs/product-webhooks/deliveries) — Status, der Retry-Zeitplan und erneutes Senden.
- [Endpoint-Verifizierung](/docs/product-webhooks/endpoint-verification) — die Challenge, die ein Endpoint beantwortet, bevor er Events empfängt.
- [Event-Typen](/docs/product-webhooks/event-types) — der Katalog, die Richtlinie für unbekannte Typen und Payload-Schemas.
- [Erfasste Requests](/docs/product-webhooks/captured-requests) — die Requests, wie sie bei einer Quelle ankamen.
- [Signaturprüfung](/docs/product-webhooks/signatures) — die Signaturspezifikation und die drei Regeln für die Prüfung.
- [SDKs](/docs/product-webhooks/sdks) — typisierte Clients für Python, TypeScript und Go.
- [CLI](/docs/product-webhooks/cli) — `nn-webhooks`, ein einzelnes statisches Binary.
- [Plattform-Webhooks](/docs/webhooks) — das andere, das ebenfalls Webhooks heißt: Benachrichtigungen über Ihre eigene Infrastruktur.
