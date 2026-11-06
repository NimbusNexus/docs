---
title: "Monatsrechnung optimieren"
description: "Wohin die Kosten Ihrer Infrastruktur gehen und wie Sie die Ressourcen finden, für die Sie nicht mehr zahlen müssen."
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: guide
---

# Monatsrechnung optimieren

Was Sie bei NimbusNexus bezahlen, ist vor allem das, was Sie zugeteilt haben, ob Sie es nutzen oder nicht: VMs, Volumes, Floating-IPs, öffentliche Ports und ihre Bandbreite sowie Custom-Images. Wenn eine Rechnung höher ausfällt als erwartet, suchen Sie also zuerst nach dem, was noch zugeteilt ist und nicht mehr gebraucht wird. Diese Anleitung geht diese Stellen durch, mit den Aufrufen, die sie jeweils finden.

Die Preise finden Sie unter [Preisdaten](/docs/api/pricing-data). Abgerechnet wird pro Workspace, während ein API-Key in einem Projekt gilt; wiederholen Sie diese Aufrufe also für jedes Projekt im Workspace.

## Voraussetzungen {#prereqs}

- `curl` und `jq`, wobei `$NIMBUS_KEY` auf einen [API-Key](/docs/authentication) gesetzt ist, der diese Aufrufe machen darf.

```bash
export NIMBUS_KEY="<your-api-key>"
```

Die Aufrufe unten, die etwas löschen oder ändern, verwenden die IDs, die die Listen ausgeben, als `$VM_ID`, `$FLOATING_IP_ID`, `$VOLUME_ID` und `$PORT_ID`.

## 1 · Vergessene gestoppte VMs {#stopped-vms}

