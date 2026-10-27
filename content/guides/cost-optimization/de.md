---
title: "Monatsrechnung optimieren"
description: "Die fünf wirksamsten Maßnahmen, wenn Ihre NimbusNexus-Rechnung höher ausfällt als erwartet."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Monatsrechnung optimieren

Wenn Ihre NimbusNexus-Rechnung höher ist als erwartet, stammen nach unserer Erfahrung 90 % der Mehrkosten aus denselben fünf Quellen. Sie der Reihe nach durchzugehen dauert etwa 30 Minuten und spart typischerweise 30–60 % der Rechnung.

Die Reihenfolge ist wichtig — die wirksamsten Maßnahmen zuerst.

## 1 · Vergessene gestoppte VMs {#stopped-vms}

Gestoppte VMs kosten weiterhin ~10 % ihrer Kosten im laufenden Betrieb (Sie bezahlen für die Disk + die reservierte IP). Drei Monate einer gestoppten `gp-8-32` kosten etwa so viel wie ein Monat im laufenden Betrieb.

So finden Sie sie:

```bash
curl "{{API_BASE_URL}}/v1/vms?state=stopped" \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { id, name, stopped_at, size }'
```

Entscheiden Sie für jede einzelne:

- **Vor < 1 Woche gestoppt, und Sie wissen noch, warum** → in Ruhe lassen, sie ist ein Kandidat für ein Rollback.
- **Vor > 2 Wochen gestoppt, Grund unbekannt** → einen Snapshot erstellen (damit Sie das Disk-Image haben), dann `DELETE`.
- **Vor > 1 Monat gestoppt** → löschen. Was auch immer darauf lag, ist kein Kandidat für ein Rollback mehr.

```bash
# Snapshot first
curl -X POST {{API_BASE_URL}}/v1/snapshots \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"source_vm_id\": \"$VM_ID\", \"name\": \"archive-$(date +%Y-%m-%d)\" }"

# Then delete the VM
curl -X DELETE {{API_BASE_URL}}/v1/vms/$VM_ID \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Der Snapshot ist viel günstiger als die gestoppte VM (Snapshot-Speicher kostet $0,04/GB; reservierte IPs und reservierte Disk einer gestoppten VM kosten mehr).

## 2 · Nicht angehängte Floating-IPs {#unattached-ips}

Nicht angehängte Floating-IPs kosten jeweils $2,50/Monat — genauso viel wie eine IP, die an einer gestoppten VM hängt. Die Position auf der Rechnung ist pro IP klein, aber Konten, die schon länger bestehen, sammeln sie an.

```bash
curl "{{API_BASE_URL}}/v1/floating-ips?state=detached" \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { id, ipv4, region, allocated_at }'
```

Geben Sie jede frei, für die Sie keine aktive Verwendung haben:

```bash
curl -X DELETE {{API_BASE_URL}}/v1/floating-ips/$IP_ID \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Wenn Sie dieselbe IPv4-Adresse später vielleicht zurückhaben möchten (weil sie anderswo auf einer Allow-List steht), notieren Sie sich vor dem Freigeben, welche IPs Ihnen gehörten. Wir reservieren freigegebene IPs nicht — sie gehen zurück in den regionalen Pool. Es gibt keine Möglichkeit, eine IP „einzufrieren“, ohne sie zugeteilt zu lassen.

## 3 · Überdimensionierte VMs {#over-provisioned}

Eine VM, die ständig mit 5–10 % CPU läuft, kostet 10× so viel, wie sie bräuchte. Führen Sie `node_exporter` aus (oder sehen Sie sich einfach den Graphen pro VM im Dashboard an) und suchen Sie nach VMs, deren P99-CPU über 90 Tage unter ~30 % liegt.

Für jede überdimensionierte VM hängt der richtige Schritt vom Traffic-Profil ab:

- **Gleichmäßig wenig Traffic** → verkleinern. `POST /v1/vms/$ID/resize` auf ein kleineres Tier. Dauert ~30 Sekunden. Ein Live-Resize ist innerhalb derselben Familie möglich (`gp-4-16` → `gp-2-8` funktioniert; `gp-4-16` → `co-4-8` erfordert Stoppen, Resize und Starten, weil sich die Architektur ändert).
- **Traffic in Spitzen** → ziehen Sie Compute-optimierte Größen (Familie `co-`) in Betracht; sie haben ein höheres Verhältnis von CPU zu RAM. Pro vCPU günstiger für CPU-gebundene Workloads.
- **GPU-VMs ohne Last auf der GPU** → wechseln Sie ganz aus der Familie `gx-` heraus. GPU-VMs sind 5–10× teurer; wenn Sie die GPU nicht nutzen, verbrennen Sie Geld.

## 4 · Unpassende Storage-Klasse im Objektspeicher {#storage-class}

Der Objektspeicher hat drei Klassen:

| Klasse | Speicherpreis | Abrufpreis | Geeignet für |
|---|---|---|---|
| Standard | $0,013/GB-Monat | Kostenlos | Heiße Daten (häufig gelesen) |
| Infrequent Access (IA) | $0,007/GB-Monat | $0,005/GB | Warme Daten (monatlich gelesen) |
| Cold | $0,004/GB-Monat | Höher, je nach Klasse (Expedited, Standard, Bulk) | Archiv (selten gelesen) |

