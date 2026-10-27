---
title: "Monitorar uma frota de VMs"
description: "Coleta com Prometheus, métricas emitidas pela NimbusNexus e os alertas que importam."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Monitorar uma frota de VMs

Uma frota pequena de VMs (menos de ~50 VMs) normalmente não precisa de um serviço de monitoramento pago. Rode o Prometheus + Grafana em uma das VMs, colete as métricas do `node_exporter` em cada uma e emita uma métrica para cada dimensão que importa. Este guia percorre a configuração de ponta a ponta.

Para frotas maiores (~50+ VMs, ou várias regiões), o Prometheus auto-hospedado deixa de dar conta e você vai querer um serviço gerenciado (Grafana Cloud, Datadog) ou uma configuração de Prometheus com sharding. A abordagem abaixo escala bem até esse ponto.

## O que você vai configurar {#overview}

- O `node_exporter` em cada VM da frota (CPU, RAM, disco, rede)
- Uma VM com Prometheus coletando as métricas de todas elas
- Uma VM com Grafana consultando o Prometheus
- 6 alertas que cobrem "as coisas pelas quais você realmente quer ser acionado"

Custo total: ~$30/mês pelas VMs do Prometheus + Grafana (duas instâncias `gp-1-2` em uma região), mais o armazenamento das métricas.

## 1 · Subir a VM do Prometheus {#prometheus}

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

Conecte-se por SSH e instale o Prometheus:

```bash
sudo apt update && sudo apt install -y prometheus
```

A configuração padrão em `/etc/prometheus/prometheus.yml` coleta as métricas do próprio Prometheus. Em seguida, vamos apontá-lo para a nossa frota.

## 2 · Instalar o node_exporter em cada VM da frota {#node-exporter}

O `node_exporter` é o coletor de métricas de referência para Linux — CPU, RAM, disco, rede, load average. Por padrão, ele escuta na porta 9100.

```bash
# On every fleet VM
sudo apt install -y prometheus-node-exporter
sudo systemctl enable --now prometheus-node-exporter
```

Para uma frota com mais do que algumas poucas VMs, use uma [imagem de VM](/docs/api/vm-images) com o node_exporter já incluído, ou rode um script único de Ansible / cloud-init no boot. Entrar por SSH manualmente em 20 VMs não é a resposta certa a longo prazo.

## 3 · Configurar o Prometheus para coletar as métricas da frota {#scrape}

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

Para frotas dinâmicas (autoscaling, provisionamento frequente), use a descoberta de serviços por HTTP com a API da NimbusNexus:

```yaml
scrape_configs:
  - job_name: 'fleet'
    http_sd_configs:
      - url: '{{API_BASE_URL}}/v1/vms/prometheus-targets'
        authorization:
          type: Bearer
          credentials_file: /etc/prometheus/nimbus.key
```

Isso busca a lista atual de VMs na API a cada 60 segundos e ressincroniza a lista de alvos do Prometheus. VMs novas passam a ser monitoradas automaticamente; as excluídas deixam de gerar alertas.

Recarregue o Prometheus:

```bash
sudo systemctl reload prometheus
```

## 4 · Subir o Grafana {#grafana}

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

Abra `http://<grafana-vm-ip>:3000` no navegador. O login padrão é `admin/admin` (troque imediatamente). Adicione o Prometheus como fonte de dados, apontando para o IP interno da VM do Prometheus, porta 9090.

Para os painéis: importe o painel de id `1860` ("Node Exporter Full") da biblioteca do Grafana. Ele cobre todas as métricas que o `node_exporter` emite, separadas por instância e agregadas.

## 5 · Os 6 alertas que importam {#alerts}

Em `/etc/prometheus/alerts.yml`:

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

Por que estes seis:

- **VMDown** — o alerta mais barato e mais útil. Partição de rede, kernel panic, falha do qemu; você quer saber.
- **HighCPU** — sustentado, não picos. O `for:` de 10 minutos filtra "uma consulta pesou" sem deixar passar "chegamos ao limite".
- **HighMemory** — a pressão de memória vem antes dos OOM kills. Pegue-a com 10 minutos de antecedência.
- **DiskAlmostFull** — disco cheio = serviço fora do ar. 85% é o limiar certo para acionar alguém porque, durante um pico de logs, ir de 85% a 100% pode levar só minutos.
- **DiskFillingFast** — pega o caso do "pico de logs" antes de o limiar disparar. Usa o `predict_linear` do Prometheus para extrapolar.
- **NetworkErrors** — quase sempre é uma NIC com defeito ou um problema de driver. Vale perceber antes que o problema se propague.

O que NÃO está nesta lista: load average (ruidoso, varia conforme a carga de trabalho), métricas de processos individuais (use APM, não o Prometheus), métricas de negócio (essas ficam em um job próprio).

## 6 · Conectar as notificações {#notify}

Instale o Alertmanager na VM do Prometheus:

```bash
sudo apt install -y prometheus-alertmanager
```

Configuração em `/etc/prometheus/alertmanager.yml`:

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

A URL do incoming webhook do Slack vem do seu workspace do Slack. Para rotas de acionamento (PagerDuty, OpsGenie), o Alertmanager tem blocos de configuração nativos para cada um.

## O que isto não é {#not}

- **Não é monitoramento de desempenho de aplicações.** O Prometheus é ótimo para métricas de infraestrutura (CPU, RAM, disco); para acompanhar a latência no nível da aplicação, ele é grosseiro. Para isso, use OpenTelemetry + um backend (Honeycomb, Jaeger, Tempo).
- **Não é agregação de logs.** Logs precisam de outra stack (Loki, Elastic etc.).
- **Não é um serviço de métricas.** É uma configuração auto-hospedada; ela tem as desvantagens de hospedar por conta própria (você mantém a VM do Prometheus e a escala manualmente). Quando ela ficar pequena para você, parta para outra.

## Próximos passos {#next-steps}

- [Referência de máquinas virtuais](/docs/api/vms) — o recurso que emite todas essas métricas.
- [Snapshots](/docs/api/snapshots) — faça backup do volume de dados da VM do Prometheus para que um ano de histórico não desapareça com a perda de uma única VM.
- [Webhooks da plataforma](/docs/webhooks) — os eventos `vm.state_changed` são mais ruidosos que este monitoramento, mas úteis para atribuir casos como "a VM foi reiniciada pelo suporte".
