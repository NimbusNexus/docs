---
title: "Projektnetzwerk einrichten"
description: "Netzwerke, Subnetze, Router und Sicherheitsgruppen — der Standardaufbau für eine mehrschichtige App."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Projektnetzwerk einrichten

Der Standardaufbau eines NimbusNexus-Netzwerks für eine mehrschichtige Anwendung: ein privates Netzwerk mit zwei Subnetzen (öffentlich erreichbar und nur für die Datenbank), ein Router, der das öffentliche Subnetz mit dem Internet verbindet, und Sicherheitsgruppen, die den Traffic zwischen den Schichten einschränken. Diese Anleitung führt Sie durch das gesamte Setup und erklärt, wozu jedes Teil da ist.

Am Ende haben Sie:

- Ein Netzwerk mit zwei Subnetzen (`10.0.1.0/24` für Web, `10.0.2.0/24` für die Datenbank)
- Einen Router mit externem Gateway, an das Web-Subnetz angebunden
- Zwei Sicherheitsgruppen: `web-sg` (HTTPS offen zum Internet) und `db-sg` (Port 5432 nur von `web-sg`)
- Ein Testmuster, mit dem Sie prüfen, ob die Isolation funktioniert

## Warum dieser Aufbau {#why}

Apps auf einer einzelnen VM brauchen nichts davon — eine VM mit einer Floating-IP und ohne Netzwerkkonfiguration funktioniert problemlos. Dieser Aufbau ist für Apps gedacht, die:

- mehrere Komponenten haben (Web-Schicht + Datenbank, Web-Schicht + Worker-Schicht + Cache, ...)
- Teile des Stacks aus dem öffentlichen Internet heraushalten müssen
- durchsetzen wollen: „Die Web-Schicht darf mit der DB-Schicht sprechen; sonst niemand“

Für eine echte Anwendung auf einer einzelnen VM siehe stattdessen [Container-Deployment-Muster](/docs/guides/container-deploy).

## Voraussetzungen {#prereqs}

