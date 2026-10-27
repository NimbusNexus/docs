---
title: "Produktionsreifes Postgres in 10 Minuten"
description: "Ein verwaltetes Postgres mit HA, Backups und Upgrades ohne Downtime bereitstellen — mit drei API-Aufrufen."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Produktionsreifes Postgres in 10 Minuten

Am Ende dieser Anleitung haben Sie einen verwalteten Postgres-16-Cluster mit:

- Drei Knoten (einem Primary, zwei Replikaten), verteilt über Availability Zones
- Automatischen täglichen Backups + 7 Tagen Point-in-Time-Recovery
- Aktiviertem Connection-Pooler
- Zugriff nur per TLS von einer IP auf der Allow-List
- Einem Connection-String, den Sie direkt in Ihre App übernehmen können

Gesamtdauer: etwa 10 Minuten (größtenteils für die Bereitstellung des Clusters).

## Voraussetzungen {#prereqs}

- Ein NimbusNexus-Konto mit einem API-Key. Siehe [Schnellstart: erste VM](/docs/quickstart), falls Sie noch keinen haben.
- Die gewünschte Region — Virginia (`us-east-1`), Los Angeles (`us-west-1`), Frankfurt (`eu-central-1`) oder Singapur (`ap-southeast-1`).
- Lokal installiertes `psql`, wenn Sie sich am Ende verbinden wollen.

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · Cluster erstellen {#create}

```bash
curl -X POST {{API_BASE_URL}}/v1/databases \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "app-prod",
    "engine": "postgres",
    "engine_version": "16",
    "tier": "production-4-16",
    "region": "us-east-1",
    "high_availability": true,
    "backup_retention_days": 7,
    "connection_pooler": true,
    "tls_required": true
  }'
```

Was die einzelnen Optionen bewirken:

- `tier: 'production-4-16'` — 4 vCPU, 16 GB RAM, 200 GB SSD. Die richtige Größe für Apps mit wenig bis mittlerem Traffic (~1.000 QPS). Siehe [die Tier-Tabelle](/docs/api/managed-databases) für die vollständige Liste der Größen.
- `high_availability: true` — Primary + zwei Replikate über AZs verteilt. Erhöht die Kosten um ~80 %; erspart Ihnen viele Pager-Einsätze.
- `backup_retention_days: 7` — tägliches Voll-Backup + kontinuierliches WAL-Streaming, wiederherstellbar auf jeden Zeitpunkt der letzten 7 Tage.
- `connection_pooler: true` — PgBouncer auf Port 6432 aktiviert. Nutzen Sie ihn aus jeder App, bei der Sie die Größe des Connection-Pools selbst steuern (bei den meisten ist das so).
- `tls_required: true` — Verbindungen ohne TLS werden am Listener abgelehnt. Setzen Sie das immer.

Die Antwort enthält die `id` des Clusters. Speichern Sie sie:

```bash
export DB_ID="db_01HG7..."
```

## 2 · Warten, bis der Cluster bereit ist {#wait}

Die Bereitstellung dauert 4–7 Minuten. Fragen Sie ab, bis `state` den Wert `running` hat:

```bash
while true; do
  state=$(curl -s {{API_BASE_URL}}/v1/databases/$DB_ID \
    -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.state')
  echo "state: $state"
  [ "$state" = "running" ] && break
  sleep 10
done
```

Wenn Sie lieber einen Webhook erhalten, [abonnieren Sie `database.created`](/docs/webhooks#events) und lassen die Polling-Schleife weg.

## 3 · Eigene IP auf die Allow-List setzen {#allowlist}

Standardmäßig akzeptiert der Cluster Verbindungen von jeder Quelle, zu der er routen kann. Für die Produktion brauchen Sie eine explizite Allow-List:

```bash
MY_IP=$(curl -s ifconfig.me)/32

curl -X POST {{API_BASE_URL}}/v1/databases/$DB_ID/allowlist \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"cidr\": \"$MY_IP\", \"description\": \"my laptop\" }"
```

Fügen Sie einen Eintrag pro CIDR hinzu, den Sie zulassen wollen. Für eine VM, die diese DB erreichen muss, fügen Sie den CIDR ihrer Floating-IP hinzu (oder ihren ausgehenden NAT-CIDR, falls sie hinter einem NAT steht). Einträge der Allow-List sind zustandsbehaftet — wenn Sie einen entfernen, werden neue Verbindungen unterbunden; bestehende Verbindungen bleiben bestehen, bis sie wegen Inaktivität ablaufen oder Sie den Cluster neu starten.

## 4 · Verbinden {#connect}

Rufen Sie die Verbindungsdaten ab:

```bash
curl -s {{API_BASE_URL}}/v1/databases/$DB_ID/connection \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Antwort:

```json
{
  "host": "{{DB_HOST_DEMO}}",
  "port": 5432,
  "pooler_port": 6432,
  "database": "app",
  "username": "app",
  "password": "•••• (one-time view in dashboard)",
  "tls_root_cert_url": "{{BASE_URL}}/ca-certs/nimbusnexus-root.pem"
}
```

Laden Sie das Root-Zertifikat einmal herunter:

```bash
curl -o ~/.postgresql/nn-root.crt {{BASE_URL}}/ca-certs/nimbusnexus-root.pem
```

Verbinden Sie sich:

```bash
psql "postgresql://app:••••@{{DB_HOST_DEMO}}:6432/app?sslmode=verify-full&sslrootcert=~/.postgresql/nn-root.crt"
```

Verwenden Sie von App-Servern aus Port `6432` (Pooler); Port `5432` nur für Admin- und Migrationstools, die direkten Zugriff auf das Primary brauchen (z. B. `pg_dump`, `pg_restore`, Tools für Schemamigrationen, die Advisory Locks setzen).

`sslmode=verify-full` prüft das Zertifikat gegen den Hostnamen — die richtige Voreinstellung. `verify-ca` ist ebenfalls akzeptabel; `require` ist außerhalb der Produktion akzeptabel, überspringt aber die Prüfung des Hostnamens (und damit den Schutz vor einer Klasse von MITM-Angriffen). Verwenden Sie nie `prefer` oder `disable`.

## Zusammenfassung {#summary}

Sie haben jetzt einen Postgres-Cluster in Produktionsqualität:

- Drei Knoten, automatisches Failover
- Tägliche Backups + 7 Tage PITR
- Connection-Pooler aktiviert (Port 6432)
- TLS erforderlich, Zugriff per Allow-List beschränkt
- Kosten: etwa $200/Monat für das Tier `production-4-16` mit HA + 7 Tagen Backups in us-east-1

Derselbe Aufbau funktioniert für MySQL, MongoDB, Redis, Kafka, OpenSearch — ändern Sie `engine` und `engine_version`; die übrigen Optionen gelten weiter, mit Standardwerten passend zur Engine.

## Nächste Schritte {#next-steps}

- [Referenz für verwaltete Datenbanken](/docs/api/managed-databases) — alle Optionen für den Aufruf zum Erstellen, alle Endpoints zur Verwaltung des Clusters.
- [Anleitung zur Migration von AWS RDS](/docs/guides/migrate-from-rds) — dasselbe Setup, mit einer einmaligen Datenmigration aus einem bestehenden RDS-Cluster.
- [Plattform-Webhooks](/docs/webhooks) — binden Sie die Events `database.created`, `database.upgrade_completed` und `backup.completed` an Ihr Monitoring an.
- [Snapshots](/docs/api/snapshots) — Point-in-Time-Kopien auf Abruf als Sicherheitsprüfung vor einem Deployment.
