---
title: "Objektspeicher"
description: "S3-kompatible Buckets mit drei Storage-Klassen und kostenlosem Transfer zu VMs in derselben Region."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Objektspeicher

Der Objektspeicher von NimbusNexus stellt die **AWS-S3-API** bereit. Bestehende Tools und Bibliotheken — die CLI `aws s3`, boto3, die offiziellen SDKs für Java/Go/Node, jedes Framework, das S3 spricht — funktionieren unverändert, sobald Sie sie auf unseren Endpoint richten und unsere Credentials eintragen.

## Was S3-kompatibel ist und was nicht {#compat}

Wir implementieren die Operationen, die 90 % der S3-Aufrufer nutzen:

- Bucket-CRUD (`PutBucket`, `GetBucket`, `DeleteBucket`)
- Objekt-CRUD (`PutObject`, `GetObject`, `DeleteObject`, `HeadObject`, `ListObjects`/`ListObjectsV2`)
- Multipart-Upload (`CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`)
- Vorsignierte URLs (sig v4)
- Objektmetadaten, Content-Type, Custom-Header
- Serverseitige Verschlüsselung (immer aktiv, AES-256)

Wir implementieren **nicht**:

- AWS-spezifisches IAM (wir haben unser eigenes — verwenden Sie für die Management-API das Bearer-Token-Modell aus [Authentifizierung](/docs/authentication); S3-Credentials werden separat ausgestellt).
- S3 Object Lock / WORM-Compliance (geplant für Q4 2026).
- S3 Select (serverseitige Abfrage).
- Cross-Region-Replikation über die S3-API (wir bieten sie stattdessen über die Management-API an, mit übersichtlicheren Preisen).

Nutzt Ihre App eine S3-Funktion, die nicht in der Liste der unterstützten Funktionen steht, erhält sie `501 Not Implemented` mit dem Namen der Operation in `error.code`. Wechseln Sie zur unterstützten Entsprechung oder stellen Sie eine Funktionsanfrage.

## Storage-Klassen {#classes}

Drei Klassen, gewählt beim Schreiben des Objekts (oder als Standard pro Bucket):

| Klasse | Pro GB-Monat | Latenz bis zum ersten Byte | Mindestlaufzeit | Wann verwenden |
| --- | --- | --- | --- | --- |
| `standard` | \$0,013 | <50 ms | Keine | Häufig genutzte Daten — Web-Assets, häufige Lesezugriffe, alles, was live ausgeliefert wird. |
| `ia` | \$0,007 | <50 ms | 30 Tage | „Infrequent access“ (seltener Zugriff) — gelegentlich abgerufen, dann aber schnell gebraucht. Gleiche Abrufleistung wie Standard, halber Speicherpreis, eine Retrieval-Gebühr pro GB. |
| `cold` | \$0,004 | 1–60 Minuten | 90 Tage | Archiv — Backups, Roh-Logs, Aufbewahrung aus Compliance-Gründen. Günstiger in der Aufbewahrung, langsamer im Abruf. |

Mindestlaufzeit bedeutet: Wenn Sie ein Objekt vor Ablauf des Mindestzeitraums löschen, zahlen Sie den Preis pro GB für den Rest des Zeitraums. Das ist das „Infrequent“ in IA: Es ist günstig, wenn Objekte liegen bleiben, und teuer, wenn Sie sie ständig austauschen.

Für reine Archivzwecke, bei denen Sie die Daten fast nie lesen, siehe [Cold Storage]({{BASE_URL}}/cold-storage) — ein eigenes Archivprodukt mit noch günstigeren Preisen (\$0,004/GB-Monat pauschal, plus Retrieval-Gebühren).

## Egress, der eigentliche Unterschied {#egress}

Der größte Unterschied zu AWS S3 ist, **wie Egress abgerechnet wird**:

- VM ↔ Objektspeicher **in derselben Region**: **kostenlos**, immer. Das ist bei den meisten Workloads der Hauptlastpfad — Ihre VMs sprechen mit Ihren Buckets — und wir berechnen ihn nicht. Effektiver Egress für Produktions-Traffic, der innerhalb einer Region bleibt: \$0.
- Internet-Egress: \$0,009/GB, wobei das erste **1 TB pro Monat kostenlos** ist (pro Projekt). Zum Vergleich: AWS S3 berechnet \$0,09/GB für die ersten 10 TB.
- Cross-Region-Egress: \$0,005/GB. Günstiger als Internet-Egress, weil der Weg über unseren Backbone läuft, nicht über das offene Internet.

Die Zeile „kostenloser Transfer zu VMs in derselben Region“ auf der Marketingseite ist eine echte architektonische Zusage, keine Werbeaktion. Ziel ist, mehrschichtige Architekturen (Objektspeicher als maßgebliche Datenquelle, davor VMs, die lesen und ausliefern) wirtschaftlich zu machen.

## Bucket-Namen {#naming}

Bucket-Namen sind **über alle NimbusNexus-Mandanten hinweg global eindeutig** — dieselbe Regel wie bei AWS. DNS-kompatibel: Kleinbuchstaben, 3–63 Zeichen, keine Unterstriche, keine Bindestriche am Anfang/Ende. Bucket-Name-Squatting ist der Hauptgrund, wichtige Namen früh zu sichern.

Bucket-Namen stehen in der URL: `https://<bucket>.{{S3_HOST_US_EAST_1}}/<key>` oder im Pfadstil unter `{{S3_ENDPOINT_US_EAST_1}}/<bucket>/<key>`. Beide Stile funktionieren; SDK-Clients wählen je nach Konfiguration einen davon.

## Auflisten, Paginierung, Performance {#listing}

`ListObjectsV2` gibt bis zu 1.000 Keys pro Request zurück, lexikografisch nach Key sortiert. Ab 1.000 paginieren Sie mit `continuation_token` — wie bei S3.

Für sehr breite Buckets (Millionen von Keys) verwenden Sie **Auflistung mit Trennzeichen**: Übergeben Sie `delimiter=/`, um eine Auflistung im Verzeichnisstil zu erhalten, bei der Keys nach Präfix gruppiert sind. Das Auflisten eines „Verzeichnisses“ mit Trennzeichen durchsucht nur dessen direkte Kinder, nicht den ganzen Bucket.

Objekte der Klasse Cold erscheinen in einer Listenantwort genauso wie Standard / IA — das Auflisten löst keinen Abruf aus, nur `GetObject` tut das. Sie können einen Cold-Bucket mit 100 Mio. Objekten kostenlos durchsuchen; ein Objekt aus Cold wiederherzustellen kostet eine eigene Gebühr pro GB.

## Nächste Schritte {#next-steps}

- [Authentifizierung](/docs/authentication) — Authentifizierung per Bearer-Token für die Management-API. S3-Credentials (Access-Key + Secret-Key) werden separat über die Management-API ausgestellt.
- [Blockspeicher](/docs/api/block-storage) — wenn Sie ein Dateisystem statt eines Key-Value-Stores wollen oder POSIX-Semantik brauchen.
- [Mosaic-Editor]({{BASE_URL}}/products/mosaic) — browserbasierter Editor für YAML-/JSON-/Markdown-Dateien in Ihren Buckets. Kostenlos mit jedem Speicherkonto.
