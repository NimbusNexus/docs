---
title: "Transforms"
description: "Deklarative Pipelines, die einen Request filtern, kürzen und umformen. Bauen, versionieren und testen Sie sie an einem Ort, und führen Sie sie dann über die API aus oder per Referenz in dem Produkt, das sendet."
publishedAt: 2026-11-06
updatedAt: 2026-11-06
kind: concept
---

# Transforms

NimbusNexus Transforms macht **Pipelines** zu eigenständigen Objekten. Eine Pipeline ist eine kurze Liste deklarativer Schritte, die einen Request verwerfen, wenn er nicht passt, Felder entfernen oder hinzufügen, den Body aus einem Template neu aufbauen und Header setzen. Bauen Sie eine in der Konsole oder über die REST-API, testen Sie sie, bewahren Sie ihre Versionen auf, führen Sie sie über die API aus, oder verweisen Sie in dem Produkt, das sendet, über ihre ID auf sie.

> **Nicht die gesuchte Seite?** Transforms sendet selbst nichts. Um zu ändern, was ein Endpoint bei jeder Zustellung erhält, lesen Sie [Transformationen](/docs/product-webhooks/transformations) bei Webhooks; um zu ändern, was ein Bin weiterleitet, lesen Sie [Eine Pipeline vor jeder Weiterleitung](/docs/product-bins/forwarding#pipeline) bei Request Bins. Ohne Konto können Sie eine Pipeline im [Playground](/transforms/playground) ausprobieren.

## Auf einen Blick {#at-a-glance}

| | |
| --- | --- |
| Was Sie anlegen | Eine **Pipeline**: ein JSON-Dokument mit bis zu 20 Schritten, etwa `{"version": 1, "steps": [{"drop": ["**.email"]}]}` |
| Was sie tut | Filtert einen Request, entfernt Felder oder fügt sie hinzu, baut den Body aus einem Template neu auf und setzt Header |
| Was sie nicht tut | Etwas senden oder etwas von dem behalten, was sie verarbeitet. Sie ist kein Relay |
| Konsole | `https://transforms.nimbusnexus.net` |
| Basis-URL der API | `https://transforms.nimbusnexus.net/v1` |
| Authentifizierung | `Authorization: Bearer <key>`, mit einem Key, der in der Kontokonsole mit **Transforms** als Produkt erstellt wurde |
| Kennung | Die `id` der Pipeline, zum Beispiel `pipe_8e27d40b19c3f6a5e0d71b42` |
| Ein Dokument ausprobieren | `POST /v1/pipelines/test`; dabei wird nichts gespeichert und nichts gezählt |
| Eine gespeicherte Pipeline ausführen | `POST /v1/pipelines/{id}/run`; die Antwort sagt, was die Pipeline getan hat |
| Alle Schritte, Pfade und Filter | [Pipelines](/docs/product-transforms/pipelines) |
| Alle Routen, Rollen und Limits | Die [Referenz für Transforms](/docs/product-transforms/reference) |

## So funktioniert es {#how}

1. **Bauen Sie eine Pipeline**: Legen Sie im Formular der Konsole Schritte an, fügen Sie sie als JSON ein, oder beginnen Sie mit einer [Vorlage](/docs/product-transforms/pipelines#templates). Ein Dokument, das nie laufen könnte, wird beim Speichern mit `422` `invalid_pipeline` abgewiesen, und die Antwort nennt seinen Schritt, seinen Pfad und den Grund.
2. **Testen Sie sie.** Führen Sie aus, was im Editor steht, mit einem Request, den Sie einfügen, und sehen Sie den Body und die Header, die gesendet würden, den Schritt, der den Request verworfen hat, oder warum die Ausführung fehlgeschlagen ist.
3. **Speichern Sie sie.** Neuer Inhalt ergibt beim Speichern eine neue Version, und eine Version ändert sich nie. Derselbe Inhalt ergibt keine neue, und eine alte Version wiederherzustellen heißt, ihren Inhalt erneut zu speichern.
4. **Führen Sie sie aus**, auf eine von zwei Arten:
   - **Über die API.** Senden Sie einen Request an `POST /v1/pipelines/{id}/run`. Die Route wendet die Pipeline auf das an, was Sie senden, antwortet mit dem Ergebnis und behält nichts. Ob und wohin Sie das Ergebnis senden, liegt bei Ihnen.
   - **Per Referenz.** [Verweisen Sie in Webhooks über die ID auf die Pipeline](/docs/product-webhooks/transformations#reference). Webhooks führt sie vor jeder Zustellung in seinem eigenen Prozess aus. Jede neue Version kommt dort an, ohne dass Sie einen Endpoint ändern müssen.

Der [Schnellstart](/docs/product-transforms/quickstart) führt die Schritte 1 bis 4 über die API aus.

## Was eine Ausführung antwortet {#answers}

Eine Pipeline hat keine Schleifen, keine Uhr und kein Netzwerk; dieselbe Pipeline tut beim selben Request daher immer dasselbe. Eine Ausführung antwortet mit `200` und einem von drei Status, denn in jedem dieser Fälle ist die Pipeline gelaufen:

| `status` | Bedeutung | Was Sie tun |
| --- | --- | --- |
| `ok` | `body`, `headers` und `query` sind der Request, der gesendet werden soll. | Senden Sie ihn. |
| `dropped` | Ein Filter hat den Request verworfen. `step`, `note` und `reason` sagen, welcher und warum. | Senden Sie nichts. |
| `failed` | Die Pipeline kann bei diesem Request nicht laufen. `step`, `reason` und `error` sagen, warum, etwa eine überschrittene Obergrenze. | Ändern Sie die Pipeline oder den Request. Derselbe Request schlägt auf dieselbe Weise fehl, wiederholen Sie ihn also nicht. |

## Credentials {#credentials}

Transforms speichert keine Credentials. Der `auth`-Schritt einer Pipeline gibt an, dass dem Request ein Bearer-Token, Basic Auth oder ein API-Key hinzugefügt wird, und nennt dafür einen **Slot**. Ein Slot ist eine ID und eine Bezeichnung, ohne Wert: Fügen Sie in der Konsole unter **Credential slots** einen hinzu, oder verwenden Sie `POST /v1/slots`. Das Dokument enthält die ID des Slots und sonst nichts. Eine zurückgelesene Pipeline zeigt daher nie ein Credential, und keine Route nimmt den Wert eines Credentials entgegen oder gibt ihn zurück.

Um eines zu senden, führen Sie die Pipeline [per Referenz](/docs/product-webhooks/transformations#reference) in dem Produkt aus, das sendet. Dieses Produkt ordnet dem Slot ein Secret aus seinem eigenen Speicher zu, verschlüsselt mit seinem eigenen Schlüssel, und sendet es an seine eigenen URLs. Außerhalb dieses Produkts bedeutet der Slot nichts.

Der Test und die Ausführungs-API zeigen, was der Schritt hinzufügen würde, mit maskiertem Wert: `Authorization: Bearer ••••`. Sie können kein Credential senden, denn Transforms hat keines, das es senden könnte.

Wo eine Pipeline läuft, sehen Sie im Voraus. Beim Lesen einer Pipeline werden die Produkte aufgelistet, die sie per Referenz ausführen, und die Version, die jedes davon ausführt. Wenn Sie eine neue Version mit einem `auth`-Schritt speichern oder die Pipeline löschen, müssen Sie jedes davon in `confirm_destinations` nennen, sonst wird der Aufruf mit `409` `conflict`, `destinations_unconfirmed` abgewiesen ([Wer eine Pipeline ausführt](/docs/product-transforms/reference#destinations)).

## Tarife und Limits {#limits}

| | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- |
| Pipelines | 5 | 25 | 100 | 1,000 |
| Credential-Slots | 5 | 25 | 100 | 1,000 |
| Aufbewahrte Versionen pro Pipeline | 10 | 25 | 50 | 100 |
| Ausführungen pro Minute | 60 | 600 | 3,000 | 12,000 |

Alle sechs Schritte, die Vorlagen, der Test, die Ausführungs-API und das Ausführen per Referenz sind in jedem Tarif enthalten, Free eingeschlossen.

Ausführungen werden gezählt, nicht abgerechnet. `GET /v1/usage` zeigt die des Monats. Über der Rate des Tarifs, die sich Ausführungen und Tests teilen, antwortet eine Ausführung mit `429` `rate_limited` und nennt die Wartezeit. Eine Ausführung in einem Produkt, das auf die Pipeline verweist, zählt zum Verbrauch dieses Produkts. Eine Version, die ein Produkt festschreibt oder die wir in den letzten 30 Tagen bei einem Produkt im Einsatz gesehen haben, wird über die Zahl des Tarifs hinaus aufbewahrt.

## Zugang erhalten {#access}

Öffnen Sie die Konsole unter `https://transforms.nimbusnexus.net` und melden Sie sich mit Ihrem NimbusNexus-Konto an, oder fügen Sie Transforms in einer beliebigen NimbusNexus-Konsole über **Add a product** hinzu. Beim ersten Besuch eines Owners oder Admins des Workspaces wird Transforms zum Workspace hinzugefügt; andere Mitglieder können es ab dann öffnen.

Die Transforms-API stellt keine Keys aus. Erstellen Sie einen in Ihrer [Kontokonsole]({{ACCOUNT_BASE_URL}}/api-keys?product=transforms) unter **API keys**, mit **Transforms** als Produkt. Ein Key ist ein JWT und beginnt deshalb mit `eyJ`. Senden Sie ihn als `Authorization: Bearer <key>` oder `X-API-Key: <key>`.

Wählen Sie beim Erstellen seine Berechtigung: **Read** liest Pipelines und führt sie aus, und **Read & write** kann sie außerdem anlegen, ändern, testen und löschen. Die vollständige Tabelle, einschließlich der Workspace-Rollen, finden Sie unter [Wer was darf](/docs/product-transforms/reference#authority).

## Was das Produkt nicht tut {#not}

- **Es sendet nicht.** Es hat kein Ziel, keine Retries und kein Zustellungsprotokoll. Webhooks stellt Events zu, und Request Bins leitet Requests weiter.
- **Es behält nicht, was es verarbeitet.** Der Request und die Antwort einer Ausführung sind weg, sobald der Aufruf endet. Nur die Zählung bleibt.
- **Es speichert keine Credentials.** Ein Credential kommt von dem Produkt, das die Pipeline per Referenz ausführt.
- **Es führt keinen Code aus.** Für Logik, die sich mit den Schritten nicht ausdrücken lässt, kann ein Webhooks-Endpoint stattdessen ein [Skript](/docs/product-webhooks/transformations#script) ausführen, in einem bezahlten Tarif.

## Nächste Schritte {#next-steps}

- [Schnellstart](/docs/product-transforms/quickstart) — eine Pipeline testen, speichern, ausführen und eine neue Version speichern.
- [Pipelines](/docs/product-transforms/pipelines) — jeder Schritt, Pfad und Filter, jede Vorlage und die Obergrenzen einer Ausführung.
- [Referenz für Transforms](/docs/product-transforms/reference) — jede Route und jedes Feld, Rollen, Limits und Fehler.
- [Aus Webhooks ausführen](/docs/product-webhooks/transformations#reference) — die Slots Secrets zuordnen und die Pipeline mit einem Endpoint verknüpfen.
- [Playground](/transforms/playground) — eine Beispiel-Pipeline ohne Konto ausführen.
