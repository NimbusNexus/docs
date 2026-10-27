---
title: "Verwaltete Datenbanken"
description: "Verwaltetes Postgres, MySQL, MongoDB, Redis, Kafka und OpenSearch — bereitstellen, Snapshots erstellen, wiederherstellen."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Verwaltete Datenbanken

NimbusNexus betreibt sechs Datenbank-Engines als verwaltete Dienste. Wir übernehmen den Betrieb — Failover, Backups, Upgrades auf neue Minor-Versionen, OS-Patches — und Sie erhalten einen Connection-String und auf der anderen Seite das native Protokoll der Engine. **Kein proprietäres Wire-Format, keine spezielle Client-Bibliothek nötig**: Verbinden Sie sich mit `psql`, `mongo`, dem offiziellen Kafka-Client usw.

## Engines {#engines}

| Engine | Wofür | Einstiegsgröße |
| --- | --- | --- |
| `postgres` | Transaktionale Workloads, die sichere Standardwahl für „Ich brauche eine Datenbank.“ | `db-1-4` |
| `mysql` | Wenn die App oder das Team bereits MySQL nutzt. Für neue Projekte ist PostgreSQL die richtige Standardwahl. | `db-1-4` |
| `mongodb` | Dokumentbasierte Workloads, dynamische Schemas, Replica-Set-Semantik. | `db-2-8` |
| `redis` | Cache, Session-Store, Pub/Sub, Queues. Keine SQL-Schnittstelle. | `db-1-2` |
| `kafka` | Event-Streaming, Log-Aggregation, dauerhaftes Pub/Sub. Mindestens drei Broker. | `db-2-8` × 3 |
| `opensearch` | Volltextsuche, Log-Analyse. | `db-4-16` |

Größencodes folgen derselben Konvention wie bei VMs (`db-<vCPU>-<RAM_GB>`), mit einem eigenen Preismultiplikator pro Engine — Redis ist auf derselben Hardware günstiger als Postgres, weil es kein WAL auf der Disk gibt; MongoDB ist teurer wegen des Lizenzaufwands für Replica-Sets.

## Lebenszyklus {#lifecycle}

Datenbanken durchlaufen fünf Zustände:

- `provisioning` — die Instanz(en) starten. 60–120 Sekunden für Engines mit einem Knoten (Postgres, MySQL, Redis), 90–180 Sekunden für replizierte (MongoDB, Kafka, OpenSearch).
- `running` — nimmt Verbindungen über den veröffentlichten Connection-String an.
- `maintenance` — ein Minor-Upgrade oder Patch wird eingespielt. Verbindungen bleiben bestehen; während des Cutovers ist die Datenbank kurz nicht verfügbar (typischerweise <5 Sekunden bei Postgres/MySQL, länger bei Kafka).
- `stopping` → `stopped` — pausiert. Compute wird nicht mehr abgerechnet; Speicher schon. Jederzeit neu startbar.
- `terminated` — gelöscht.

Der Zustand steht in jeder GET-Antwort im Feld `state`. Lang laufende Übergänge (erste Bereitstellung, Versions-Upgrade) melden ihren Fortschritt in einem eingebetteten Objekt `operation` — siehe [Konventionen](/docs/conventions).

## Backups und Snapshots {#backups}

Zwei Backup-Mechanismen laufen parallel:

- **Kontinuierliches WAL-Backup** (nur Postgres, MySQL). Standardmäßig aktiv. Wir übertragen das Write-Ahead-Log alle ~5 Sekunden in den Objektspeicher und können auf jeden Zeitpunkt der letzten 7 Tage wiederherstellen. **Point-in-Time-Recovery**.
- **On-Demand-Snapshots** (jede Engine). Ausgelöst durch `POST /v1/databases/{id}/snapshots`. Konsistent (ohne dass I/O angehalten werden muss), im Objektspeicher abgelegt, in eine neue Datenbank in derselben Region wiederherstellbar.

