---
title: "Adressen und die Phrase"
description: "Warum eine Wegwerf-Adresse Mail ohne ihre Phrase im Betreff ablehnt und wie sich Ablauf, Aufbewahrung und Löschung unterscheiden."
publishedAt: 2026-08-18
updatedAt: 2026-10-27
kind: concept
---

# Adressen und die Phrase

Eine Wegwerf-Adresse ist von Natur aus öffentlich: Sie landet in einem Registrierungsformular, einem CI-Log, vielleicht in einem Screenshot. Jeder, der sie sieht, kann ihr Mail senden. Diese Seite behandelt die beiden Mechanismen, die das sicher machen — die **Phrase** und die Tatsache, dass Adressen **sterben**.

## Die Phrase {#phrase}

Eine kostenlose Inbox erhält zusammen mit ihrer Adresse immer ein kurzes Token. In Starter, Pro und Custom erhält sie eines nur, wenn Sie es anfordern, mit `"phrase": true` beim Anlegen oder in einem späteren `PATCH`. Eine Inbox mit Phrase nimmt eine Nachricht nur an, wenn die Phrase im **Betreff** steht; eine ohne Phrase nimmt jeden Betreff an:

```text
Subject: nn-re89dr Your verification code   ← accepted
Subject: Your verification code             ← refused
```

Die Phrase ist kein Passwort und kein Secret — sie steht im Klartext in einer Betreffzeile. Sie ist vielmehr ein *Hindernis nach Art eines gemeinsamen Geheimnisses*: Eine geleakte Adresse ist dadurch für sich allein keine nutzbare Adresse.

Dieser Unterschied ist das Produkt. Ohne ihn ließe sich eine Wegwerf-Adresse aus einem öffentlichen CI-Log nutzen, um Konten bei anderen Diensten zu registrieren, deren Bestätigungsmails zu empfangen und jemandem ein Konto zu verschaffen, das Sie nicht sehen und nicht angelegt haben. Die Adresse wäre ein kostenloser Generator für anonyme Identitäten. Weil die Phrase verlangt wird, muss jeder, der die Adresse besitzt, die Phrase auch aus demselben API-Aufruf erfahren haben, der die Adresse vergeben hat — was auf jemanden, der Ihre Build-Ausgabe abgreift, nicht zutrifft.

Es bedeutet auch, dass **Sie bestimmen, was die Adresse annimmt**. Ein zu testendes System, das Sie konfigurieren, setzt die Phrase in den Betreff, weil Sie es so eingestellt haben. Wer nur zufällig vorbeikommt, tut das nicht.

Wohin damit: an eine beliebige Stelle im Betreff. Geprüft wird nur der Betreff — eine Phrase im Body zählt nicht, denn den Body kann ein Angreifer am leichtesten mit beliebigem Inhalt füllen.

## Laute Abweisung {#refusal}

Mail, die gegen eine Annahmeregel verstößt, wird **während des SMTP-Dialogs** abgewiesen, nicht angenommen und versteckt:

- die Adresse ist unbekannt, abgelaufen, gelöscht oder deaktiviert;
- die Inbox hat eine Phrase, und der Betreff enthält sie nicht;
- der Workspace hat sein Monatskontingent überschritten;
- die Nachricht ist größer als 5 MiB.

Das ist wichtiger, als es klingt. Die Alternative — annehmen und dann stillschweigend verwerfen — erzeugt eine leere Inbox, die genauso aussieht wie ein Absender, der nie gesendet hat. Durch die Abweisung an der Tür erhält der Absender eine Ablehnung, die er protokollieren kann, und eine leere Inbox in Ihrem Test bedeutet *es wurde nichts gesendet* — ein anderer Bug als *etwas wurde gesendet und abgewiesen*.

Abgewiesene Mail wird nie gespeichert und nie auf den Verbrauch angerechnet.

## Drei Arten, wie eine Adresse endet {#lifecycle}

Sie werden leicht verwechselt und verhalten sich unterschiedlich.

