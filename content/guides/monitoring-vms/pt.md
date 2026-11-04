---
title: "Monitorar uma frota de VMs"
description: "Coleta com Prometheus e node_exporter, e os alertas que importam."
publishedAt: 2026-05-20
updatedAt: 2026-11-04
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

O que isso custa: as VMs do Prometheus + Grafana (uma vCPU e 2 GB de RAM cada, nos exemplos abaixo), mais o armazenamento das métricas. Os preços estão em [Dados de preços](/docs/api/pricing-data).

## 1 · Subir a VM do Prometheus {#prometheus}

[Início rápido](/docs/quickstart#region) mostra de onde vêm a imagem, a rede, o grupo de segurança e os valores de `spec`. `sshs` indica uma [chave SSH](/docs/api/ssh-keys) que você registrou.

```bash
export SSH_KEY_NAME="<ssh-key-name>"

curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"monitoring-prometheus\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 1,
      \"ram\": 2048,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 50,
    \"network\": [\"$NETWORK_ID\"],
    \"security_group\": [\"$SECURITY_GROUP_ID\"],
    \"sshs\": \"$SSH_KEY_NAME\"
  }"
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

Um grupo de segurança não deixa entrar nada até que você diga o contrário, então dê ao grupo da frota uma regra que abra a porta TCP 9100 para o grupo da VM do Prometheus ([Grupos de segurança](/docs/api/security-groups)).

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

Para frotas dinâmicas (autoscaling, provisionamento frequente), gere a lista em vez de escrevê-la à mão: `GET /api/v1/instance/` retorna todas as VMs com os endereços delas em `nics`, e o `file_sd_configs` do Prometheus lê os alvos de um arquivo que você reescreve. A API não tem nenhuma rota feita para a descoberta de serviços do Prometheus.

Recarregue o Prometheus:

```bash
sudo systemctl reload prometheus
```

## 4 · Subir o Grafana {#grafana}

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"monitoring-grafana\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 1,
      \"ram\": 2048,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 25,
    \"network\": [\"$NETWORK_ID\"],
    \"security_group\": [\"$SECURITY_GROUP_ID\"],
    \"sshs\": \"$SSH_KEY_NAME\"
  }"
```

```bash
# On the Grafana VM
sudo apt install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
sudo apt install -y grafana
sudo systemctl enable --now grafana-server
```

Libere a porta 3000 para o seu próprio IP no grupo de segurança da VM do Grafana e abra `http://<grafana-vm-ip>:3000` no navegador. O login padrão é `admin/admin` (troque imediatamente). Adicione o Prometheus como fonte de dados, apontando para o IP interno da VM do Prometheus, porta 9090.

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

- [Referência de máquinas virtuais](/docs/api/vms) — as VMs que esta configuração monitora.
- [Backups](/docs/api/backups) — faça backup do volume da VM do Prometheus para que um ano de histórico não desapareça com a perda de uma única VM.