Die meisten Konten nutzen standardmäßig für alles Standard und prüfen das nie wieder. Der Hebel:

```bash
# What buckets do you have, and what class?
curl {{API_BASE_URL}}/v1/buckets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { name, region, storage_class, size_gb }'
```

Sehen Sie sich für jeden Bucket den Timestamp des letzten Zugriffs auf die größten Objekte an (der „object explorer“ im Dashboard zeigt ihn). Alles, was im letzten Monat nicht gelesen wurde, sollte in IA liegen; alles, was 6 Monate lang nicht gelesen wurde, sollte wahrscheinlich in Cold liegen.

Sie müssen nicht jedes Objekt einzeln verschieben — legen Sie eine Lifecycle-Regel fest:

```bash
curl -X PUT {{API_BASE_URL}}/v1/buckets/$BUCKET/lifecycle \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {
        "id": "tier-warm",
        "filter": { "prefix": "archive/" },
        "transitions": [
          { "after_days": 30,  "storage_class": "infrequent-access" },
          { "after_days": 180, "storage_class": "cold" }
        ]
      }
    ]
  }'
```

Damit wechseln Daten mit zunehmendem Alter automatisch das Tier. Am günstigsten für Workloads nach dem Muster „Ich erzeuge diese Daten einmal und lese sie selten wieder“ (Logs, Build-Artefakte, alte Berichte).

## 5 · Snapshots, die Sie nicht mehr brauchen {#stale-snapshots}

Snapshots kosten $0,04/GB-Monat — viel günstiger als VM-Disks, aber sie sammeln sich schnell an, wenn Sie jede Nacht einen erstellen und nie löschen. Ein Snapshot mit 200 GB, den Sie ein Jahr lang aufbewahren, kostet $96.

```bash
curl "{{API_BASE_URL}}/v1/snapshots?older_than_days=180" \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { id, name, size_gb, created_at, source_vm_id }'
```

Drei Faustregeln für die Aufbewahrung von Snapshots:

- **Tägliche Snapshots** einer Produktions-VM → 14 behalten, den Rest löschen.
- **Wöchentliche Snapshots** → 8 behalten (zwei Monate).
- **Monatliche Snapshots** → 12 behalten (ein Jahr). Darüber hinaus nur die zum Jahresende behalten.

Richten Sie eine [Richtlinie für geplante Backups](/docs/api/backups) mit diesen Aufbewahrungsregeln ein, damit das nie wieder unbegrenzt wächst.

## Hinweise zum Preismodell {#reminders}

Ein paar Dinge, die neue Kunden überraschen:

- **Traffic zwischen NimbusNexus-Ressourcen innerhalb einer Region ist kostenlos.** Zwei VMs in `us-east-1`, die miteinander kommunizieren, zahlen keinen Egress. Cross-Region-Traffic zwischen NimbusNexus-Ressourcen ist ebenfalls kostenlos (ein bewusster Unterschied zu AWS, wo das die überraschendste Position auf der Rechnung ist).
- **Ausgehender Traffic ins Internet kostet nach den ersten 100 GB/Monat $0,01/GB.** Im Vergleich zu AWS (dort $0,09/GB) macht das einen Unterschied, sobald Sie nennenswerte öffentliche Inhalte ausliefern.
- **Sekundengenaue Abrechnung für VMs.** Eine VM, die 90 Sekunden läuft, kostet 1,5 Minuten. Keine Rundung auf angefangene Stunden. Kurzlebige Workloads (CI-Runner, Batch-Jobs) sind dadurch wirklich günstig — optimieren Sie nicht übermäßig darauf, „Läufe zu minimieren“, wenn die Läufe kurz sind.
- **Das Startguthaben gibt es nur einmal.** Neue Konten erhalten ein Guthaben; es wird nicht aufgefüllt. Wenn Sie viel testen, behalten Sie den Guthabenstand im Dashboard im Blick.

## Die Rechnung selbst prüfen {#invoice}

Die Abrechnungsseite im Dashboard schlüsselt die Rechnungspositionen pro Ressource und Tag auf. Der Filter „top 10 costs“ ist der richtige Einstieg, wenn Sie noch nicht wissen, was teuer ist — fast immer sind es eine oder zwei übergroße Positionen, nicht viele kleine Beträge, die sich summieren.

Wenn Sie die Rechnung als JSON möchten:

```bash
curl {{API_BASE_URL}}/v1/billing/invoices/current \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Die Antwort enthält Kostenprognosen pro Ressource für den Rest des Monats, sodass Sie bei dem gegensteuern können, was *jetzt* teuer ist, statt es erst am Monatsende zu bemerken.

## Nächste Schritte {#next-steps}

- [Virtuelle Maschinen](/docs/api/vms) — `resize` für überdimensionierte VMs.
- [Objektspeicher](/docs/api/object-storage) — Lifecycle-Regeln im Detail.
- [Snapshots](/docs/api/snapshots) und [Backups](/docs/api/backups) — die Syntax der Aufbewahrungsrichtlinien.
- [Kontingente](/docs/api/quotas) — die Tabelle der Limits pro Projekt (getrennt von der Abrechnung, aber verwandt).
