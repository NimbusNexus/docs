---
title: "Blue-Green-Deployments mit Floating-IPs"
description: "Deployments ohne Downtime, indem Sie eine Floating-IP zwischen zwei betriebsbereiten VMs umhängen."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Blue-Green-Deployments mit Floating-IPs

Das klassische Blue-Green-Muster: Sie betreiben die aktuelle Produktion hinter einer Floating-IP, bauen die neue Version auf einer separaten VM auf, führen Smoke-Tests gegen sie aus, solange sie noch keinen öffentlichen Traffic erhält, und hängen dann die Floating-IP von der alten VM auf die neue um. Der Traffic wechselt in ~2 Sekunden. Wenn etwas schiefgeht, hängen Sie die IP zurück.

Diese Anleitung geht von einem Workload auf einer einzelnen VM aus (eine Produktions-VM, eine Staging-VM). Für Workloads mit mehreren VMs hinter einem Load Balancer siehe [Load Balancer](/docs/api/load-balancers) — dort gilt dasselbe Muster, nur tauschen Sie stattdessen die Target-Pools des Load Balancers.

## Voraussetzungen {#prereqs}

- Zwei VMs in derselben Region. Wir nennen sie `blue` (bedient derzeit den Traffic) und `green` (nächste Version).
- Eine [Floating-IP](/docs/api/floating-ips), die derzeit an `blue` angehängt ist.
- Ein DNS-A-Eintrag, der auf die Floating-IP zeigt.
- Eine installierte CLI `nimbus` oder curl mit gesetztem $NIMBUS_KEY.

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export BLUE_ID="vm_01HG7Y3..."     # currently serving
export GREEN_ID="vm_01HG7Y4..."    # new version
export FLOATING_IP_ID="ip_01HG7..."
```

## 1 · Green-VM aufbauen {#build-green}

Starten Sie die neue Version mit aktualisiertem Code und aktualisierter Konfiguration, aber ohne angehängte Floating-IP. In dieser Phase ist sie eine eigenständige VM mit einer öffentlichen Standard-IP; kein Produktions-Traffic erreicht sie.

Deployen Sie Ihre Anwendung darauf, führen Sie Datenbankmigrationen aus (sofern sie vorwärtskompatibel sind — siehe „Schemamigrationen“ unten), wärmen Sie Caches vor und erledigen Sie alle Startarbeiten, die vor dem ersten Traffic passieren sollen.

## 2 · Smoke-Test auf Green ausführen {#smoke}

Rufen Sie die öffentliche Standard-IP von Green direkt auf:

```bash
GREEN_IP=$(curl -s {{API_BASE_URL}}/v1/vms/$GREEN_ID \
  -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.ipv4')

curl -H "Host: app.example.com" "http://$GREEN_IP/healthz"
curl -H "Host: app.example.com" "http://$GREEN_IP/api/critical-endpoint"
```

Mit dem Header `Host` testen Sie Verhalten, das vom maßgeblichen Hostnamen abhängt (z. B. Routing, CORS, alles mit Zertifikat-Pinning), ohne DNS zu ändern. Wenn Ihr Dienst HTTPS erfordert und Sie ein Zertifikat an `app.example.com` gepinnt haben, richten Sie das Zertifikat vorab auf Green ein (Let's Encrypt mit einer HTTP-01-Challenge gegen die Standard-IP von Green funktioniert).

Führen Sie alle weiteren Tests aus, die Sie vor der Übernahme in die Produktion ausführen würden:

- Vollständige Smoke-Testsuite
- Prüfung der Datenbankverbindung (besonders, wenn Green hinter einer anderen Connection-Pooler-Konfiguration steht)
- Signaturprüfung für Webhooks (falls Sie das Secret rotiert haben)

## 3 · Floating-IP umhängen {#swing}

Das ist der Cutover. Ein API-Aufruf:

```bash
curl -X POST {{API_BASE_URL}}/v1/floating-ips/$FLOATING_IP_ID/attach \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"vm_id\": \"$GREEN_ID\" }"
```

Was dabei passiert:

- Die Floating-IP wird von `blue` getrennt (die VM führte die IP als eine ihrer öffentlichen Adressen)
- Die Floating-IP wird an `green` angehängt
- Die Netzwerkpropagierung dauert ~2 Sekunden; danach bedient Green den Traffic über die IP
- TCP-Verbindungen zur IP der alten VM bleiben offen, bis sie wegen Inaktivität ablaufen (bei HTTP-Keepalive typischerweise 30–60 Sekunden); neue Verbindungen landen auf Green

Für die meisten HTTP-Workloads ist das praktisch ohne Downtime. Bestehende Verbindungen beenden ihre Requests auf Blue; neue Requests landen auf Green. Nutzer mit langlebigen Verbindungen (SSE, WebSocket) werden von ihren Clients automatisch neu verbunden.

## 4 · Green unter Traffic beobachten {#watch}

Verfolgen Sie die Logs auf Green, beobachten Sie die Fehlerraten und den Request-Graphen im Dashboard. Hier zeigen sich Anomalien unter echtem Traffic, die die Smoke-Tests nicht erfasst haben.

Das Zeitfenster, in dem ein Rollback wenig Aufwand kostet, sind die ersten ~5 Minuten. Danach ist Blue eine VM, auf der „alter Code ohne Traffic läuft“, und Sie bezahlen dafür; Sie sollten dann eines von beiden tun:

- Green übernehmen und Blue stoppen (der Normalfall)
- Beide stoppen und von vorn beginnen (selten)

## 5 · Blue stoppen {#stop-blue}

Wenn alles im grünen Bereich ist (im wörtlichen Sinn), stoppen Sie Blue, damit Sie nicht mehr dafür bezahlen:

```bash
curl -X POST {{API_BASE_URL}}/v1/vms/$BLUE_ID/stop \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Führen Sie nicht sofort `delete` aus. Gestoppte VMs kosten ~10 % einer laufenden VM (nur Speicher), und Sie können sie ~24 Stunden lang als schnelles Rollback mit `start` wieder starten. Nach 24 Stunden löschen Sie sie.

## Rollback-Pfad {#rollback}

Wenn sich Green unter Traffic fehlerhaft verhält, ist das Rollback symmetrisch:

```bash
curl -X POST {{API_BASE_URL}}/v1/floating-ips/$FLOATING_IP_ID/attach \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"vm_id\": \"$BLUE_ID\" }"
```

Wieder ~2 Sekunden, und der Traffic ist zurück auf Blue. Rollbacks werden schwieriger, wenn Ihre Datenbankmigrationen nicht vorwärtskompatibel waren — halten Sie Schemamigrationen von Code-Rollouts getrennt, dann bleibt Ihnen die Option eines Rollbacks erhalten.

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
