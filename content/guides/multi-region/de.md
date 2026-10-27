---
title: "Multi-Region-Failover"
description: "Failover auf DNS-Ebene über zwei Regionen, mit Routing anhand von Health-Checks. ~30 s RTO."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Multi-Region-Failover

Floating-IPs sind regionsgebunden — sie können nicht zwischen Regionen wechseln. Für ein Failover über Regionen hinweg (Ausfall einer ganzen Region, regional verschlechterte Latenz) ist Routing auf DNS-Ebene mit Health-Checks der richtige Baustein. Latenzbasiertes Routing leitet jeden Nutzer zur nächstgelegenen gesunden Region; fällt eine Region aus, nimmt die DNS-Schicht sie aus der Rotation.

Ziel-RTO mit diesem Setup: **20–60 Sekunden**, je nach TTL und danach, wie schnell Ihre DNS-Resolver erneut abfragen.

## Was Sie einrichten {#overview}

```text
                    your customers
                          │
                  app.example.com  ← DNS A record set
                          │
            ┌─────────────┴─────────────┐
            ↓                           ↓
       us-east-1                   eu-central-1
   (203.0.113.5/32)             (198.51.100.5/32)
        VM-A                        VM-B
        │                            │
        └─ replicated DB ───────────┘
              (logical replication)
```

DNS löst zu der Region auf, die näher am Resolver liegt. Besteht eine Region ihren Health-Check nicht, liefert DNS die IP dieser Region nicht mehr aus, bis sie sich erholt hat.

## Voraussetzungen {#prereqs}

