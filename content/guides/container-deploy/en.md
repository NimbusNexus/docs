---
title: Container deployment patterns
description: Single VM, systemd-managed Docker, behind a floating IP. The 80-percent pattern.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Container deployment patterns

NimbusNexus doesn't (yet) ship a managed Kubernetes service. The 80-percent pattern for running a small number of containerized services here: one VM per service, Docker as the container runtime, systemd as the supervisor, a floating IP for the public address. Simple, observable, debuggable.

This guide walks the canonical pattern. For scaled-out services where you really need orchestration (>10 services interacting, complex traffic routing, autoscaling), bring your own Kubernetes (k3s or k0s on a small cluster of VMs, or a managed offering elsewhere); that's outside the scope of this page.

## What you'll have at the end {#overview}

- One VM running your container behind systemd
- A [floating IP](/docs/api/floating-ips) pointing at it
- Logs flowing to journald (and from there, to wherever you want)
- A clean rolling-deploy story for code updates

## 1 · Provision a VM {#vm}

Pick a size that fits your service. For most stateless API/web workloads, `gp-1-2` (1 vCPU, 2 GB RAM) is a fine starting point — scale up if you need more.

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

`user_data` runs on first boot — here it installs Docker. By the time the VM transitions to `running`, Docker is ready.

## 2 · Allocate a floating IP {#floating-ip}

```bash
curl -X POST {{API_BASE_URL}}/v1/floating-ips \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"region\": \"us-east-1\", \"vm_id\": \"$VM_ID\" }"
```

The IP attaches to the VM and becomes its public address. Save the IPv4:

```bash
export PUBLIC_IP=$(curl -s {{API_BASE_URL}}/v1/floating-ips/$FLOATING_IP_ID \
  -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.ipv4')
```

Point your DNS at it ([DNS records](/docs/api/dns-records) or your existing registrar).

## 3 · Build + push your container image {#image}

Build your container image somewhere (locally, in CI). Push it to whichever registry you prefer:

- **Docker Hub** — free for public images.
- **GitHub Container Registry** (`ghcr.io`) — free for public repos, included with GitHub.
- **NimbusNexus Object Storage** — if you'd rather self-host, push tarballs to a private bucket and pull them in the systemd unit (slightly more work to manage tags).

For this guide we'll use `ghcr.io/yourorg/api:v1.4.2`.

## 4 · Configure the systemd unit on the VM {#systemd}

SSH to the VM:

```bash
ssh ubuntu@$PUBLIC_IP
```

Create the unit file at `/etc/systemd/system/api.service`:

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

A few notes:

- **`--network host`** — the container binds to the VM's network directly. Simpler than the default bridge network; works for a single-container setup. Don't use this if you're running multiple containers that need to talk to each other on private ports.
- **`--rm`** — clean up the container after exit. Combined with `Restart=always`, systemd respawns it on crash.
- **`--env-file /etc/api/env`** — load secrets + config from a file. Keep this file root-readable only (`chmod 600`).
- **`Restart=always`** — systemd brings the container back on crash. Five-second `RestartSec` prevents tight crash loops.

Put your secrets in `/etc/api/env`:

```env
DATABASE_URL=postgresql://app:••••@{{DB_HOST_DEMO}}:6432/app?sslmode=verify-full
NIMBUS_KEY=nn_live_xxxxxxxxxxxxxxxx
JWT_SECRET=...
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now api.service
```

## 5 · Verify it's serving {#verify}

```bash
curl http://$PUBLIC_IP/healthz
```

If you see the response from your service, you're done.

## 6 · Rolling deploys {#deploys}

To deploy a new version, just update the image tag in the unit file and restart:

```bash
sudo sed -i 's|api:v1.4.2|api:v1.4.3|g' /etc/systemd/system/api.service
sudo systemctl daemon-reload
sudo systemctl restart api.service
```

That's a 1–2 second blip (container stop → image pull → new container start).

For zero-downtime, use the [blue/green pattern](/docs/guides/blue-green): two VMs, two containers, swing the floating IP between them at cutover.

## 7 · Logs {#logs}

Container stdout/stderr flows into journald automatically:

```bash
sudo journalctl -u api.service -f
```

For longer-term log retention, ship from journald to wherever you store logs:

- **systemd-journal-remote** — built-in upload to another systemd box.
- **Vector** — multi-output, including S3-compatible object storage (push to a NimbusNexus bucket).
- **Promtail + Loki** — Grafana-stack log aggregation.

## Why this pattern over Kubernetes {#why}

**For a single service:** Kubernetes is 80 % overhead. The control plane, the scheduler, the manifest YAML — all to run one container. Systemd does the same job in 30 lines.

**For two services:** still no. Two VMs, two systemd units. Service-to-service traffic over the public floating IPs (or via a private [network](/docs/api/networks) if you want them off the internet).

**For five-plus services:** the overhead/value ratio flips. At that point, look at Kubernetes (k3s on a small cluster of VMs is a pragmatic middle ground) or Nomad (lighter than k8s, designed for this size).

## What this pattern doesn't do {#limitations}

- **No autoscaling.** Manual `nimbus vms create` scales out; manual `nimbus vms delete` scales in. Fine for stable workloads; bad for traffic-shaped ones.
- **No service discovery.** Services find each other via known public IPs or DNS — not via in-cluster lookups. For two-or-three-service setups this is fine; beyond that, you want a registry.
- **No health-check-driven restarts beyond the container's exit code.** systemd restarts on crash; it doesn't restart on "process is running but unhealthy." Add your own watchdog (a sidecar that hits `/healthz` and `kill -1`s the container on failure) if you need this.

## Next steps {#next-steps}

- [Blue/green deploys](/docs/guides/blue-green) — zero-downtime version of the deploy story above.
- [Virtual machines](/docs/api/vms) — every option for the create call.
- [Monitor a VM fleet](/docs/guides/monitoring-vms) — Prometheus + Grafana setup.
- [Static site guide](/docs/guides/static-site) — for pure static content, this pattern is overkill; use object storage instead.
