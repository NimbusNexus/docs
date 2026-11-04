---
title: "Blue-Green-Deployments mit Floating-IPs"
description: "Deployments ohne Downtime, indem Sie eine Floating-IP zwischen zwei betriebsbereiten VMs umhängen."
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: guide
---

# Blue-Green-Deployments mit Floating-IPs

Das klassische Blue-Green-Muster: Sie betreiben die aktuelle Produktion hinter einer Floating-IP, bauen die neue Version auf einer separaten VM auf, führen Smoke-Tests gegen sie aus, solange sie noch keinen öffentlichen Traffic erhält, und hängen dann die Floating-IP von der alten VM auf die neue um. Der Traffic wechselt, sobald die IP angehängt ist. Wenn etwas schiefgeht, hängen Sie die IP zurück.

Diese Anleitung geht von einem Workload auf einer einzelnen VM aus (eine Produktions-VM, eine Staging-VM). Für Workloads mit mehreren VMs hinter einem Load Balancer siehe [Load Balancer](/docs/api/load-balancers) — dort gilt dasselbe Muster, nur tauschen Sie stattdessen die Target-Pools des Load Balancers.

## Voraussetzungen {#prereqs}

- Zwei VMs in derselben Region. Wir nennen sie `blue` (bedient derzeit den Traffic) und `green` (nächste Version).
- Eine [Floating-IP](/docs/api/floating-ips), die derzeit an `blue` angehängt ist.
- Ein DNS-A-Eintrag, der auf die Floating-IP zeigt.
- `curl` und `jq`, wobei `$NIMBUS_KEY` auf einen [API-Key](/docs/authentication) gesetzt ist, der diese Aufrufe machen darf.

```bash
export NIMBUS_KEY="<your-api-key>"
export BLUE_ID="<blue-vm-id>"     # currently serving
export GREEN_ID="<green-vm-id>"    # new version
export FLOATING_IP_ID="<floating-ip-id>"
```

`GET /api/v1/instance/` listet Ihre VMs auf und `GET /api/v1/floating_ip/` Ihre Floating-IPs, jeweils mit ihren IDs.

## 1 · Green-VM aufbauen {#build-green}

Starten Sie die neue Version mit aktualisiertem Code und aktualisierter Konfiguration, aber ohne angehängte Floating-IP. In dieser Phase ist sie eine eigenständige VM mit einer eigenen Adresse; kein Produktions-Traffic erreicht sie.

Deployen Sie Ihre Anwendung darauf, führen Sie Datenbankmigrationen aus (sofern sie vorwärtskompatibel sind — siehe „Schemamigrationen“ unten), wärmen Sie Caches vor und erledigen Sie alle Startarbeiten, die vor dem ersten Traffic passieren sollen.

## 2 · Smoke-Test auf Green ausführen {#smoke}

Rufen Sie die eigene Adresse von Green direkt auf, von einem Ort aus, der sie erreichen kann: von einer anderen VM im selben Netzwerk oder von überall, wenn Green im externen Netzwerk liegt. `GET /api/v1/instance/{server_id}/interfaces/` listet die Schnittstellen einer VM auf, eine pro Netzwerk; `.data[0]` unten ist die erste.

```bash
GREEN_IP=$(curl -s {{API_BASE_URL}}/api/v1/instance/$GREEN_ID/interfaces/ \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data[0].fixed_ips[0].ip_address')

curl -H "Host: app.example.com" "http://$GREEN_IP/healthz"
curl -H "Host: app.example.com" "http://$GREEN_IP/api/critical-endpoint"
```

Mit dem Header `Host` testen Sie Verhalten, das vom maßgeblichen Hostnamen abhängt (z. B. Routing, CORS, alles mit Zertifikat-Pinning), ohne DNS zu ändern. Wenn Ihr Dienst HTTPS erfordert und Sie ein Zertifikat an `app.example.com` gepinnt haben, richten Sie das Zertifikat vorab auf Green ein.

Führen Sie alle weiteren Tests aus, die Sie vor der Übernahme in die Produktion ausführen würden:

- Vollständige Smoke-Testsuite
- Prüfung der Datenbankverbindung (besonders, wenn Green hinter einer anderen Connection-Pooler-Konfiguration steht)
- Signaturprüfung für Webhooks (falls Sie das Secret rotiert haben)

## 3 · Floating-IP umhängen {#swing}

Das ist der Cutover: zwei API-Aufrufe, einer zum Trennen und einer zum Anhängen. Lesen Sie zuerst aus, was der Aufruf zum Anhängen braucht, den Port von Green und das externe Netzwerk, zu dem die IP gehört:

```bash
GREEN_PORT_ID=$(curl -s {{API_BASE_URL}}/api/v1/instance/$GREEN_ID/interfaces/ \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data[0].port_id')

FLOATING_NETWORK_ID=$(curl -s {{API_BASE_URL}}/api/v1/floating_ip/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq -r ".data[] | select(.id == \"$FLOATING_IP_ID\") | .network")
```

Hängen Sie sie dann um:

```bash
# Detach the IP from blue
curl -X POST {{API_BASE_URL}}/api/v1/floating_ip/deallocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"id\": \"$FLOATING_IP_ID\" }"

# Attach it to green
curl -X POST {{API_BASE_URL}}/api/v1/floating_ip/allocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"floating_ip_id\": \"$FLOATING_IP_ID\",
    \"floating_network_id\": \"$FLOATING_NETWORK_ID\",
    \"vm_port_id\": \"$GREEN_PORT_ID\",
    \"vm_ip_address\": \"$GREEN_IP\"
  }"
```

