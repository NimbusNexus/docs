---
title: "Monitoriza una flota de VMs"
description: "Scraping con Prometheus y node_exporter, y las alertas que importan."
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: guide
---

# Monitoriza una flota de VMs

Una flota pequeña de VMs (menos de ~50 VMs) no suele necesitar un servicio de monitorización de pago. Ejecuta Prometheus + Grafana en una de las VMs, haz scraping de `node_exporter` en cada una y emite una métrica por cada dimensión que importe. Esta guía recorre la configuración de principio a fin.

Con flotas más grandes (~50+ VMs, o multirregión), el Prometheus autoalojado se te quedará pequeño y querrás un servicio gestionado (Grafana Cloud, Datadog) o una configuración de Prometheus con sharding. El enfoque de abajo escala bien hasta ese punto.

## Lo que vas a configurar {#overview}

- `node_exporter` en todas las VMs de la flota (CPU, RAM, disco, red)
- Una VM de Prometheus que hace scraping de todas ellas
- Una VM de Grafana que consulta Prometheus
- 6 alertas que cubren "las cosas por las que de verdad quieres que te avisen"

Lo que cuesta: las VMs de Prometheus + Grafana (una vCPU y 2 GB de RAM cada una, en los ejemplos de abajo), más el almacenamiento de las métricas. En [Datos de precios](/docs/api/pricing-data) están los precios.

## 1 · Levanta la VM de Prometheus {#prometheus}

[Inicio rápido](/docs/quickstart#region) muestra de dónde salen la imagen, la red, el grupo de seguridad y los valores de `spec`. `sshs` indica una [clave SSH](/docs/api/ssh-keys) que hayas registrado.

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

Conéctate por SSH e instala Prometheus:

```bash
sudo apt update && sudo apt install -y prometheus
```

La configuración por defecto de `/etc/prometheus/prometheus.yml` hace scraping del propio Prometheus. A continuación lo apuntaremos a nuestra flota.

## 2 · Instala node_exporter en todas las VMs de la flota {#node-exporter}

`node_exporter` es el recolector de métricas de referencia para Linux — CPU, RAM, disco, red, carga media. Escucha en el puerto 9100 por defecto.

```bash
# On every fleet VM
sudo apt install -y prometheus-node-exporter
sudo systemctl enable --now prometheus-node-exporter
```

Para una flota de más de unas pocas VMs, usa una [imagen de VM](/docs/api/vm-images) que ya incluya node_exporter, o ejecuta un script puntual de Ansible / cloud-init en el arranque. Entrar a mano por SSH en 20 VMs no es la solución a largo plazo.

Un grupo de seguridad no deja entrar nada hasta que digas lo contrario, así que ponle al grupo de la flota una regla que abra TCP 9100 al grupo de la VM de Prometheus ([Grupos de seguridad](/docs/api/security-groups)).

## 3 · Configura Prometheus para que haga scraping de la flota {#scrape}

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

Para flotas dinámicas (autoescalado, aprovisionamiento frecuente), genera la lista en lugar de escribirla a mano: `GET /api/v1/instance/` devuelve todas las VMs con sus direcciones en `nics`, y el `file_sd_configs` de Prometheus lee los destinos de un archivo que tú reescribes. La API no tiene ninguna ruta pensada para el descubrimiento de servicios de Prometheus.

Recarga Prometheus:

```bash
sudo systemctl reload prometheus
```

## 4 · Levanta Grafana {#grafana}

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

Abre el puerto 3000 a tu propia IP en el grupo de seguridad de la VM de Grafana y ve a `http://<grafana-vm-ip>:3000` en el navegador. El login por defecto es `admin/admin` (cámbialo de inmediato). Añade Prometheus como fuente de datos apuntando a la IP interna de la VM de Prometheus, puerto 9090.

Para los dashboards: importa el dashboard con id `1860` ("Node Exporter Full") de la biblioteca de Grafana. Cubre todas las métricas que emite `node_exporter`, desglosadas por instancia y agregadas.

## 5 · Las 6 alertas que importan {#alerts}

En `/etc/prometheus/alerts.yml`:

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

Por qué estas seis:

- **VMDown** — la alerta más barata y más útil. Partición de red, kernel panic, caída de qemu; quieres enterarte.
- **HighCPU** — sostenida, no picos. El `for:` de 10 minutos filtra "una consulta se ha disparado" sin perderse "estamos al límite".
- **HighMemory** — la presión de memoria precede a las terminaciones por OOM. Detéctala con 10 minutos de antelación.
- **DiskAlmostFull** — disco lleno = servicio caído. El 85 % es el umbral adecuado para avisar a la guardia, porque pasar del 85 % al 100 % puede llevar minutos durante un pico de logs.
- **DiskFillingFast** — detecta el caso del "pico de logs" antes de que salte el umbral. Usa `predict_linear` de Prometheus para extrapolar.
- **NetworkErrors** — casi siempre es una NIC defectuosa o un problema del controlador. Conviene detectarlo antes de que se propague en cascada.

Lo que NO está en esta lista: la carga media (ruidosa, varía según la carga de trabajo), las métricas de procesos individuales (usa APM, no Prometheus) y las métricas de negocio (esas van en su propio job).

## 6 · Conecta las notificaciones {#notify}

Instala Alertmanager en la VM de Prometheus:

```bash
sudo apt install -y prometheus-alertmanager
```

Configuración en `/etc/prometheus/alertmanager.yml`:

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

La URL del incoming webhook de Slack sale de tu workspace de Slack. Para las rutas de avisos de guardia (PagerDuty, OpsGenie), Alertmanager tiene bloques de configuración nativos para cada uno.

## Lo que no es {#not}

- **No es monitorización del rendimiento de aplicaciones.** Prometheus va muy bien para métricas de infraestructura (CPU, RAM, disco); para seguir la latencia a nivel de aplicación se queda corto. Para eso, usa OpenTelemetry + un backend (Honeycomb, Jaeger, Tempo).
- **No es agregación de logs.** Los logs necesitan otro stack (Loki, Elastic, etc.).
- **No es un servicio de métricas.** Es una configuración autoalojada, con los inconvenientes de autoalojar (tú mantienes la VM de Prometheus y la escalas a mano). Cuando se te quede pequeña, cámbiala.

## Próximos pasos {#next-steps}

- [Referencia de máquinas virtuales](/docs/api/vms) — las VMs que vigila esta configuración.
- [Backups](/docs/api/backups) — haz backup del volumen de la VM de Prometheus para que un año de historial no desaparezca si pierdes una sola VM.
