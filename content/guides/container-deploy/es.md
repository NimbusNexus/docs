---
title: "Patrones de despliegue de contenedores"
description: "Una sola VM y Docker gestionado con systemd, detrás de una IP flotante. El patrón que cubre el 80 % de los casos."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Patrones de despliegue de contenedores

NimbusNexus no ofrece (todavía) un servicio de Kubernetes gestionado. El patrón que cubre el 80 % de los casos para ejecutar aquí unos pocos servicios en contenedores: una VM por servicio, Docker como entorno de ejecución de contenedores, systemd como supervisor y una IP flotante para la dirección pública. Sencillo, observable y fácil de depurar.

Esta guía recorre el patrón de referencia. Para servicios escalados horizontalmente en los que de verdad necesitas orquestación (>10 servicios que interactúan, enrutamiento de tráfico complejo, autoescalado), usa tu propio Kubernetes (k3s o k0s en un pequeño cluster de VMs, o una oferta gestionada de otro proveedor); eso queda fuera del alcance de esta página.

## Lo que tendrás al final {#overview}

- Una VM que ejecuta tu contenedor bajo systemd
- Una [IP flotante](/docs/api/floating-ips) que apunta a ella
- Logs que van a journald (y, desde ahí, adonde quieras)
- Una forma limpia de hacer despliegues progresivos al actualizar el código

## 1 · Provisiona una VM {#vm}

Elige un tamaño que se ajuste a tu servicio. Para la mayoría de las cargas de trabajo de API/web sin estado, `gp-1-2` (1 vCPU, 2 GB de RAM) es un buen punto de partida — redimensiónala si necesitas más.

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "api-prod",
    "size": "gp-1-2",
    "region": "us-east-1",
    "image": "ubuntu-24.04",
    "user_data": "#!/bin/bash\napt-get update && apt-get install -y docker.io"
  }'