Was dabei passiert:

- Die Floating-IP wird von `blue` getrennt. Zwischen den beiden Aufrufen steht keine VM hinter der Adresse, führen Sie sie also direkt nacheinander aus.
- Die Floating-IP wird an `green` angehängt, und Green bedient den Traffic über die IP.
- Neue Verbindungen landen auf Green. Ein Client mit einer offenen Verbindung über die Floating-IP muss sich möglicherweise neu verbinden.

Für die meisten HTTP-Workloads ist das praktisch ohne Downtime. Nutzer mit langlebigen Verbindungen (SSE, WebSocket) werden von ihren Clients automatisch neu verbunden.

## 4 · Green unter Traffic beobachten {#watch}

Verfolgen Sie die Logs auf Green, beobachten Sie die Fehlerraten und den Request-Graphen im Dashboard. Hier zeigen sich Anomalien unter echtem Traffic, die die Smoke-Tests nicht erfasst haben.

Das Zeitfenster, in dem ein Rollback wenig Aufwand kostet, sind die ersten ~5 Minuten. Danach ist Blue eine VM, auf der „alter Code ohne Traffic läuft“, und Sie bezahlen dafür; Sie sollten dann eines von beiden tun:

- Green übernehmen und Blue stoppen (der Normalfall)
- Beide stoppen und von vorn beginnen (selten)

## 5 · Blue stoppen {#stop-blue}

Wenn alles im grünen Bereich ist (im wörtlichen Sinn), stoppen Sie Blue:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/action \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"servers\": [\"$BLUE_ID\"], \"cmd\": \"stop\" }"
```

Löschen Sie sie nicht sofort: Eine gestoppte VM kann als schnelles Rollback mit `start` wieder starten. Sie wird allerdings weiter abgerechnet, denn eine VM wird vom Erstellen bis zum Löschen abgerechnet. Sobald Sie das Rollback nicht mehr brauchen, löschen Sie sie mit `"cmd": "delete"`.

## Rollback-Pfad {#rollback}

Wenn sich Green unter Traffic fehlerhaft verhält, ist das Rollback symmetrisch. Starten Sie Blue wieder, falls Sie sie gestoppt haben (`"cmd": "start"`), und hängen Sie dann die IP zurück:

```bash
BLUE_PORT_ID=$(curl -s {{API_BASE_URL}}/api/v1/instance/$BLUE_ID/interfaces/ \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data[0].port_id')

BLUE_IP=$(curl -s {{API_BASE_URL}}/api/v1/instance/$BLUE_ID/interfaces/ \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data[0].fixed_ips[0].ip_address')

curl -X POST {{API_BASE_URL}}/api/v1/floating_ip/deallocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"id\": \"$FLOATING_IP_ID\" }"

curl -X POST {{API_BASE_URL}}/api/v1/floating_ip/allocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"floating_ip_id\": \"$FLOATING_IP_ID\",
    \"floating_network_id\": \"$FLOATING_NETWORK_ID\",
    \"vm_port_id\": \"$BLUE_PORT_ID\",
    \"vm_ip_address\": \"$BLUE_IP\"
  }"
```

Dieselben zwei Aufrufe, und der Traffic ist zurück auf Blue. Rollbacks werden schwieriger, wenn Ihre Datenbankmigrationen nicht vorwärtskompatibel waren — halten Sie Schemamigrationen von Code-Rollouts getrennt, dann bleibt Ihnen die Option eines Rollbacks erhalten.

## Schemamigrationen {#migrations}

Das Muster, mit dem Blue-Green auch bei Schemaänderungen sauber funktioniert: **Migration und Deployment entkoppeln**.

Jede Schemaänderung besteht aus zwei PRs im Abstand von einer Woche:

1. **Migrations-PR.** Eine abwärtskompatible Schemamigration. Neue Tabellen, neue Spalten, die NULL zulassen, neue Indizes. Alter Code funktioniert weiterhin mit dem neuen Schema. Deployen Sie das auf dem normalen Weg (kein Blue-Green nötig — Abwärtskompatibilität bedeutet, dass die Migration gefahrlos für sich allein ausgerollt werden kann).
2. **Code-PR.** Code, der das neue Schema nutzt. Deployen Sie ihn per Blue-Green.

Wenn Sie eine Spalte entfernen oder einen Typ ändern müssen, ist die Reihenfolge umgekehrt: Der Code nutzt die Spalte nicht mehr → Code deployen → die Migration entfernt die Spalte. Immer zwei PRs mit zeitlichem Abstand. Dazwischen ist jederzeit eine Pause sicher.

Dieses Muster macht mehr Arbeit als „Schema + Code immer zusammen deployen“, aber es erhält die Sicherheit des Rollbacks, und genau dafür gibt es Blue-Green überhaupt.

## Nächste Schritte {#next-steps}

- [Referenz für Floating-IPs](/docs/api/floating-ips) — alle Endpoints der Ressource, die dieses Muster möglich macht.
- [Load Balancer](/docs/api/load-balancers) — die Version desselben Musters für mehrere VMs.
- [Multi-Region-Failover](/docs/guides/multi-region) — dieselbe Idee, angewendet auf geografisch weit entfernte Paare.
