---
title: "Projektnetzwerk einrichten"
description: "Netzwerke, Subnetze, Router und Sicherheitsgruppen — der Standardaufbau für eine mehrschichtige App."
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: guide
---

# Projektnetzwerk einrichten

Der Standardaufbau eines NimbusNexus-Netzwerks für eine mehrschichtige Anwendung: ein privates Netzwerk pro Schicht (öffentlich erreichbar und nur für die Datenbank), ein Router, der sie untereinander und mit dem Internet verbindet, und Sicherheitsgruppen, die den Traffic zwischen den Schichten einschränken. Diese Anleitung führt Sie durch das gesamte Setup und erklärt, wozu jedes Teil da ist.

Am Ende haben Sie:

- Zwei Netzwerke mit je einem Subnetz (`10.0.1.0/24` für Web, `10.0.2.0/24` für die Datenbank)
- Einen Router mit externem Gateway, an beide Subnetze angebunden
- Zwei Sicherheitsgruppen: `web-sg` (HTTPS offen zum Internet) und `db-sg` (Port 5432 nur von `web-sg`)
- Ein Testmuster, mit dem Sie prüfen, ob die Isolation funktioniert

## Warum dieser Aufbau {#why}

Apps auf einer einzelnen VM brauchen nichts davon — eine VM im externen Netzwerk hat direkt eine öffentliche Adresse. Dieser Aufbau ist für Apps gedacht, die:

- mehrere Komponenten haben (Web-Schicht + Datenbank, Web-Schicht + Worker-Schicht + Cache, ...)
- Teile des Stacks aus dem öffentlichen Internet heraushalten müssen
- durchsetzen wollen: „Die Web-Schicht darf mit der DB-Schicht sprechen; sonst niemand“

Für eine echte Anwendung auf einer einzelnen VM siehe stattdessen [Container-Deployment-Muster](/docs/guides/container-deploy).

## Voraussetzungen {#prereqs}

