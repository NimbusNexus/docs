---
title: "Von AWS RDS migrieren"
description: "Eine Postgres- oder MySQL-Datenbank live von RDS migrieren, ohne Datenverlust und mit ~30 s Downtime."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Von AWS RDS migrieren

Diese Anleitung zieht eine produktive Postgres- oder MySQL-Datenbank per logischer Replikation von AWS RDS zu den verwalteten Datenbanken von NimbusNexus um. Das Muster: Sie erstellen die Massenkopie live (ohne Downtime), streamen laufende Änderungen über WAL/Binlog und führen dann den Cutover mit einer kurzen Verbindungspause durch.

Erwartete Downtime: **~30 Sekunden** für den Cutover. Gesamtdauer: abhängig von der Datenmenge (8–30 Minuten für die erste Kopie bei typischen Größen).

Funktioniert für:

- Postgres 12+
- MySQL 8.0+

## Voraussetzungen {#prereqs}

Auf der AWS-Seite:

- Auf der RDS-Instanz muss logische Replikation aktiviert sein (`rds.logical_replication = 1` für Postgres; `binlog_format = ROW` für MySQL).
- Ein Benutzer mit Replikationsrechten (oder Sie verwenden den Master-Benutzer).
- Eingehender Netzwerkzugriff von NimbusNexus-IPs (die konkreten CIDRs holen wir gleich).
- Ein aktuelles Backup der RDS-Instanz. Für alle Fälle.

Auf der NimbusNexus-Seite:

- Ein API-Key.
- Eine gewählte Region. Die Latenz zwischen dem Migrationshost und der RDS-Quellinstanz spielt eine Rolle — wählen Sie die Region, die der RDS-Region am nächsten liegt (z. B. `us-east-1` für RDS in `us-east-1`).

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · Ziel-Cluster bereitstellen {#provision}

Erstellen Sie den Ziel-Cluster mit derselben Engine + Version wie die Quelle:

```bash
curl -X POST {{API_BASE_URL}}/v1/databases \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "app-prod-migrated",
    "engine": "postgres",
    "engine_version": "16",
    "tier": "production-4-16",
    "region": "us-east-1",
    "high_availability": true,
    "tls_required": true
  }'
```

Orientieren Sie sich bei der Instanzklasse möglichst genau an der Quelle. Ist das Ziel deutlich kleiner, riskieren Sie, dass es in der Streaming-Phase von WAL/Binlog zurückfällt. Nach Abschluss der Migration können Sie die Größe ändern.

Speichern Sie die Cluster-ID:

```bash
export DB_ID="db_01HG7..."
```

Warten Sie auf `state: running` (4–7 Minuten).

## 2 · NimbusNexus-IPs in RDS auf die Allow-List setzen {#allowlist}

Rufen Sie die Egress-CIDRs unserer Migrations-Worker in Ihrer Region ab:

```bash
curl {{API_BASE_URL}}/v1/databases/migration-source-cidrs?region=us-east-1 \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Die Antwort ist eine Liste von Blöcken der Größe `/24`. Fügen Sie sie den eingehenden Regeln Ihrer RDS-Sicherheitsgruppe für den Postgres- oder MySQL-Port hinzu. Beschränken Sie den Zugriff auf genau diese CIDRs — öffnen Sie nicht `0.0.0.0/0`.

## 3 · Migration starten {#kick-off}

```bash
curl -X POST {{API_BASE_URL}}/v1/databases/$DB_ID/migrate \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "host": "mydb.abc123.us-east-1.rds.amazonaws.com",
      "port": 5432,
      "database": "app",
      "username": "migration_user",
      "password": "••••",
      "tls_required": true
    },
    "mode": "logical-replication"
  }'
```

Die Antwort enthält eine `migration_id`:

```bash
export MIG_ID="mig_01HG7Y3..."
```

Die Migration läuft in drei Phasen, die die API explizit ausweist:

1. **`copying`** — die Massenkopie. Liest jede Zeile aus der Quelle und schreibt sie ins Ziel. Nimmt die meiste Zeit in Anspruch. Die Quelle bleibt währenddessen voll betriebsbereit; Lese- und Schreibzugriffe laufen normal weiter.
2. **`streaming`** — sobald die Kopie fertig ist, folgt das Ziel dem WAL (Postgres) bzw. Binlog (MySQL) der Quelle. Der Rückstand liegt in dieser Phase typischerweise bei < 1 Sekunde.
3. **`cutover-ready`** — die Kopie ist fertig, das Streaming hat aufgeholt. Sie können den Cutover durchführen.

## 4 · Fortschritt beobachten {#progress}

```bash
while true; do
  curl -s {{API_BASE_URL}}/v1/databases/migrations/$MIG_ID \
    -H "Authorization: Bearer $NIMBUS_KEY" \
    | jq '{ phase, rows_copied, rows_total, lag_seconds }'
  sleep 30
