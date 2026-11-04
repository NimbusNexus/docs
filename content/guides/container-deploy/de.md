---
title: "Container-Deployment-Muster"
description: "Eine einzelne VM, Docker unter systemd, hinter einer Floating-IP. Das 80-Prozent-Muster."
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: guide
---

# Container-Deployment-Muster

NimbusNexus bietet (noch) keinen verwalteten Kubernetes-Dienst an. Das 80-Prozent-Muster, um hier eine kleine Zahl containerisierter Dienste zu betreiben: eine VM pro Dienst, Docker als Container-Runtime, systemd als Supervisor, eine Floating-IP für die öffentliche Adresse. Einfach, beobachtbar, gut zu debuggen.

Diese Anleitung geht das typische Muster Schritt für Schritt durch. Für skalierte Dienste, bei denen Sie wirklich Orchestrierung brauchen (>10 interagierende Dienste, komplexes Traffic-Routing, Autoscaling), bringen Sie Ihr eigenes Kubernetes mit (k3s oder k0s auf einem kleinen Cluster aus VMs oder ein verwaltetes Angebot anderswo); das geht über den Rahmen dieser Seite hinaus.

## Was Sie am Ende haben {#overview}

- Eine VM, die Ihren Container unter systemd betreibt
- Eine [Floating-IP](/docs/api/floating-ips), die auf sie zeigt
- Logs, die in journald fließen (und von dort, wohin Sie wollen)
- Einen sauberen Ablauf für Rolling-Deployments bei Code-Updates

## 1 · VM bereitstellen {#vm}

