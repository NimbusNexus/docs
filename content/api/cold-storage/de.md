---
title: "Cold Storage"
description: "Speicher im Archiv-Tier mit dem günstigsten Preis pro GB und separat abgerechnetem Abruf."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Cold Storage

Cold Storage ist das Archiv-Tier — die Aufbewahrung ist günstig, der Abruf langsamer und wird nach Menge abgerechnet. Wählen Sie es, wenn Sie die Daten fast nie lesen: selten benötigte Backups, Aufbewahrung aus Compliance-Gründen, Roh-Logs für Audits.

## Wofür Sie bezahlen {#pricing}

Drei Kostenbestandteile, alle getrennt abgerechnet:

| Posten | Preis | Wann Sie zahlen |
| --- | --- | --- |
| **Speicherung** | \$0,004/GB-Monat | Fortlaufend, solange das Archiv existiert |
| **Abruf** | \$0,02–\$0,05/GB | Pro Restore-Request, abhängig von der Retrieval-Klasse |
| **Gebühr für vorzeitiges Löschen** | pro GB × verbleibende Tage | Wenn Sie vor Ablauf von 90 Tagen löschen |

Zum Vergleich: Objektspeicher (Klasse Standard) kostet \$0,013/GB-Monat (3,25× so viel) — und hat weder eine Retrieval-Gebühr noch eine Mindestlaufzeit. Der Kompromiss: weniger für das Aufbewahren zahlen, mehr für das Lesen.

## Mindestlaufzeit {#min-duration}

Für jedes Archiv fällt eine **Mindestgebühr für 90 Tage Speicherung** an. Löschen Sie ein Archiv nach 30 Tagen, werden Ihnen die verbleibenden 60 Tage beim Löschen berechnet. AWS Glacier nutzt dasselbe Modell; nur dadurch ist der Speicherpreis so niedrig.

In der Praxis: Tauschen Sie Objekte in Cold Storage nicht ständig aus. Das richtige Muster ist: einmal schreiben, dann behalten oder nach 90 Tagen löschen.

## Retrieval-Klassen {#retrieval-classes}

| Klasse | Latenz | Kosten pro GB | Wann verwenden |
| --- | --- | --- | --- |
| `expedited` | 1–5 Minuten | \$0,05 | Abrufe für Compliance; einmalige Audits mit Frist |
| `standard` | 3–5 Stunden | \$0,02 | Der Standard; kostengünstig für ungeplante Lesezugriffe |
| `bulk` | 5–12 Stunden | \$0,005 | Mehrere zehn TB oder mehr über Nacht wiederherstellen |

Ein Abruf verschiebt die Daten nicht dauerhaft aus dem Archiv — er legt für 24 Stunden eine temporäre Kopie im Objektspeicher (Klasse Standard) an, erreichbar über eine vorsignierte URL. Das Archiv selbst bleibt unverändert.

## Wann Cold Storage NICHT passt {#when-not-to-use}

- Alles, was Sie öfter als ~einmal pro Quartal lesen könnten — die Retrieval-Gebühren übersteigen dann die Ersparnis beim Speichern.
- Alles, was beim Lesen zeitkritisch ist — selbst ein Abruf mit `expedited` dauert 1–5 Minuten, nicht Sekunden.
- Daten mit bekanntermaßen kurzem Lebenszyklus — die Mindestlaufzeit von 90 Tagen macht häufiges Austauschen teuer.

In allen drei Fällen passt [Objektspeicher](/docs/api/object-storage) mit der Storage-Klasse IA oder Cold besser (niedrigere Retrieval-Gebühren, kürzere oder keine Mindestlaufzeit).

## Nächste Schritte {#next-steps}

- [Objektspeicher](/docs/api/object-storage) — dieselbe Produktfamilie, für häufigere Zugriffe.
- [Snapshots](/docs/api/snapshots) — Snapshots von VMs und Volumes liegen standardmäßig im Cold-Storage-Tier.