done
```

Achten Sie auf:

- `phase: 'copying'` → `phase: 'streaming'` (erste Kopie fertig)
- `lag_seconds` sinkt auf 0–2 (aufgeholt)
- `phase: 'cutover-ready'` (Cutover möglich)

Bei großen Datenbanken (~100 GB+) abonnieren Sie den [Webhook `database.migration.cutover_ready`](/docs/webhooks#events), damit Sie benachrichtigt werden, wenn es so weit ist.

## 5 · Der Cutover {#cutover}

Sobald Sie bei `cutover-ready` sind, läuft das Cutover-Fenster so ab:

1. **Schreibzugriffe auf die Quelle pausieren.** Stoppen Sie Ihre App oder setzen Sie die RDS-Instanz auf schreibgeschützt. Kritischer Schritt — alles, was danach noch in die Quelle geschrieben wird, kommt nicht im Ziel an.
2. **Auf `lag_seconds: 0` warten.** Das sollte fast sofort der Fall sein, da die Schreibzugriffe pausiert sind.
3. **Das Ziel hochstufen:**

   ```bash
   curl -X POST {{API_BASE_URL}}/v1/databases/migrations/$MIG_ID/cut-over \
     -H "Authorization: Bearer $NIMBUS_KEY"
   ```

4. **Ihre App auf den neuen Connection-String umstellen.** Den neuen Connection-String erhalten Sie über `GET /v1/databases/$DB_ID/connection`.
5. **Traffic wieder aufnehmen.** Ihre App schreibt jetzt in den neuen Cluster.

Gesamtdauer der Schritte 1–5: typischerweise 20–40 Sekunden.

Der Aufruf zum Hochstufen ist zugleich ein Bestätigungsschritt — bis Sie ihn senden, folgt das Ziel weiter der Quelle. Wenn also mitten im Cutover etwas schiefgeht, ist die ursprüngliche RDS-Instanz weiterhin maßgeblich; nehmen Sie den Traffic einfach dort wieder auf. Sie können die Migration jederzeit erneut ausführen.

## 6 · Prüfen {#verify}

Senden Sie nach dem Cutover eine kurze Abfrage zur Bestätigung:

```bash
psql "postgresql://app:••••@{{DB_HOST_DEMO}}:5432/app?sslmode=verify-full" \
  -c "SELECT count(*) FROM users;"
```

Vergleichen Sie die Zählwerte mit Ihren Aufzeichnungen von vor der Migration. Prüfen Sie stichprobenartig einige Zeilen.

## 7 · Migrationsjob abbauen und RDS außer Betrieb nehmen {#cleanup}

```bash
curl -X DELETE {{API_BASE_URL}}/v1/databases/migrations/$MIG_ID \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Der Migrationsjob folgt der Quelle nicht mehr und gibt seine Ressourcen frei. Der Ziel-Cluster läuft normal weiter; nur die Migrationsinfrastruktur verschwindet.

Nehmen Sie RDS auf der AWS-Seite außer Betrieb — erst einen Snapshot erstellen, dann die Instanz löschen. Bewahren Sie den Snapshot eine Woche lang als Sicherheitsnetz auf.

## Häufige Stolperfallen {#gotchas}

- **Sequenzen nicht synchron.** Die logische Replikation von Postgres repliziert das Fortschreiten von Sequenzen nicht. Führen Sie nach dem Cutover `SELECT pg_catalog.setval(seq_name, max(id)) FROM ...` für jede Sequenz aus, um sie über den Maximalwert der zugehörigen Tabelle hinaus vorzurücken.
- **Rollen + Berechtigungen werden nicht repliziert.** Legen Sie sie vor dem Cutover im Ziel neu an. Verwenden Sie `pg_dumpall --roles-only` (Postgres) oder ein Äquivalent.
- **Extensions werden nicht repliziert.** Wenn Ihre Quelle `pgvector`, `postgis` usw. nutzt, aktivieren Sie sie im Ziel, bevor Sie die Migration starten.
- **Vergessen Sie nicht die Historie von `pg_stat_statements`.** Die logische Replikation kopiert sie nicht. Führen Sie nach dem Cutover im Ziel `SELECT pg_stat_statements_reset()` aus, damit Ihr Monitoring eine saubere Ausgangsbasis sieht.

## Nächste Schritte {#next-steps}

- [Referenz für verwaltete Datenbanken](/docs/api/managed-databases) — alle Optionen für den Ziel-Cluster.
- [Produktionsreifes Postgres in 10 Minuten](/docs/guides/postgres-production) — dasselbe Setup ohne Migration.
- [Backups](/docs/api/backups) — tägliche Backups + 7 Tage PITR für den neuen Cluster planen.
