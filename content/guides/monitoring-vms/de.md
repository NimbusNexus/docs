---
title: "VM-Flotte überwachen"
description: "Prometheus-Scrapes, von NimbusNexus gelieferte Metriken und die Alerts, auf die es ankommt."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# VM-Flotte überwachen

Eine kleine VM-Flotte (unter ~50 VMs) braucht meist keinen kostenpflichtigen Monitoring-Dienst. Betreiben Sie Prometheus + Grafana auf einer der VMs, scrapen Sie `node_exporter` auf jeder VM und erfassen Sie eine Metrik pro relevanter Dimension. Diese Anleitung führt Sie durch das gesamte Setup.

Bei größeren Flotten (~50+ VMs oder mehrere Regionen) reicht ein selbst gehostetes Prometheus nicht mehr aus, und Sie brauchen entweder einen verwalteten Dienst (Grafana Cloud, Datadog) oder ein geshardetes Prometheus-Setup. Der folgende Ansatz skaliert bis zu diesem Punkt problemlos.

## Was Sie einrichten {#overview}

- `node_exporter` auf jeder VM der Flotte (CPU, RAM, Disk, Netzwerk)
- Eine Prometheus-VM, die alle scrapt
- Eine Grafana-VM, die Prometheus abfragt
- 6 Alerts für „die Dinge, für die Sie wirklich alarmiert werden wollen“

Gesamtkosten: ~$30/Monat für die VMs für Prometheus + Grafana (zwei Instanzen `gp-1-2` in einer Region) plus der Speicher für die Metriken.

## 1 · Prometheus-VM starten {#prometheus}

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "monitoring-prometheus",
    "size": "gp-1-2",
    "region": "us-east-1",
    "image": "ubuntu-24.04"
  }'
```

Melden Sie sich per SSH an und installieren Sie Prometheus:

```bash
sudo apt update && sudo apt install -y prometheus
```

Die Standardkonfiguration unter `/etc/prometheus/prometheus.yml` scrapt Prometheus selbst. Als Nächstes richten wir sie auf unsere Flotte aus.

## 2 · node_exporter auf jeder VM der Flotte installieren {#node-exporter}

`node_exporter` ist der maßgebliche Metrik-Collector für Linux — CPU, RAM, Disk, Netzwerk, Load Average. Er lauscht standardmäßig auf Port 9100.

```bash
# On every fleet VM
sudo apt install -y prometheus-node-exporter
sudo systemctl enable --now prometheus-node-exporter
```

Bei einer Flotte von mehr als einer Handvoll VMs verwenden Sie ein [VM-Image](/docs/api/vm-images) mit vorinstalliertem node_exporter oder führen beim Boot ein einmaliges Ansible-/cloud-init-Skript aus. 20 VMs einzeln per SSH einzurichten ist auf Dauer die falsche Antwort.

## 3 · Prometheus zum Scrapen der Flotte konfigurieren {#scrape}

```yaml
# /etc/prometheus/prometheus.yml
global:
  scrape_interval: 30s
  evaluation_interval: 30s

scrape_configs:
  - job_name: 'fleet'
    static_configs:
      - targets:
          - '10.0.1.10:9100'
          - '10.0.1.11:9100'
          - '10.0.1.12:9100'
          # … one entry per VM
```

Für dynamische Flotten (Autoscaling, häufige Bereitstellung) verwenden Sie HTTP-Service-Discovery gegen die NimbusNexus-API:

```yaml
scrape_configs:
  - job_name: 'fleet'
    http_sd_configs:
      - url: '{{API_BASE_URL}}/v1/vms/prometheus-targets'
        authorization:
          type: Bearer
          credentials_file: /etc/prometheus/nimbus.key
```

Damit lädt Prometheus alle 60 Sekunden die aktuelle Liste der VMs von der API und synchronisiert seine Target-Liste neu. Neue VMs werden automatisch überwacht; gelöschte lösen keine Alerts mehr aus.

Laden Sie Prometheus neu:

```bash
sudo systemctl reload prometheus
```

## 4 · Grafana starten {#grafana}

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "monitoring-grafana",
    "size": "gp-1-2",
    "region": "us-east-1",
    "image": "ubuntu-24.04"
  }'
```

```bash
# On the Grafana VM
sudo apt install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
sudo apt install -y grafana
sudo systemctl enable --now grafana-server
```

Öffnen Sie `http://<grafana-vm-ip>:3000` im Browser. Standard-Login `admin/admin` (sofort ändern). Fügen Sie Prometheus als Datenquelle hinzu, die auf die interne IP der Prometheus-VM zeigt, Port 9090.

Für Dashboards: Importieren Sie das Dashboard mit der ID `1860` („Node Exporter Full“) aus der Bibliothek von Grafana. Es deckt jede Metrik ab, die `node_exporter` liefert, aufgeschlüsselt pro Instanz und aggregiert.

## 5 · Die 6 Alerts, auf die es ankommt {#alerts}

