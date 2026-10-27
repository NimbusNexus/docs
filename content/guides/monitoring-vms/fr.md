---
title: "Surveiller une flotte de VM"
description: "Collecte Prometheus, métriques émises par NimbusNexus et les alertes qui comptent."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Surveiller une flotte de VM

Une petite flotte de VM (moins de ~50 VM) n’a généralement pas besoin d’un service de monitoring payant. Faites tourner Prometheus + Grafana sur l’une des VM, collectez les métriques de `node_exporter` sur chacune et émettez une métrique par dimension qui compte. Ce guide décrit la mise en place de bout en bout.

Pour des flottes plus grandes (~50+ VM, ou multi-région), un Prometheus auto-hébergé ne suffira plus et vous voudrez soit un service managé (Grafana Cloud, Datadog), soit une configuration Prometheus shardée. L’approche ci-dessous tient très bien la charge jusque-là.

## Ce que vous allez mettre en place {#overview}

- `node_exporter` sur chaque VM de la flotte (CPU, RAM, disque, réseau)
- Une VM Prometheus qui les collecte toutes
- Une VM Grafana qui interroge Prometheus
- 6 alertes qui couvrent « ce pour quoi vous voulez vraiment être alerté »

Coût total : ~$30/mois pour les VM Prometheus + Grafana (deux instances `gp-1-2` dans une même région), plus le stockage des métriques.

## 1 · Démarrer la VM Prometheus {#prometheus}

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

Connectez-vous en SSH et installez Prometheus :

```bash
sudo apt update && sudo apt install -y prometheus
```

La configuration par défaut, dans `/etc/prometheus/prometheus.yml`, collecte ses propres métriques. Nous allons ensuite la faire pointer vers notre flotte.

## 2 · Installer node_exporter sur chaque VM de la flotte {#node-exporter}

`node_exporter` est le collecteur de métriques de référence pour Linux — CPU, RAM, disque, réseau, charge moyenne. Il écoute par défaut sur le port 9100.

```bash
# On every fleet VM
sudo apt install -y prometheus-node-exporter
sudo systemctl enable --now prometheus-node-exporter
```

Pour une flotte de plus de quelques VM, utilisez une [image de VM](/docs/api/vm-images) où node_exporter est préinstallé, ou lancez un script Ansible / cloud-init ponctuel au démarrage. Se connecter à la main en SSH sur 20 VM n’est pas une bonne solution à long terme.

## 3 · Configurer Prometheus pour collecter la flotte {#scrape}

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

Pour des flottes dynamiques (autoscaling, provisionnements fréquents), utilisez la découverte de services HTTP sur l’API NimbusNexus :

```yaml
scrape_configs:
  - job_name: 'fleet'
    http_sd_configs:
      - url: '{{API_BASE_URL}}/v1/vms/prometheus-targets'
        authorization:
          type: Bearer
          credentials_file: /etc/prometheus/nimbus.key
```

Prometheus récupère ainsi la liste actuelle des VM depuis l’API toutes les 60 secondes et resynchronise sa liste de cibles. Les nouvelles VM sont surveillées automatiquement ; les VM supprimées cessent de déclencher des alertes.

Rechargez Prometheus :

```bash
sudo systemctl reload prometheus
```

## 4 · Démarrer Grafana {#grafana}

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

Ouvrez `http://<grafana-vm-ip>:3000` dans votre navigateur. Identifiants par défaut : `admin/admin` (changez-les immédiatement). Ajoutez Prometheus comme source de données, en pointant vers l’IP interne de la VM Prometheus, port 9090.

Pour les dashboards : importez le dashboard d’ID `1860` (« Node Exporter Full ») depuis la bibliothèque de Grafana. Il couvre toutes les métriques émises par `node_exporter`, par instance et agrégées.

## 5 · Les 6 alertes qui comptent {#alerts}

Dans `/etc/prometheus/alerts.yml` :

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

Pourquoi ces six :

- **VMDown** — l’alerte la moins coûteuse et la plus utile. Partition réseau, kernel panic, crash de qemu : vous voulez le savoir.
- **HighCPU** — une charge soutenue, pas des pics. Le `for:` de 10 minutes écarte « une requête a chauffé » sans rater « nous touchons le plafond ».
- **HighMemory** — la pression mémoire précède les OOM kills. Détectez-la 10 minutes à l’avance.
- **DiskAlmostFull** — disque plein = service en panne. 85 % est le bon seuil pour alerter, car le passage de 85 % à 100 % peut ne prendre que quelques minutes lors d’un pic de logs.
- **DiskFillingFast** — détecte le cas du « pic de logs » avant que le seuil ne soit atteint. Utilise `predict_linear` de Prometheus pour extrapoler.
- **NetworkErrors** — presque toujours une carte réseau défaillante ou un problème de pilote. Mieux vaut le repérer avant qu’il ne se propage.

Ce qui n’est PAS dans cette liste : la charge moyenne (bruitée, varie selon la charge de travail), les métriques par processus (utilisez un APM, pas Prometheus), les métriques métier (elles ont leur propre job).

## 6 · Brancher les notifications {#notify}

Installez Alertmanager sur la VM Prometheus :

```bash
sudo apt install -y prometheus-alertmanager
```

Configuration dans `/etc/prometheus/alertmanager.yml` :

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

L’URL d’incoming webhook Slack provient de votre espace de travail Slack. Pour les routes d’astreinte (PagerDuty, OpsGenie), Alertmanager propose des blocs de configuration dédiés pour chacun.

## Ce que ce n’est pas {#not}

- **Pas du monitoring de performance applicative.** Prometheus convient très bien aux métriques d’infrastructure (CPU, RAM, disque) ; il manque de finesse pour suivre la latence au niveau applicatif. Pour cela, utilisez OpenTelemetry + un backend (Honeycomb, Jaeger, Tempo).
- **Pas de l’agrégation de logs.** Les logs demandent une autre stack (Loki, Elastic, etc.).
- **Pas un service de métriques.** C’est une configuration auto-hébergée ; elle a les inconvénients de l’auto-hébergement (vous maintenez la VM Prometheus, vous la faites évoluer à la main). Quand elle ne suffira plus, passez à autre chose.

## Étapes suivantes {#next-steps}

- [Référence des machines virtuelles](/docs/api/vms) — la ressource qui émet toutes ces métriques.
- [Snapshots](/docs/api/snapshots) — sauvegarder le volume de données de la VM Prometheus pour qu’un an d’historique ne disparaisse pas avec la perte d’une seule VM.
- [Webhooks de la plateforme](/docs/webhooks) — les événements `vm.state_changed` sont plus bruyants que ce monitoring, mais utiles pour attribuer un « VM redémarrée par le support ».