```

`user_data` se ejecuta en el primer arranque — aquí instala Docker. Cuando la VM pasa a `running`, Docker ya está listo.

## 2 · Reserva una IP flotante {#floating-ip}

```bash
curl -X POST {{API_BASE_URL}}/v1/floating-ips \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"region\": \"us-east-1\", \"vm_id\": \"$VM_ID\" }"
```

La IP se asocia a la VM y pasa a ser su dirección pública. Guarda la IPv4:

```bash
export PUBLIC_IP=$(curl -s {{API_BASE_URL}}/v1/floating-ips/$FLOATING_IP_ID \
  -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.ipv4')
```

Apunta tu DNS a ella ([Registros DNS](/docs/api/dns-records) o tu registrador actual).

## 3 · Construye y sube tu imagen de contenedor {#image}

Construye tu imagen de contenedor en algún sitio (en local, en CI). Súbela al registro que prefieras:

- **Docker Hub** — gratis para imágenes públicas.
- **GitHub Container Registry** (`ghcr.io`) — gratis para repositorios públicos, incluido con GitHub.
- **Almacenamiento de objetos de NimbusNexus** — si prefieres alojarlo tú, sube archivos tar a un bucket privado y descárgalos en la unidad de systemd (gestionar las etiquetas da algo más de trabajo).

En esta guía usaremos `ghcr.io/yourorg/api:v1.4.2`.

## 4 · Configura la unidad de systemd en la VM {#systemd}

Conéctate a la VM por SSH:

```bash
ssh ubuntu@$PUBLIC_IP
```

Crea el archivo de unidad en `/etc/systemd/system/api.service`:

```ini
[Unit]
Description=API container
After=docker.service network-online.target
Requires=docker.service

[Service]
Restart=always
RestartSec=5
TimeoutStartSec=60

# Pull the image; ignore failures (we'll retry on next start)
ExecStartPre=-/usr/bin/docker pull ghcr.io/yourorg/api:v1.4.2
# Stop any existing container; ignore failure (no container = fine)
ExecStartPre=-/usr/bin/docker stop api
ExecStartPre=-/usr/bin/docker rm api

ExecStart=/usr/bin/docker run \
  --name api \
  --rm \
  --network host \
  --env-file /etc/api/env \
  ghcr.io/yourorg/api:v1.4.2

ExecStop=/usr/bin/docker stop api

[Install]
WantedBy=multi-user.target
```

Algunas notas:

- **`--network host`** — el contenedor se enlaza directamente a la red de la VM. Es más sencillo que la red bridge por defecto y funciona para una configuración de un solo contenedor. No lo uses si ejecutas varios contenedores que necesitan comunicarse entre sí por puertos privados.
- **`--rm`** — elimina el contenedor cuando termina. Junto con `Restart=always`, systemd lo vuelve a lanzar si falla.
- **`--env-file /etc/api/env`** — carga los secretos y la configuración desde un archivo. Haz que solo root pueda leerlo (`chmod 600`).
- **`Restart=always`** — systemd vuelve a levantar el contenedor si falla. Un `RestartSec` de cinco segundos evita bucles de fallos seguidos.

Pon tus secretos en `/etc/api/env`:

```env
DATABASE_URL=postgresql://app:••••@{{DB_HOST_DEMO}}:6432/app?sslmode=verify-full
NIMBUS_KEY=nn_live_xxxxxxxxxxxxxxxx
JWT_SECRET=...
```

Habilítala e iníciala:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now api.service
```

## 5 · Comprueba que está sirviendo {#verify}

```bash
curl http://$PUBLIC_IP/healthz
```

Si ves la respuesta de tu servicio, has terminado.

## 6 · Despliegues progresivos {#deploys}

Para desplegar una versión nueva, basta con actualizar la etiqueta de la imagen en el archivo de unidad y reiniciar:

```bash
sudo sed -i 's|api:v1.4.2|api:v1.4.3|g' /etc/systemd/system/api.service
sudo systemctl daemon-reload
sudo systemctl restart api.service
```

Eso supone un corte de 1–2 segundos (parada del contenedor → descarga de la imagen → arranque del contenedor nuevo).

Para no tener downtime, usa el [patrón blue/green](/docs/guides/blue-green): dos VMs, dos contenedores, y mueves la IP flotante de una a otra en el cutover.

## 7 · Logs {#logs}

La salida stdout/stderr del contenedor llega a journald automáticamente:

```bash
sudo journalctl -u api.service -f
```

Para conservar los logs más tiempo, envíalos desde journald adonde los guardes:

- **systemd-journal-remote** — subida integrada a otra máquina con systemd.
- **Vector** — varias salidas, incluido almacenamiento de objetos compatible con S3 (envíalos a un bucket de NimbusNexus).
- **Promtail + Loki** — agregación de logs con el stack de Grafana.

## Por qué este patrón y no Kubernetes {#why}

**Para un solo servicio:** Kubernetes es un 80 % de sobrecarga. El plano de control, el scheduler, el YAML de los manifiestos — todo para ejecutar un contenedor. Systemd hace el mismo trabajo en 30 líneas.

**Para dos servicios:** todavía no. Dos VMs, dos unidades de systemd. El tráfico entre servicios va por las IPs flotantes públicas (o por una [red](/docs/api/networks) privada si quieres sacarlos de internet).

**Para cinco servicios o más:** la relación entre sobrecarga y valor se invierte. Llegado ese punto, plantéate Kubernetes (k3s en un pequeño cluster de VMs es un término medio pragmático) o Nomad (más ligero que k8s y pensado para este tamaño).

## Lo que no hace este patrón {#limitations}

- **Sin autoescalado.** Escalas horizontalmente con `nimbus vms create` a mano y reduces con `nimbus vms delete` a mano. Vale para cargas de trabajo estables; no para las que varían con el tráfico.
- **Sin descubrimiento de servicios.** Los servicios se encuentran entre sí por IPs públicas conocidas o por DNS — no mediante búsquedas dentro del cluster. Para configuraciones de dos o tres servicios no pasa nada; a partir de ahí, te conviene un registro de servicios.
- **Sin reinicios por comprobación de estado más allá del código de salida del contenedor.** systemd reinicia si hay un fallo; no reinicia ante "el proceso está en ejecución pero no está sano". Si lo necesitas, añade tu propio watchdog (un sidecar que llame a `/healthz` y haga `kill -1` al contenedor si falla).

## Próximos pasos {#next-steps}

- [Despliegues blue/green](/docs/guides/blue-green) — la versión sin downtime del despliegue descrito arriba.
- [Máquinas virtuales](/docs/api/vms) — todas las opciones de la llamada de creación.
- [Monitoriza una flota de VMs](/docs/guides/monitoring-vms) — configuración de Prometheus + Grafana.
- [Guía de sitios estáticos](/docs/guides/static-site) — para contenido puramente estático, este patrón es excesivo; usa el almacenamiento de objetos.