In `/etc/prometheus/alerts.yml`:

```yaml
groups:
  - name: fleet
    rules:
      # 1. VM unreachable
      - alert: VMDown
        expr: up{job="fleet"} == 0
        for: 2m
        labels: { severity: page }
        annotations:
          summary: "{{$labels.instance}} unreachable for 2 minutes"

      # 2. High CPU sustained
      - alert: HighCPU
        expr: 100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 90
        for: 10m
        labels: { severity: warn }
        annotations:
          summary: "{{$labels.instance}} CPU > 90% for 10 minutes"

      # 3. Memory pressure
      - alert: HighMemory
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 90
        for: 5m
        labels: { severity: warn }
        annotations:
          summary: "{{$labels.instance}} memory > 90%"

      # 4. Disk filling up
      - alert: DiskAlmostFull
        expr: (1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})) * 100 > 85
        for: 5m
        labels: { severity: page }
        annotations:
          summary: "{{$labels.instance}} root disk > 85% — page now or it fills"

      # 5. Disk-fill rate (catches "10 GB/hour log spike")
      - alert: DiskFillingFast
        expr: predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[1h], 4 * 3600) < 0
        for: 10m
        labels: { severity: warn }
        annotations:
          summary: "{{$labels.instance}} disk will be full in <4h at current rate"

      # 6. Network errors
      - alert: NetworkErrors
        expr: rate(node_network_receive_errs_total[5m]) + rate(node_network_transmit_errs_total[5m]) > 10
        for: 5m
        labels: { severity: warn }
        annotations:
          summary: "{{$labels.instance}} network error rate > 10/s — bad NIC or driver"
```

Warum genau diese sechs:

- **VMDown** — der günstigste und nützlichste Alert. Netzwerkpartition, Kernel-Panic, qemu-Absturz; davon wollen Sie wissen.
- **HighCPU** — anhaltend, nicht spitzenartig. Das `for:` von 10 Minuten filtert „eine Abfrage lief heiß“ heraus, ohne „wir sind am Limit“ zu verpassen.
- **HighMemory** — Speicherdruck geht OOM-Kills voraus. Erkennen Sie ihn 10 Minuten vorher.
- **DiskAlmostFull** — Disk voll = Dienst ausgefallen. 85 % ist der richtige Schwellenwert für eine Alarmierung, weil das Wachstum von 85 % auf 100 % bei einer Log-Spitze nur Minuten dauern kann.
- **DiskFillingFast** — erkennt den Fall „Log-Spitze“, bevor der Schwellenwert greift. Extrapoliert mit `predict_linear` von Prometheus.
- **NetworkErrors** — fast immer eine defekte NIC oder ein Treiberproblem. Sollte auffallen, bevor es Folgefehler auslöst.

Was NICHT in dieser Liste steht: Load Average (verrauscht, je nach Workload unterschiedlich), Metriken einzelner Prozesse (dafür APM statt Prometheus verwenden), Business-Metriken (die gehören in einen eigenen Job).

## 6 · Benachrichtigungen anbinden {#notify}

Installieren Sie Alertmanager auf der Prometheus-VM:

```bash
sudo apt install -y prometheus-alertmanager
```

Konfiguration in `/etc/prometheus/alertmanager.yml`:

```yaml
route:
  receiver: 'default'
  group_by: ['alertname', 'instance']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

receivers:
  - name: 'default'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/T.../B.../...'
        channel: '#alerts'
```

Die Incoming-Webhook-URL stammt aus Ihrem Slack-Workspace. Für Alarmierungswege (PagerDuty, OpsGenie) hat Alertmanager jeweils eigene, vollwertige Konfigurationsblöcke.

## Was das nicht ist {#not}

- **Kein Application Performance Monitoring.** Prometheus eignet sich sehr gut für Infrastrukturmetriken (CPU, RAM, Disk); für die Latenzverfolgung auf App-Ebene ist es zu grob. Verwenden Sie dafür OpenTelemetry + ein Backend (Honeycomb, Jaeger, Tempo).
- **Keine Log-Aggregation.** Logs brauchen einen anderen Stack (Loki, Elastic usw.).
- **Kein Metrikdienst.** Das ist ein selbst gehostetes Setup mit den Nachteilen des Selbsthostens (Sie warten die Prometheus-VM, Sie skalieren sie manuell). Steigen Sie um, wenn es nicht mehr reicht.

## Nächste Schritte {#next-steps}

- [Referenz für virtuelle Maschinen](/docs/api/vms) — die Ressource, die all diese Metriken liefert.
- [Snapshots](/docs/api/snapshots) — sichern Sie das Daten-Volume der Prometheus-VM, damit ein Jahr Historie nicht mit dem Verlust einer einzelnen VM verschwindet.
- [Plattform-Webhooks](/docs/webhooks) — Events vom Typ `vm.state_changed` sind verrauschter als dieses Monitoring, aber nützlich für die Zuordnung „VM wurde vom Support neu gestartet“.