Wählen Sie eine Größe, die zu Ihrem Dienst passt. Für die meisten zustandslosen API-/Web-Workloads sind eine vCPU und 2 GB RAM ein guter Ausgangspunkt — skalieren Sie hoch, wenn Sie mehr brauchen. [Schnellstart](/docs/quickstart#region) zeigt, woher das Image, das Netzwerk, die Sicherheitsgruppe und die Werte für `spec` stammen. Die Sicherheitsgruppe muss SSH und den Port Ihres Dienstes hereinlassen ([Sicherheitsgruppen](/docs/api/security-groups)), und `sshs` nennt einen [SSH-Key](/docs/api/ssh-keys), den Sie registriert haben.

```bash
export SSH_KEY_NAME="<ssh-key-name>"
USER_DATA='#!/bin/bash\napt-get update && apt-get install -y docker.io'

curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"api-prod\",
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
    \"sshs\": \"$SSH_KEY_NAME\",
    \"user_data\": \"$USER_DATA\"
  }"
```

`user_data` läuft beim ersten Boot — hier installiert es Docker. Die VM erreicht `ACTIVE`, bevor dieses Skript abgeschlossen ist, geben Sie ihr also ein bis zwei Minuten.

Der Aufruf antwortet ohne ID. Suchen Sie die VM anhand ihres Namens und prüfen Sie, ob ihr `status` `ACTIVE` erreicht hat:

```bash
export VM_ID=$(curl -s {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq -r '.data[] | select(.name == "api-prod") | .id')

curl -s {{API_BASE_URL}}/api/v1/instance/$VM_ID \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data.status'
```

## 2 · Floating-IP zuteilen {#floating-ip}

Das Netzwerk der VM braucht einen [Router](/docs/api/routers) zum externen Netzwerk. Lesen Sie aus, was der nächste Aufruf braucht, das externe Netzwerk sowie den Port und die feste IP der VM:

```bash
curl -s "{{API_BASE_URL}}/api/v1/floating_ip/artifacts?resource_id=$VM_ID" \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '{ networks: [.data.floating_networks.data[] | { id, name }], interfaces: .data.interfaces.data }'
```

```bash
export FLOATING_NETWORK_ID="<external-network-id>"
export PORT_ID="<port-id>"
export FIXED_IP="<fixed-ip>"
```

Teilen Sie dann die IP zu. Eine neue Floating-IP braucht einen Abrechnungsplan und eine Obergrenze für die Bandbreite: `bandwidth_mbps` ist ein Vielfaches von 10, und die Bandbreite wird abgerechnet ([Preisdaten](/docs/api/pricing-data)).

```bash
export PUBLIC_IP=$(curl -s -X POST {{API_BASE_URL}}/api/v1/floating_ip/allocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"floating_network_id\": \"$FLOATING_NETWORK_ID\",
    \"vm_port_id\": \"$PORT_ID\",
    \"vm_ip_address\": \"$FIXED_IP\",
    \"bandwidth_subscription\": \"Monthly\",
    \"bandwidth_mbps\": 100
  }" | jq -r '.data.ip_address')
```

Die IP wird an die VM angehängt und zu ihrer öffentlichen Adresse.

Richten Sie Ihr DNS darauf aus ([DNS-Einträge](/docs/api/dns-records) oder Ihr bestehender Registrar).

## 3 · Container-Image bauen und pushen {#image}

Bauen Sie Ihr Container-Image an beliebiger Stelle (lokal, in der CI). Pushen Sie es in eine Registry Ihrer Wahl:

- **Docker Hub** — kostenlos für öffentliche Images.
- **GitHub Container Registry** (`ghcr.io`) — kostenlos für öffentliche Repos, bei GitHub inklusive.
- **Objektspeicher von NimbusNexus** — wenn Sie lieber selbst hosten, pushen Sie Tarballs in einen privaten Objektspeicher-Container und laden sie in der systemd-Unit herunter (etwas mehr Aufwand bei der Verwaltung von Tags).

In dieser Anleitung verwenden wir `ghcr.io/yourorg/api:v1.4.2`.

## 4 · systemd-Unit auf der VM konfigurieren {#systemd}

Verbinden Sie sich per SSH mit der VM:

```bash
ssh ubuntu@$PUBLIC_IP
```

Legen Sie die Unit-Datei unter `/etc/systemd/system/api.service` an:

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

Einige Hinweise:

- **`--network host`** — der Container bindet sich direkt an das Netzwerk der VM. Einfacher als das Standard-Bridge-Netzwerk; funktioniert für ein Setup mit einem einzelnen Container. Verwenden Sie das nicht, wenn Sie mehrere Container betreiben, die über private Ports miteinander kommunizieren müssen.
- **`--rm`** — räumt den Container nach dem Beenden auf. Zusammen mit `Restart=always` startet systemd ihn nach einem Absturz neu.
- **`--env-file /etc/api/env`** — lädt Secrets + Konfiguration aus einer Datei. Machen Sie diese Datei nur für root lesbar (`chmod 600`).
- **`Restart=always`** — systemd startet den Container nach einem Absturz wieder. Ein `RestartSec` von fünf Sekunden verhindert enge Absturzschleifen.

Legen Sie Ihre Secrets in `/etc/api/env` ab:

```env
DATABASE_URL=postgresql://app:••••@10.0.2.10:5432/app?sslmode=require
NIMBUS_KEY=<your-api-key>
JWT_SECRET=...
```

Aktivieren und starten Sie den Dienst:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now api.service
```

## 5 · Prüfen, ob der Dienst antwortet {#verify}

```bash
curl http://$PUBLIC_IP/healthz
```

Wenn Sie die Antwort Ihres Dienstes sehen, sind Sie fertig.

## 6 · Rolling-Deployments {#deploys}

Um eine neue Version zu deployen, ändern Sie einfach das Image-Tag in der Unit-Datei und starten neu:

```bash
sudo sed -i 's|api:v1.4.2|api:v1.4.3|g' /etc/systemd/system/api.service
sudo systemctl daemon-reload
sudo systemctl restart api.service
```

Das ergibt eine Unterbrechung von 1–2 Sekunden (Container stoppen → Image pullen → neuen Container starten).

Für Deployments ohne Downtime verwenden Sie das [Blue-Green-Muster](/docs/guides/blue-green): zwei VMs, zwei Container, beim Cutover hängen Sie die Floating-IP zwischen ihnen um.

## 7 · Logs {#logs}

stdout/stderr des Containers fließen automatisch in journald:

```bash
sudo journalctl -u api.service -f
```

Für eine längerfristige Aufbewahrung der Logs leiten Sie sie aus journald dorthin weiter, wo Sie Logs speichern:

- **systemd-journal-remote** — integrierter Upload auf einen anderen systemd-Rechner.
- **Vector** — Log-Versand mit mehreren Ausgaben.
- **Promtail + Loki** — Log-Aggregation mit dem Grafana-Stack.

## Warum dieses Muster statt Kubernetes {#why}

**Für einen einzelnen Dienst:** Kubernetes ist zu 80 % Overhead. Die Control Plane, der Scheduler, das Manifest-YAML — alles, um einen Container zu betreiben. Systemd erledigt dieselbe Aufgabe in 30 Zeilen.

**Für zwei Dienste:** immer noch nicht. Zwei VMs, zwei systemd-Units. Der Traffic zwischen den Diensten läuft über die öffentlichen Floating-IPs (oder über ein privates [Netzwerk](/docs/api/networks), wenn die Dienste nicht im Internet erreichbar sein sollen).

**Ab fünf Diensten:** Das Verhältnis von Overhead zu Nutzen kippt. Dann lohnt sich ein Blick auf Kubernetes (k3s auf einem kleinen Cluster aus VMs ist ein pragmatischer Mittelweg) oder Nomad (leichter als k8s, für diese Größe ausgelegt).

## Was dieses Muster nicht tut {#limitations}

- **Kein Autoscaling.** Sie skalieren horizontal hoch, indem Sie eine VM erstellen (`POST /api/v1/instance/`), und wieder herunter, indem Sie eine löschen (`POST /api/v1/instance/action`). Gut für stabile Workloads, schlecht für Workloads, die sich nach dem Traffic richten.
- **Keine Service-Discovery.** Dienste finden sich über bekannte öffentliche IPs oder DNS — nicht über Lookups innerhalb eines Clusters. Bei Setups mit zwei oder drei Diensten ist das in Ordnung; darüber hinaus brauchen Sie eine Registry.
- **Keine Neustarts auf Basis von Health-Checks über den Exit-Code des Containers hinaus.** systemd startet nach einem Absturz neu, aber nicht bei „Prozess läuft, ist aber nicht gesund“. Ergänzen Sie einen eigenen Watchdog (einen Sidecar, der `/healthz` aufruft und dem Container bei einem Fehler `kill -1` sendet), wenn Sie das brauchen.

## Nächste Schritte {#next-steps}

- [Blue-Green-Deployments](/docs/guides/blue-green) — die Variante des obigen Deployment-Ablaufs ohne Downtime.
- [Virtuelle Maschinen](/docs/api/vms) — alle Optionen für den Aufruf zum Erstellen.
- [VM-Flotte überwachen](/docs/guides/monitoring-vms) — Setup mit Prometheus + Grafana.
- [Anleitung für statische Sites](/docs/guides/static-site) — für rein statische Inhalte ist dieses Muster überdimensioniert; verwenden Sie stattdessen Objektspeicher.
