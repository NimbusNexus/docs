---
title: "Моніторинг парку VM"
description: "Збір метрик у Prometheus, метрики від NimbusNexus і алерти, які мають значення."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Моніторинг парку VM

Невеликому парку VM (до ~50 VM) зазвичай не потрібен платний сервіс моніторингу. Запустіть Prometheus + Grafana на одній із VM, збирайте метрики з `node_exporter` на кожній і віддавайте метрику для кожного важливого виміру. Ця інструкція проводить через усе налаштування від початку до кінця.

Для більших парків (~50+ VM або кілька регіонів) самостійно розгорнутого Prometheus стане замало, і вам знадобиться або керований сервіс (Grafana Cloud, Datadog), або шардована конфігурація Prometheus. Описаний нижче підхід добре масштабується до цієї межі.

## Що ви налаштуєте {#overview}

- `node_exporter` на кожній VM парку (CPU, RAM, диск, мережа)
- VM із Prometheus, що збирає метрики з усіх них
- VM із Grafana, що робить запити до Prometheus
- 6 алертів, що покривають «те, про що вам справді треба отримувати термінові сповіщення»

Загальна вартість: ~$30/міс за VM із Prometheus і Grafana (два інстанси `gp-1-2` в одному регіоні) плюс сховище для метрик.

## 1 · Запустіть VM для Prometheus {#prometheus}

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

Підключіться через SSH і встановіть Prometheus:

```bash
sudo apt update && sudo apt install -y prometheus
```

Стандартна конфігурація в `/etc/prometheus/prometheus.yml` збирає метрики самого Prometheus. Далі ми націлимо його на наш парк.

## 2 · Встановіть node_exporter на кожну VM парку {#node-exporter}

`node_exporter` — стандартний збирач метрик для Linux: CPU, RAM, диск, мережа, load average. За замовчуванням він слухає порт 9100.

```bash
# On every fleet VM
sudo apt install -y prometheus-node-exporter
sudo systemctl enable --now prometheus-node-exporter
```

Якщо у парку більше кількох VM, використовуйте [образ VM](/docs/api/vm-images) з уже вбудованим node_exporter або запускайте одноразовий скрипт Ansible / cloud-init під час завантаження. Вручну заходити через SSH на 20 VM — не рішення в довгостроковій перспективі.

## 3 · Налаштуйте збір метрик із парку в Prometheus {#scrape}

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

Для динамічних парків (автомасштабування, часте розгортання) використовуйте HTTP-виявлення сервісів через API NimbusNexus:

```yaml
scrape_configs:
  - job_name: 'fleet'
    http_sd_configs:
      - url: '{{API_BASE_URL}}/v1/vms/prometheus-targets'
        authorization:
          type: Bearer
          credentials_file: /etc/prometheus/nimbus.key
```

Так Prometheus кожні 60 секунд отримує з API поточний список VM і заново синхронізує свій список цілей. Нові VM потрапляють під моніторинг автоматично; для видалених алерти припиняються.

Перезавантажте Prometheus:

```bash
sudo systemctl reload prometheus
```

## 4 · Запустіть Grafana {#grafana}

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

Відкрийте в браузері `http://<grafana-vm-ip>:3000`. Стандартний логін — `admin/admin` (одразу змініть). Додайте Prometheus як джерело даних із внутрішнім IP VM із Prometheus і портом 9090.

Дашборди: імпортуйте дашборд з ID `1860` («Node Exporter Full») з бібліотеки Grafana. Він охоплює всі метрики, які віддає `node_exporter`, — окремо для кожного інстансу й сукупно.

## 5 · 6 алертів, які мають значення {#alerts}

У `/etc/prometheus/alerts.yml`:

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

Чому саме ці шість:

- **VMDown** — найдешевший і найкорисніший алерт. Розділення мережі, kernel panic, збій qemu — про таке ви хочете знати.
- **HighCPU** — тривале навантаження, а не сплески. 10-хвилинний `for:` відсіює «один запит виконувався важко», не пропускаючи «ми вперлися в стелю».
- **HighMemory** — нестача памʼяті передує OOM kill. Помітьте її за 10 хвилин наперед.
- **DiskAlmostFull** — повний диск = сервіс не працює. 85 % — правильний поріг для термінового сповіщення, бо під час сплеску логів від 85 % до 100 % може минути кілька хвилин.
- **DiskFillingFast** — ловить випадок «сплеск логів» ще до спрацювання порогу. Для екстраполяції використовує `predict_linear` з Prometheus.
- **NetworkErrors** — майже завжди несправна мережева карта або проблема з драйвером. Варто помітити, перш ніж це спричинить каскад збоїв.

Чого в цьому списку НЕМАЄ: load average (шумний, залежить від навантаження), метрик окремих процесів (для них — APM, а не Prometheus), бізнес-метрик (для них — окремий job).

## 6 · Підключіть сповіщення {#notify}

Встановіть Alertmanager на VM із Prometheus:

```bash
sudo apt install -y prometheus-alertmanager
```

Конфігурація в `/etc/prometheus/alertmanager.yml`:

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

URL вхідного вебхука Slack береться з вашого робочого простору Slack. Для маршрутів термінових сповіщень (PagerDuty, OpsGenie) в Alertmanager є повноцінні блоки конфігурації для кожного з них.

## Чим це не є {#not}

- **Не моніторинг продуктивності застосунків.** Prometheus чудово підходить для метрик інфраструктури (CPU, RAM, диск), але надто грубий для відстеження затримок на рівні застосунку. Для цього використовуйте OpenTelemetry + бекенд (Honeycomb, Jaeger, Tempo).
- **Не агрегація логів.** Для логів потрібен інший стек (Loki, Elastic тощо).
- **Не сервіс метрик.** Це самостійно розгорнута конфігурація з усіма недоліками самостійного хостингу (ви обслуговуєте VM із Prometheus і масштабуєте її вручну). Переходьте на інше рішення, коли переростете її.

## Наступні кроки {#next-steps}

- [Довідник віртуальних машин](/docs/api/vms) — ресурс, що віддає всі ці метрики.
- [Снапшоти](/docs/api/snapshots) — робіть бекап тому даних VM із Prometheus, щоб історія за рік не зникла через втрату однієї VM.
- [Вебхуки платформи](/docs/webhooks) — події `vm.state_changed` шумніші за цей моніторинг, але корисні, щоб зʼясувати, що «VM перезавантажила підтримка».
