---
title: Monitor a VM fleet
description: Prometheus scrapes, NimbusNexus-emitted metrics, and the alerts that matter.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Monitor a VM fleet

A small VM fleet (under ~50 VMs) usually doesn't need a paid monitoring service. Run Prometheus + Grafana on one of the VMs, scrape `node_exporter` on each, and emit a metric per dimension that matters. This guide walks the setup end-to-end.

For larger fleets (~50+ VMs, or multi-region), you'll outgrow self-hosted Prometheus and want either a managed service (Grafana Cloud, Datadog) or a sharded Prometheus setup. The approach below scales fine up to that point.

## What you'll set up {#overview}

- `node_exporter` on every fleet VM (CPU, RAM, disk, network)
- A Prometheus VM scraping all of them
- A Grafana VM querying Prometheus
- 6 alerts that cover "the things you actually want to be paged for"

Total cost: ~$30/month for the Prometheus + Grafana VMs (two `gp-1-2` instances in one region) plus the storage for metrics.

## 1 · Bring up the Prometheus VM {#prometheus}

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

SSH in and install Prometheus:

```bash
sudo apt update && sudo apt install -y prometheus
```

The default config at `/etc/prometheus/prometheus.yml` scrapes itself. We'll point it at our fleet next.

## 2 · Install node_exporter on every fleet VM {#node-exporter}

`node_exporter` is the canonical metrics collector for Linux — CPU, RAM, disk, network, load average. It listens on port 9100 by default.

```bash
# On every fleet VM
sudo apt install -y prometheus-node-exporter
sudo systemctl enable --now prometheus-node-exporter
```

For a fleet of more than a handful of VMs, use a [VM image](/docs/api/vm-images) with node_exporter pre-baked, or run a one-shot Ansible / cloud-init script at boot. Manually SSH-ing to 20 VMs is the wrong long-term answer.

## 3 · Configure Prometheus to scrape the fleet {#scrape}

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

For dynamic fleets (autoscaling, frequent provisioning), use HTTP service discovery against the NimbusNexus API:

```yaml
scrape_configs:
  - job_name: 'fleet'
    http_sd_configs:
      - url: '{{API_BASE_URL}}/v1/vms/prometheus-targets'
        authorization:
          type: Bearer
          credentials_file: /etc/prometheus/nimbus.key
```

This pulls the current list of VMs from the API every 60 seconds and re-syncs Prometheus's target list. New VMs get monitored automatically; deleted ones stop alerting.

Reload Prometheus:

```bash
sudo systemctl reload prometheus
```

## 4 · Bring up Grafana {#grafana}

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

Browse to `http://<grafana-vm-ip>:3000`. Default login `admin/admin` (change immediately). Add Prometheus as a datasource pointing at the Prometheus VM's internal IP, port 9090.

For dashboards: import dashboard ID `1860` ("Node Exporter Full") from Grafana's library. It covers every metric `node_exporter` emits, broken out per-instance and aggregated.

## 5 · The 6 alerts that matter {#alerts}

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

Why these six:

- **VMDown** — the cheapest, most useful alert. Network partition, kernel panic, qemu crash; you want to know.
- **HighCPU** — sustained, not spiky. The 10-minute `for:` filters out "one query ran hot" without missing "we're at the wall."
- **HighMemory** — memory pressure precedes OOM kills. Catch it 10 minutes ahead.
- **DiskAlmostFull** — disk full = service down. 85% is the right threshold for paging because growth between 85 % and 100 % can be minutes during a log spike.
- **DiskFillingFast** — catches the "log spike" case before the threshold trips. Uses Prometheus's `predict_linear` to extrapolate.
- **NetworkErrors** — almost always a bad NIC or driver issue. Worth noticing before it cascades.

What's NOT in this list: load average (noisy, varies by workload), individual process metrics (use APM not Prometheus), business metrics (those go in their own job).

## 6 · Hook up notifications {#notify}

Install Alertmanager on the Prometheus VM:

```bash
sudo apt install -y prometheus-alertmanager
```

Config at `/etc/prometheus/alertmanager.yml`:

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

Slack incoming-webhook URL goes from your Slack workspace. For paging routes (PagerDuty, OpsGenie), Alertmanager has first-class config blocks for each.

## What this isn't {#not}

- **Not application performance monitoring.** Prometheus is great for infrastructure metrics (CPU, RAM, disk); it's coarse for app-level latency tracking. Use OpenTelemetry + a backend (Honeycomb, Jaeger, Tempo) for that.
- **Not log aggregation.** Logs need a different stack (Loki, Elastic, etc.).
- **Not a metrics service.** This is a self-hosted setup; it has the drawbacks of self-hosting (you maintain the Prometheus VM, you scale it manually). Outgrow it when you outgrow it.

## Next steps {#next-steps}

- [Virtual machines reference](/docs/api/vms) — the resource that emits all these metrics.
- [Snapshots](/docs/api/snapshots) — back up the Prometheus VM's data volume so a year of history doesn't vanish in a single VM loss.
- [Webhooks](/docs/webhooks) — `vm.state_changed` events are noisier than this monitoring but useful for "VM was rebooted by support" attribution.