- Zwei VMs in verschiedenen Regionen, jede hinter einer [Floating-IP](/docs/api/floating-ips).
- Ihre Anwendung läuft auf beiden VMs und ist bereit, Traffic zu bedienen.
- Eine Datenbank oder ein zustandsbehafteter Speicher, der in beiden Regionen existiert und zwischen ihnen repliziert wird. Für Postgres ist [logische Replikation wie bei der Migration von RDS](/docs/guides/migrate-from-rds) derselbe Baustein. Für Redis spiegeln Sie Cache-Misses; für Objektspeicher verwenden Sie [Cross-Region-Replikation](/docs/api/object-storage#cross-region).
- Eine DNS-Zone, die bei NimbusNexus DNS gehostet wird (oder bei einem beliebigen DNS-Anbieter, der Record-Sets mit Health-Checks unterstützt — Route53, Cloudflare usw.).
- Ein Health-Check-Endpoint, der wirklich prüft, ob Ihre Anwendung Traffic bedienen kann (nicht nur `200 OK` auf `/healthz`).

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export ZONE_ID="zone_01HG7..."
export EAST_IP_ID="ip_01HG7Y3..."      # floating IP in us-east-1
export WEST_IP_ID="ip_01HG7Y4..."      # floating IP in eu-central-1
```

## 1 · Record-Set mit mehreren Werten erstellen {#record-set}

Legen Sie ein A-Record-Set mit den IPs beider Regionen und latenzbasiertem Routing an:

```bash
EAST_IPV4=$(curl -s {{API_BASE_URL}}/v1/floating-ips/$EAST_IP_ID \
  -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.ipv4')

WEST_IPV4=$(curl -s {{API_BASE_URL}}/v1/floating-ips/$WEST_IP_ID \
  -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.ipv4')

curl -X POST {{API_BASE_URL}}/v1/dns/zones/$ZONE_ID/records \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"app.example.com\",
    \"type\": \"A\",
    \"routing_policy\": \"latency\",
    \"ttl\": 60,
    \"values\": [
      { \"value\": \"$EAST_IPV4\", \"region\": \"us-east-1\" },
      { \"value\": \"$WEST_IPV4\", \"region\": \"eu-central-1\" }
    ]
  }"
```

Wichtige Felder:

- `routing_policy: 'latency'` — DNS-Resolver erhalten die IP der geografisch nächstgelegenen Region. Alternativen: `'weighted'` (prozentuale Aufteilung), `'failover'` (Primär/Sekundär, nie Round-Robin), `'geo'` (Routing nach dem Land des Clients).
- `ttl: 60` — TTL von 60 Sekunden. Niedrigere TTL = schnelleres Failover (Resolver fragen früher erneut ab), auf Kosten von mehr DNS-Abfragen. Für einen Dienst mit hohen Verfügbarkeitsanforderungen ist 60 richtig; für Setups mit niedrigerem SLA ist 300 in Ordnung.

## 2 · Health-Checks hinzufügen {#health-checks}

Jeder Wert im Record-Set erhält einen Health-Check. Fehlgeschlagene Checks nehmen diesen Wert aus der Rotation:

```bash
curl -X POST {{API_BASE_URL}}/v1/dns/zones/$ZONE_ID/records/$RECORD_ID/health-checks \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "value_index": 0,
    "type": "https",
    "path": "/healthz",
    "expected_status": 200,
    "interval_seconds": 10,
    "failure_threshold": 3,
    "success_threshold": 2
  }'
```

Wiederholen Sie das für `value_index: 1` (die zweite Region). Was die einzelnen Felder bewirken:

- `interval_seconds: 10` — Prüfung alle 10 Sekunden.
- `failure_threshold: 3` — drei Fehlschläge in Folge, bevor der Wert als ausgefallen gilt. Zusammen mit `interval_seconds` sind das 30 Sekunden, bis eine Region herausfällt — knapp über dem Schwellenwert für kurze Netzwerkaussetzer, weit unter „das merken wir schon in PagerDuty“.
- `success_threshold: 2` — zwei Erfolge in Folge, bevor der Wert wieder als verfügbar gilt. Verhindert ständiges Hin- und Herschalten während einer wackeligen Erholung.

Der Health-Check-Endpoint ist wichtig. Lassen Sie ihn nicht bedingungslos `return 200 OK` ausführen — das macht den Zweck zunichte. Lassen Sie ihn tatsächlich nachgelagerte Abhängigkeiten prüfen (Datenbankverbindung, Cache, die Queue), damit er fehlschlägt, wenn auch die Anwendung fehlschlagen würde.

## 3 · Testen {#test}

Erzwingen Sie einen „Ausfall“, indem Sie die Health-Check-Probe in einer Region blockieren:

```bash
# On the us-east-1 VM, drop traffic from the health-check source CIDR
sudo iptables -A INPUT -s <healthcheck-cidr> -j DROP
```

(Die Quell-CIDRs der Health-Checks erhalten Sie über `GET /v1/dns/healthcheck-source-cidrs`.)

Innerhalb von 30 Sekunden sollte das Record-Set die IP von us-east-1 nicht mehr zurückgeben:

```bash
dig +short app.example.com
# Should return only the eu-central-1 IP for the next several seconds
```

Machen Sie die iptables-Regel rückgängig, um die Region wiederherzustellen. Innerhalb von 20 Sekunden (`2 * interval_seconds`) sollte sie wieder in die Rotation aufgenommen werden.

## 4 · Datenbankreplikation {#db}

Die DNS-Schicht regelt, wo der Traffic landet; die Datenschicht ist schwieriger. Die Muster:

**Für überwiegend lesende Workloads:**

- Primary-DB in einer Region, Lesereplikat in der anderen.
- Die App liest aus der lokalen Region (in der sekundären Region aus dem Replikat).
- Schreibzugriffe gehen immer an das Primary (die sekundäre Region hat also eine höhere Schreiblatenz).
- Bei Ausfall der Primary-Region: Stufen Sie das Replikat zum Primary hoch und verlagern Sie Lese- und Schreibzugriffe per Failover auf das neue Primary.

**Für schreibintensive Workloads, die Multi-Master vertragen:**

- Verwenden Sie eine Datenbank, die Active-Active-Replikation unterstützt (CockroachDB, YugabyteDB).
- Beide Regionen lesen und schreiben lokal; Konflikte löst die Engine.
- Aufwendiger im Betrieb; nur gerechtfertigt, wenn die Schreiblatenz bei einem einzelnen Master ein echtes Problem ist.

**Für Cache und Queue:**

- Cache: Rechnen Sie nach dem Failover mit einem kalten Cache. Die meisten Apps erholen sich innerhalb von Minuten; die Einbuße beim SLA ist tolerierbar.
- Queue: Halten Sie Queues pro Region; die Anwendung akzeptiert, dass eine regionale Queue nicht verfügbar sein kann, bis sich die Region erholt.

NimbusNexus bietet noch kein Datenbankprodukt mit Active-Active über mehrere Regionen an. Verwalten Sie die Replikation vorerst selbst, über logische Replikation (Postgres), Binlog (MySQL) oder Change Streams (MongoDB).

## Was das nicht ist {#not}

- **Kein Active-Active-Failover für Zustand**: Schreibzugriffe konzentrieren sich weiterhin auf ein Primary. Die DNS-Schicht lenkt die Nutzer; die Datenbankschicht ist meistens weiterhin Single-Master.
- **Nicht transparent für Clients**: TCP-Verbindungen zur IP der ausgefallenen Region werden zurückgesetzt; Clients verbinden sich neu (die meisten HTTP-Clients kommen damit gut zurecht; manche Long-Polling- oder SSE-Clients brauchen einen Retry-Handler).
- **Kein RTO von null**: 20–60 Sekunden sind bei TTL = 60 die Untergrenze. Eine niedrigere TTL hilft, aber auf Kosten von mehr DNS-Abfragen.

## Nächste Schritte {#next-steps}

- [DNS-Zonen](/docs/api/dns-zones) — die Zonen-API, in der das Record-Set liegt.
- [DNS-Einträge](/docs/api/dns-records) — alle Routing-Richtlinien + die Bedeutung der Felder.
- [Floating-IPs](/docs/api/floating-ips) — der Baustein für Failover innerhalb einer Region, auf dem das aufbaut.
- [Blue-Green-Deployments](/docs/guides/blue-green) — dieselbe Idee innerhalb einer Region.