Snapshots sind unabhängig von der Quelldatenbank — wenn Sie die Quelle löschen, bleiben die Snapshots erhalten. Die Aufbewahrung beträgt standardmäßig 7 Tage; verlängern Sie sie im Dashboard oder mit `retention_days` im Snapshot-Request.

## Verbindungen {#connections}

Die GET-Antwort jeder Datenbank enthält ein Objekt `connection`:

```json
{
  "connection": {
    "host": "{{DB_HOST_DEMO}}",
    "port": 5432,
    "database": "main",
    "username": "nimbus",
    "password_secret": "secret://projects/.../database-passwords/db_01H8FZ...",
    "ssl": "require"
  }
}
```

Das Passwort wird als Secret-URL referenziert, nicht direkt eingebettet — rufen Sie es über `GET /v1/secrets/{secret-id}` ab und speichern Sie es für die Lebensdauer der Verbindung zwischen. So landen Passwörter nicht in Logs, die vollständige Datenbankdatensätze erfassen.

Alle Datenbanken erzwingen TLS für Client-Verbindungen. Selbstsignierte Zertifikate werden nicht akzeptiert; wir veröffentlichen das CA-Bundle unter `/v1/databases/ca-bundle.pem`. Postgres-/MySQL-Clients sollten `sslmode=verify-full` verwenden und `sslrootcert` auf das Bundle zeigen lassen.

## Versionen und Upgrades {#versions}

- **Minor-Versionen** werden im wöchentlichen Wartungsfenster automatisch eingespielt (sonntags 02:00–04:00 Uhr in der Region der Datenbank, konfigurierbar). Ohne Downtime bei Postgres/MySQL mit kontinuierlichem WAL; bei Engines mit Replica-Sets gibt es ein kurzes Failover.
- **Major-Versionen** erfordern einen expliziten Aufruf von `POST /v1/databases/{id}/upgrade`. Wir testen das Upgrade an einem Snapshot mit Ihren Daten, bevor wir das Primary umschalten; ein fehlgeschlagenes Upgrade führt so zu einem Rollback, nicht zu beschädigten Daten.

Major-Versionen werden ab dem Upstream-Release mindestens 24 Monate lang unterstützt. End-of-Life-Termine veröffentlichen wir im Changelog mit mindestens 90 Tagen Vorlauf.

## Hinweise zu Preisen {#pricing}

- Compute: sekundengenau, pro vCPU-Äquivalent, mit einem Multiplikator pro Engine (siehe [Preisseite]({{BASE_URL}}/managed-databases)).
- Speicher: \$0,18/GB-Monat (Performance-NVMe, der Standard).
- Backups: \$0,04/GB-Monat für das Snapshot-Tier.
- Cross-Region-Replikation (wo unterstützt): abgerechnet als normaler Egress zwischen Regionen (\$0,005/GB).
- Keine Gebühr pro Verbindung, keine Abrechnung nach IOPS, keine Kosten für Failover-Ereignisse.

Der Einstiegspreis liegt bei \$19/Monat für ein Postgres mit `db-1-4` in Virginia — das ist eine Instanz mit 1 vCPU / 4 GB / 50 GB, die kleinste Größe, die für Produktions-Workloads sinnvoll ist.

## Nächste Schritte {#next-steps}

- [Authentifizierung](/docs/authentication) zum Bearer-Token-Muster, das alle Endpoints gemeinsam haben.
- [Konventionen](/docs/conventions) dazu, wie Operationen, Paginierung und Fehler funktionieren.
- [Blockspeicher](/docs/api/block-storage) — wenn Sie Ihre eigene Datenbank auf einer VM betreiben, liegt sie auf dieser Disk.
- Der Artikel **Postgres / MySQL / Mongo / Redis: wann welche Datenbank passt** unter [Ressourcen](/resources/postgres-mysql-mongo-redis-when-to-use) — eine Anleitung zur Wahl der Engine.