Das Stoppen einer VM stoppt nicht ihre Abrechnung: Eine VM wird vom Erstellen bis zum Löschen abgerechnet ([Virtuelle Maschinen](/docs/api/vms#lifecycle)). So finden Sie die gestoppten:

```bash
curl -s {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.status == "SHUTOFF") | { id, name, vcores, memory }'
```

Eine gestoppte VM ist für kurze Zeit ein brauchbarer Kandidat für ein Rollback, wie bei einem [Blue-Green-Deployment](/docs/guides/blue-green#stop-blue). Sobald sie das nicht mehr ist, löschen Sie sie:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/action \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"servers\": [\"$VM_ID\"], \"cmd\": \"delete\" }"
```

Das Löschen einer VM löscht das Boot-Volume, das aus ihrem Image erstellt wurde, und das lässt sich nicht rückgängig machen; kopieren Sie also zuerst alles herunter, was Sie noch brauchen. Volumes, die Sie später angehängt haben, bleiben, und Schritt 3 findet sie.

## 2 · Floating-IPs, hinter denen nichts steht {#unattached-ips}

Eine Floating-IP wird vom Moment ihrer Erstellung bis zu ihrer Löschung abgerechnet, ob angehängt oder nicht ([Floating-IPs](/docs/api/floating-ips#billing)). So finden Sie die nicht angehängten:

```bash
curl -s {{API_BASE_URL}}/api/v1/floating_ip/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.port_id == null) | { id, ip_address, description }'
```

Löschen Sie die, die Sie nicht brauchen, und führen Sie dabei ihre IDs in `ids` auf:

```bash
curl -X DELETE {{API_BASE_URL}}/api/v1/floating_ip/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"ids\": [\"$FLOATING_IP_ID\"] }"
```

Wenn eine Adresse anderswo auf einer Allow-List steht, ändern Sie das zuerst: Eine gelöschte Adresse bekommen Sie möglicherweise nicht zurück.

## 3 · Volumes, die keine VM nutzt {#volumes}

Ein Volume wird genauso abgerechnet, ob angehängt oder nicht ([Blockspeicher](/docs/api/block-storage#lifecycle)). Volumes, die ihre VM überdauern, vergisst man leicht. So finden Sie sie:

```bash
curl -s {{API_BASE_URL}}/api/v1/storage/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.status == "available") | { id, name, size, type }'
```

Ein gelöschtes Volume kann nicht wiederhergestellt werden; [sichern Sie es](/docs/api/backups#create) deshalb zuerst, falls Sie die Daten vielleicht noch brauchen. Löschen Sie es dann:

```bash
curl -X DELETE {{API_BASE_URL}}/api/v1/storage/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"ids\": [\"$VOLUME_ID\"] }"
```

## 4 · Überdimensionierte VMs {#over-provisioned}

Der Preis einer VM hängt von `architecture`, `vm_class`, `cpu` und `ram` ab. Wenn die CPU- und RAM-Auslastung einer VM ständig niedrig bleibt, kann sie mit einer kleineren Ausstattung laufen. Messen Sie, bevor Sie entscheiden: [VM-Flotte überwachen](/docs/guides/monitoring-vms) richtet die Metriken ein.

Ändern Sie die Größe mit einer neuen `spec`; [Schnellstart](/docs/quickstart#region) zeigt, woher `$ARCHITECTURE` und `$VM_CLASS` stammen. Die VM startet mit der neuen Ausstattung neu und wartet in `VERIFY_RESIZE`:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/$VM_ID/resize \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 2,
      \"ram\": 4096
    }
  }"
```

Prüfen Sie die VM unter echter Last und behalten Sie dann die neue Ausstattung, oder kehren Sie mit `revert_resize` zur alten zurück:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/$VM_ID/confirm_resize \
  -H "X-API-Key: $NIMBUS_KEY"
```

Die Details finden Sie unter [VM-Größen](/docs/api/vm-sizes#resizing).

## 5 · Öffentliche Ports und Bandbreite {#bandwidth}

Ein Port im externen Netzwerk wird abgerechnet, bis Sie ihn löschen, und seine Bandbreite wird mit ihm abgerechnet, ebenso die Bandbreite am externen Gateway eines Routers ([Netzwerkports](/docs/api/network-ports), [Router](/docs/api/routers)). Eine VM, die nicht aus dem Internet erreichbar sein muss, kann stattdessen in einem privaten Netzwerk liegen ([Projektnetzwerk einrichten](/docs/guides/networking-setup)).

Listen Sie die Ports im externen Netzwerk auf; `GET /api/v1/floating_ip/artifacts` listet die externen Netzwerke auf:

```bash
curl -s "{{API_BASE_URL}}/api/v1/portal/port/?network_id=$EXTERNAL_NETWORK_ID" \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | { id, name, device_id, status }'
```

Ein Port mit leerer `device_id` ist an nichts angehängt. Löschen Sie ihn mit `DELETE /api/v1/portal/port/{port_id}`.

Wenn Sie den Port brauchen, aber nicht seine gesamte Bandbreite, senken Sie sie mit `POST /api/v1/bandwidth/resize`. Dieser Aufruf ändert das Limit an einem Port, einer Floating-IP oder einem Router-Gateway und damit auch die Abrechnung. `bandwidth_mbps` muss ein Vielfaches von 10 sein:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/bandwidth/resize \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"resource_type\": \"port\",
    \"resource_id\": \"$PORT_ID\",
    \"bandwidth_mbps\": 100,
    \"bandwidth_subscription\": \"Monthly\"
  }"
```

## 6 · Custom-Images {#images}

Ein Custom-Image wird pro GB abgerechnet, auf ganze GB aufgerundet, als eigenes Produkt ([VM-Images](/docs/api/vm-images)). Listen Sie Ihre privaten Images auf und löschen Sie dann diejenigen, von denen nichts mehr bootet, mit `DELETE /api/v1/image/`:

```bash
curl -s "{{API_BASE_URL}}/api/v1/image/?visibility=private" \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | { id, name, size, created_at }'
```

## Die Rechnung selbst prüfen {#invoice}

`GET /api/v1/billing/public/balances` zeigt die ausstehenden Kosten, das Aktionsguthaben und das Prepaid-Guthaben Ihres Workspaces, und `GET /api/v1/billing/public/accrued_charges` die Summe der bisher angefallenen Kosten, die noch nicht beglichen sind. Diese Aufrufe brauchen eine angemeldete Sitzung, keinen API-Key, und die Rechnungen selbst sind über die API nicht verfügbar ([Abrechnung](/docs/api/invoices)).

## Nächste Schritte {#next-steps}

- [Preisdaten](/docs/api/pricing-data) — was jede dieser Ressourcen kostet.
- [Abrechnung](/docs/api/invoices) — Ihre Salden und die noch nicht beglichenen Kosten.
- [VM-Größen](/docs/api/vm-sizes) — Ausstattungen und das Ändern der Größe im Detail.
- [Backups](/docs/api/backups) — ein Volume kopieren, bevor Sie es löschen, und wie lange Zeitpläne Kopien aufbewahren.
- [Kontingente](/docs/api/quotas) — die Ressourcenlimits pro Projekt, die von der Abrechnung getrennt sind.