- Ein API-Key mit den Scopes `networks:write` und `vms:write`.
- Eine gewählte Region (wir verwenden `us-east-1`).
- Eine grobe Vorstellung davon, welche VMs / Dienste Sie in welcher Schicht haben wollen.

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · Netzwerk erstellen {#network}

Ein Netzwerk ist die L2-Broadcast-Domain — alle VMs und Ressourcen, die an dasselbe Netzwerk angebunden sind, können untereinander routen (vorbehaltlich der Sicherheitsgruppen).

```bash
curl -X POST {{API_BASE_URL}}/v1/networks \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "app-network",
    "region": "us-east-1",
    "cidr": "10.0.0.0/16"
  }'
```

Der Block `10.0.0.0/16` ist der Adressraum für alles in diesem Netzwerk. Wählen Sie einen Bereich, der sich nicht mit Ihrem Büro-VPN, Ihrem Heimnetz oder einem anderen Netzwerk überschneidet, mit dem Sie später vielleicht ein Peering einrichten (`192.168.0.0/16` ist daher meist eine schlechte Wahl — zu verbreitet). `10.0.0.0/16` funktioniert für die meisten Setups; `172.16.0.0/12` ist ebenfalls in Ordnung.

Speichern Sie die Netzwerk-ID:

```bash
export NET_ID="net_01HG7Y3..."
```

## 2 · Zwei Subnetze erstellen {#subnets}

Teilen Sie das Netzwerk in zwei Subnetze auf — eines für alles, was dem öffentlichen Internet zugewandt ist, und eines für alles, was das nicht sein soll.

```bash
# Web subnet — VMs that need internet access
curl -X POST {{API_BASE_URL}}/v1/subnets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web\",
    \"network_id\": \"$NET_ID\",
    \"cidr\": \"10.0.1.0/24\",
    \"gateway_ip\": \"10.0.1.1\"
  }"

# Database subnet — for tier-2 resources
curl -X POST {{API_BASE_URL}}/v1/subnets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db\",
    \"network_id\": \"$NET_ID\",
    \"cidr\": \"10.0.2.0/24\",
    \"gateway_ip\": \"10.0.2.1\"
  }"
```

Die Gateway-IP ist die Adresse der Router-Schnittstelle in diesem Subnetz. VMs verwenden sie als Standardroute.

## 3 · Router erstellen und an das Web-Subnetz anbinden {#router}

Der Router bringt den Traffic aus dem Web-Subnetz ins Internet (und zurück). Das Datenbank-Subnetz bekommt keine Verbindung zum Router — so halten Sie es aus dem öffentlichen Internet heraus.

```bash
curl -X POST {{API_BASE_URL}}/v1/routers \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"app-router\",
    \"region\": \"us-east-1\",
    \"external_gateway\": true
  }"
```

`external_gateway: true` teilt dem Router eine öffentliche IP zu und aktiviert SNAT für ausgehenden Traffic aus den angebundenen Subnetzen.

Speichern Sie die Router-ID und binden Sie den Router an das Web-Subnetz an:

```bash
export ROUTER_ID="rtr_01HG7Y3..."

curl -X POST {{API_BASE_URL}}/v1/routers/$ROUTER_ID/interfaces \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"subnet_id\": \"$WEB_SUBNET_ID\" }"
```

Das DB-Subnetz bleibt ohne Router. Alles im DB-Subnetz erreicht nur, was über das L2-Netzwerk erreichbar ist — also andere Ressourcen im selben Netzwerk, gesteuert durch Sicherheitsgruppen.

## 4 · Sicherheitsgruppen erstellen {#security-groups}

Sicherheitsgruppen sind zustandsbehaftete Firewalls, die auf die Netzwerkschnittstellen einer VM angewendet werden. Sie steuern, welcher Traffic hereinkommt (eingehend) und welcher hinausgeht (ausgehend). „Zustandsbehaftet“ bedeutet, dass eine von innen aufgebaute Verbindung automatisch auch in Gegenrichtung zugelassen wird — Sie brauchen nur Regeln für Verbindungen, die von außen aufgebaut werden.

```bash
# Web security group — HTTPS open to the internet
curl -X POST {{API_BASE_URL}}/v1/security-groups \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "web-sg",
    "region": "us-east-1",
    "ingress_rules": [
      { "protocol": "tcp", "port": 443, "source_cidr": "0.0.0.0/0", "description": "HTTPS" },
      { "protocol": "tcp", "port": 22, "source_cidr": "203.0.113.5/32", "description": "SSH from office" }
    ],
    "egress_rules": [
      { "protocol": "any", "destination_cidr": "0.0.0.0/0", "description": "anywhere" }
    ]
  }'

# DB security group — port 5432 only from the web SG
curl -X POST {{API_BASE_URL}}/v1/security-groups \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "db-sg",
    "region": "us-east-1",
    "ingress_rules": [
      { "protocol": "tcp", "port": 5432, "source_security_group": "web-sg", "description": "Postgres from web tier" }
    ],
    "egress_rules": [
      { "protocol": "any", "destination_cidr": "0.0.0.0/0", "description": "anywhere" }
    ]
  }'
```

`source_security_group` in der Regel der DB-SG setzt „nur die Web-Schicht darf sich verbinden“ durch — statt eines statischen CIDR verweist die Regel auf die SG selbst. Jede VM, die mit `web-sg` versehen ist, erreicht die DB. Fügen Sie VMs zu `web-sg` hinzu oder entfernen Sie sie, und die Zugriffsliste aktualisiert sich automatisch.

Die Web-SG öffnet Port 22 (SSH) für eine bestimmte Büro-IP, nicht für die ganze Welt. Öffnen Sie SSH nicht für `0.0.0.0/0` — in jeder Cloud gibt es Scanner, die Port 22 auf schwache Passwörter prüfen.

## 5 · VMs anbinden {#attach}

Geben Sie beim Erstellen einer VM das Netzwerk, das Subnetz und die Sicherheitsgruppen an:

```bash
# Web tier VM
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web-01\",
    \"size\": \"gp-2-4\",
    \"region\": \"us-east-1\",
    \"image\": \"ubuntu-24.04\",
    \"network_interfaces\": [
      { \"subnet_id\": \"$WEB_SUBNET_ID\", \"security_groups\": [\"web-sg\"] }
    ]
  }"

# Database tier VM (if running DB on your own VM rather than managed DB)
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db-01\",
    \"size\": \"gp-4-8\",
    \"region\": \"us-east-1\",
    \"image\": \"ubuntu-24.04\",
    \"network_interfaces\": [
      { \"subnet_id\": \"$DB_SUBNET_ID\", \"security_groups\": [\"db-sg\"] }
    ]
  }"
```

Für den externen Zugriff auf die Web-VM teilen Sie eine [Floating-IP](/docs/api/floating-ips) zu und hängen sie an. Die DB-VM bekommt nie eine Floating-IP — so funktioniert die Netzwerkisolation.

## 6 · Isolation prüfen {#verify}

Testen Sie, ob der Aufbau tatsächlich durchsetzt, was Sie wollten:

```bash
# From the web VM, can we reach the DB on 5432? (Should: yes)
nc -v -w 3 10.0.2.10 5432

# From the web VM, can we reach the DB on 22 (SSH)? (Should: no — DB SG only opens 5432)
nc -v -w 3 10.0.2.10 22

# From your laptop, can we reach the DB directly? (Should: no — DB subnet isn't routable from internet)
nc -v -w 3 <DB_PUBLIC_IP> 5432  # there's no public IP, this fails
```

Wenn sich einer dieser Tests nicht wie erwartet verhält, stimmen die Regeln der Sicherheitsgruppen oder die Anbindungen an Netzwerk/Subnetz nicht. Prüfen Sie sie erneut.

## Was das nicht ist {#not}

- **Kein VPC-Peering.** Das ist das interne Netzwerk eines einzelnen Projekts. Die Netzwerke zweier NimbusNexus-Projekte werden nicht per Peering verbunden — mit Absicht (siehe [Sicherheitsmodell](/docs/security#network)).
- **Keine vollständige WAF- oder DDoS-Schicht.** Sicherheitsgruppen arbeiten auf L3/L4 — sie können die Bodys von HTTP-Requests nicht inspizieren. Für Filterung auf Anwendungsebene betreiben Sie eine WAF (z. B. ModSecurity hinter nginx) in der Web-Schicht.
- **Kein Autoscaling.** Sie verwalten die VMs manuell. Für automatisch skalierte Flotten funktionieren dieselben Netzwerkbausteine, aber zur Verwaltung im großen Maßstab sollten Sie Infrastructure as Code (Terraform, Pulumi) einsetzen.

## Nächste Schritte {#next-steps}

- [Referenz für Netzwerke](/docs/api/networks) — alle Optionen für den Aufruf zum Erstellen.
- [Referenz für Subnetze](/docs/api/subnets) — IPv6-Setup, DHCP-Optionen, Überschreiben von DNS-Nameservern.
- [Referenz für Sicherheitsgruppen](/docs/api/security-groups) — die vollständige Regelsyntax.
- [Referenz für Router](/docs/api/routers) — statische Routen, BGP-Advertisement, fortgeschrittenere Verschaltung.
- [Floating-IPs](/docs/api/floating-ips) — der Baustein für öffentliche IPs, der das Ganze mit der Außenwelt verbindet.