- Ein API-Key, der diese Aufrufe machen darf: `unrestricted` oder mit Zugriffsregeln, die sie nennen ([Was ein Key darf](/docs/authentication#scopes)).
- Eine grobe Vorstellung davon, welche VMs / Dienste Sie in welcher Schicht haben wollen.

Alles, was Sie hier erstellen, landet in der [Region](/docs/api/regions) Ihrer Sitzung.

```bash
export NIMBUS_KEY="<your-api-key>"
```

## 1 · Netzwerke erstellen {#network}

Ein Netzwerk ist die L2-Broadcast-Domain — alle VMs und Ressourcen, die an dasselbe Netzwerk angebunden sind, können einander erreichen (vorbehaltlich der Sicherheitsgruppen). Erstellen Sie eines pro Schicht: Eine VM tritt einem Netzwerk bei, nicht einem Subnetz, daher könnten Sie in einem Netzwerk mit zwei Subnetzen nicht wählen, in welchem Subnetz sie landet.

```bash
curl -X POST {{API_BASE_URL}}/api/v1/network/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web-network" }'

curl -X POST {{API_BASE_URL}}/api/v1/network/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "db-network" }'
```

Jede Antwort enthält die `id` des neuen Netzwerks unter `data`. Speichern Sie beide:

```bash
export WEB_NET_ID="<web-network-id>"
export DB_NET_ID="<db-network-id>"
```

## 2 · Zwei Subnetze erstellen {#subnets}

Geben Sie jedem Netzwerk einen Adressblock. Wählen Sie einen Bereich, der sich nicht mit Ihrem Büro-VPN, Ihrem Heimnetz oder einem anderen Netzwerk überschneidet, mit dem Sie sich später vielleicht verbinden (`192.168.0.0/16` ist daher meist eine schlechte Wahl — zu verbreitet). Blöcke innerhalb von `10.0.0.0/16` funktionieren für die meisten Setups; `172.16.0.0/12` ist ebenfalls in Ordnung.

```bash
# Web subnet
curl -X POST {{API_BASE_URL}}/api/v1/subnet/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web\",
    \"network_id\": \"$WEB_NET_ID\",
    \"ip_version\": 4,
    \"cidr\": \"10.0.1.0/24\",
    \"gateway_ip\": \"10.0.1.1\"
  }"

# Database subnet
curl -X POST {{API_BASE_URL}}/api/v1/subnet/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db\",
    \"network_id\": \"$DB_NET_ID\",
    \"ip_version\": 4,
    \"cidr\": \"10.0.2.0/24\",
    \"gateway_ip\": \"10.0.2.1\"
  }"
```

Die Gateway-IP ist die Adresse der Router-Schnittstelle in diesem Subnetz. VMs verwenden sie als Standardroute.

Speichern Sie die `id` beider Subnetze:

```bash
export WEB_SUBNET_ID="<web-subnet-id>"
export DB_SUBNET_ID="<db-subnet-id>"
```

## 3 · Router erstellen und an beide Subnetze anbinden {#router}

Der Router bringt den Traffic aus den Subnetzen ins Internet (und zurück) und von einem Subnetz zum anderen. `GET /api/v1/router/artifacts` listet die externen Netzwerke auf, mit denen er sich verbinden kann:

```bash
curl -s {{API_BASE_URL}}/api/v1/router/artifacts \
  -H "X-API-Key: $NIMBUS_KEY" | jq '.data.external_networks.data'
```

```bash
export EXTERNAL_NET_ID="<external-network-id>"

curl -X POST {{API_BASE_URL}}/api/v1/router/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"app-router\",
    \"external_gateway_info\": { \"network_id\": \"$EXTERNAL_NET_ID\" },
    \"bandwidth_subscription\": \"Monthly\",
    \"bandwidth_mbps\": 100
  }"
```

`external_gateway_info` teilt dem Router eine öffentliche IP zu und aktiviert SNAT für ausgehenden Traffic aus den angebundenen Subnetzen. Außerdem braucht es `bandwidth_subscription` und `bandwidth_mbps` (ein Vielfaches von 10): Das Gateway wird auf diese Bandbreite begrenzt, und die Bandbreite wird abgerechnet ([Preisdaten](/docs/api/pricing-data)).

Speichern Sie die Router-ID und binden Sie den Router an beide Subnetze an:

```bash
export ROUTER_ID="<router-id>"

curl -X PUT {{API_BASE_URL}}/api/v1/router/$ROUTER_ID/interface \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"subnet_id\": \"$WEB_SUBNET_ID\" }"

curl -X PUT {{API_BASE_URL}}/api/v1/router/$ROUTER_ID/interface \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"subnet_id\": \"$DB_SUBNET_ID\" }"
```

Die Web-Schicht kann jetzt die Datenbank-Schicht erreichen, und Datenbank-VMs können das Internet erreichen, etwa für Paket-Updates. Nichts im Internet kann eine VM ohne Floating-IP erreichen — so halten Sie die Datenbank-Schicht aus dem öffentlichen Internet heraus.

## 4 · Sicherheitsgruppen erstellen {#security-groups}

Sicherheitsgruppen sind zustandsbehaftete Firewalls, die auf die Netzwerkschnittstellen einer VM angewendet werden. Sie steuern, welcher Traffic hereinkommt (eingehend) und welcher hinausgeht (ausgehend). „Zustandsbehaftet“ bedeutet, dass eine von innen aufgebaute Verbindung automatisch auch in Gegenrichtung zugelassen wird — Sie brauchen nur Regeln für Verbindungen, die von außen aufgebaut werden. Eine neue Gruppe lässt jeden Traffic hinaus und keinen herein, daher brauchen diese beiden nur Regeln für eingehenden Traffic.

```bash
curl -X POST {{API_BASE_URL}}/api/v1/security_group/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web-sg", "description": "Web tier" }'

curl -X POST {{API_BASE_URL}}/api/v1/security_group/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "db-sg", "description": "Database tier" }'
```

Speichern Sie die `id` beider Gruppen und fügen Sie dann pro Aufruf eine Regel hinzu:

```bash
export WEB_SG_ID="<web-sg-id>"
export DB_SG_ID="<db-sg-id>"

# Web security group — HTTPS open to the internet
curl -X POST {{API_BASE_URL}}/api/v1/security_group/rule \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"security_group_id\": \"$WEB_SG_ID\",
    \"direction\": \"ingress\",
    \"ether\": \"IPv4\",
    \"protocol\": \"tcp\",
    \"port_min\": 443,
    \"remote_cidr\": \"0.0.0.0/0\",
    \"description\": \"HTTPS\"
  }"

# Web security group — SSH from your office
curl -X POST {{API_BASE_URL}}/api/v1/security_group/rule \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"security_group_id\": \"$WEB_SG_ID\",
    \"direction\": \"ingress\",
    \"ether\": \"IPv4\",
    \"protocol\": \"tcp\",
    \"port_min\": 22,
    \"remote_cidr\": \"203.0.113.5/32\",
    \"description\": \"SSH from office\"
  }"

# DB security group — port 5432 only from the web SG
curl -X POST {{API_BASE_URL}}/api/v1/security_group/rule \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"security_group_id\": \"$DB_SG_ID\",
    \"direction\": \"ingress\",
    \"ether\": \"IPv4\",
    \"protocol\": \"tcp\",
    \"port_min\": 5432,
    \"remote_sec_grp\": \"$WEB_SG_ID\",
    \"description\": \"Postgres from web tier\"
  }"
```

`remote_sec_grp` in der Regel der DB-SG setzt „nur die Web-Schicht darf sich verbinden“ durch — statt eines statischen CIDR verweist die Regel auf die SG selbst. Jede VM in `web-sg` erreicht die DB. Fügen Sie VMs zu `web-sg` hinzu oder entfernen Sie sie, und die Zugriffsliste aktualisiert sich automatisch.

Die Web-SG öffnet Port 22 (SSH) für eine bestimmte Büro-IP, nicht für die ganze Welt. Öffnen Sie SSH nicht für `0.0.0.0/0` — in jeder Cloud gibt es Scanner, die Port 22 auf schwache Passwörter prüfen.

## 5 · VMs anbinden {#attach}

Geben Sie beim Erstellen einer VM das Netzwerk und die Sicherheitsgruppen an. [Schnellstart](/docs/quickstart#region) zeigt, woher das Image und die Werte für `spec` stammen. `sshs` nennt einen [SSH-Key](/docs/api/ssh-keys), den Sie registriert haben.

```bash
export SSH_KEY_NAME="<ssh-key-name>"

# Web tier VM
curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web-01\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 2,
      \"ram\": 4096,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 25,
    \"network\": [\"$WEB_NET_ID\"],
    \"security_group\": [\"$WEB_SG_ID\"],
    \"sshs\": \"$SSH_KEY_NAME\"
  }"

# Database tier VM (if running DB on your own VM)
curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db-01\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 4,
      \"ram\": 8192,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 50,
    \"network\": [\"$DB_NET_ID\"],
    \"security_group\": [\"$DB_SG_ID\"],
    \"sshs\": \"$SSH_KEY_NAME\"
  }"
```

Für den externen Zugriff auf die Web-VM teilen Sie eine [Floating-IP](/docs/api/floating-ips) zu und hängen sie an. Die DB-VM bekommt nie eine Floating-IP — so funktioniert die Netzwerkisolation.

## 6 · Isolation prüfen {#verify}

Testen Sie, ob der Aufbau tatsächlich durchsetzt, was Sie wollten. Die Adresse der DB-VM finden Sie in `nics` von `GET /api/v1/instance/`; wir nehmen an, sie lautet `10.0.2.10`.

```bash
# From the web VM, can we reach the DB on 5432? (Should: yes)
nc -v -w 3 10.0.2.10 5432

# From the web VM, can we reach the DB on 22 (SSH)? (Should: no — DB SG only opens 5432)
nc -v -w 3 10.0.2.10 22

# From your laptop, can we reach the DB directly? (Should: no — the DB VM has no public IP)
nc -v -w 3 10.0.2.10 5432
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
- [Referenz für Router](/docs/api/routers) — statische Routen und wie NAT funktioniert.
- [Floating-IPs](/docs/api/floating-ips) — der Baustein für öffentliche IPs, der das Ganze mit der Außenwelt verbindet.