| | Was passiert | Umkehrbar |
| --- | --- | --- |
| **Ablauf** | Die Inbox erreicht `expires_at`, ihre Adresse wird stillgelegt, und ihre gespeicherte Mail wird gelöscht. | Nein |
| **Löschen** | Sie beenden sie vorzeitig: mit **Delete inbox…** im Dashboard oder mit `DELETE /v1/inboxes/{id}`. Sofort stillgelegt, wie beim Ablauf. | Nein |
| **Deaktivieren** | Die Adresse nimmt keine Mail mehr an, und die Inbox behält, was sie bereits hat: mit **Disable** im Dashboard oder per `PATCH` mit `{"status": "disabled"}`. | Ja — aktivieren Sie sie wieder |

Im Dashboard stehen diese Aktionen im Menü ⋯ auf der Seite der Inbox, zusammen mit **Rename…** und **Empty inbox…**, womit Sie die Mail der Inbox löschen und die Inbox samt ihrer Adresse behalten. Mitglieder können eine Inbox umbenennen, deaktivieren und aktivieren; leeren und löschen dürfen sie nur die Owner und Admins des Workspaces. Die Seite einer deaktivierten Inbox weist darauf hin, mit einer Schaltfläche **Enable**. Die Lebensdauer einer Inbox wird beim Anlegen gewählt und lässt sich danach nicht ändern; sobald die Inbox abgelaufen ist oder gelöscht wurde, steht auf ihrer Seite „This inbox no longer exists“.

Eine stillgelegte Adresse wird **nie neu vergeben**, weder an Sie noch an jemand anderen: Jede Adresse, die je existiert hat, wird verzeichnet, und eine neue wird vor der Vergabe mit diesem Verzeichnis abgeglichen. Das ist eine Sicherheitseigenschaft, kein Implementierungsdetail — würde eine Wegwerf-Adresse wiederverwendet, landete irgendwann die Passwort-Zurücksetzung eines Fremden im Testlauf eines anderen. Der Vorrat geht nicht aus: Eine Adresse besteht aus 12 Zeichen aus einem Alphabet mit 32 Zeichen, das sind etwa 1,15 × 10¹⁸ Kombinationen.

Greifen Sie zu **Deaktivieren**, wenn eine Testsuite eine Adresse mit Mail überflutet und Sie das für eine Stunde stoppen wollen. Greifen Sie zu **Leeren**, wenn Sie die Adresse behalten und ohne Mail neu anfangen wollen. Greifen Sie zu **Löschen**, wenn Sie fertig sind und den Platz zurückhaben wollen — die Tarife begrenzen, wie viele Inboxen Sie gleichzeitig haben dürfen. Ältere Versionen dieser Dokumentation und das Audit-Log der API nennen das Löschen *release*.

## Ablauf ist nicht Aufbewahrung {#expiry-vs-retention}

Zwei verschiedene Uhren, und sie zu verwechseln ist die übliche Ursache für „meine Nachricht ist verschwunden“:

- **Ablauf** (`expires_at`) bestimmt, wie lange die **Adresse** lebt.
- **Aufbewahrung** bestimmt, wie lange eine angenommene **Nachricht** lesbar bleibt, und hängt von Ihrem Tarif ab.

Die kürzere gewinnt. In einem Tarif mit 24 Stunden Aufbewahrung ist eine heute empfangene Nachricht morgen nicht mehr lesbar, auch wenn die Adresse selbst eine Woche lebt. Wenn die Adresse abläuft, verschwindet alles darin sofort, unabhängig von der Aufbewahrung.

Gelöscht ist gelöscht. Es gibt kein Archiv und keine Wiederherstellung, daher schlägt ein Test, der Mail prüft, die älter ist als ihr Aufbewahrungsfenster, auf eine Weise fehl, die wie ein Zustellproblem aussieht, aber keines ist.

## Adressen liegen auf einer eigenen Domain {#domain}

Vergebene Adressen liegen auf einer eigenen Inbox-Domain, nicht auf `{{ROOT_DOMAIN}}` und nicht auf Ihrer. Das ist Absicht: Eine Domain, auf der sich Traffic von Wegwerf-Adressen sammelt, sammelt auch die Reputation, die damit einhergeht, und diese von der Domain fernzuhalten, von der Ihre echte Mail kommt, ist einen zusätzlichen DNS-Eintrag wert.

Praktisch heißt das: Schließen Sie nie von der Domain des Produkts auf die Domain der Adresse. Lesen Sie `address` aus der Antwort beim Anlegen und verwenden Sie den Wert unverändert.
