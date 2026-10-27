---
title: "Load Balancer"
description: "Verwaltete Traffic-Verteilung (L4 / L7) über einen Pool von Backend-VMs."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Load Balancer

Ein Load Balancer steht mit einer einzigen VIP (virtuellen IP) vor einer Flotte von VMs, verteilt den Traffic auf die Backends und nimmt fehlerhafte Backends automatisch aus der Rotation. Zwei Varianten: **L4** (TCP / UDP / Proxy-Protokoll) und **L7** (HTTP / HTTPS mit Routing nach Pfad + Header).

## Die vier Unterressourcen {#sub-resources}

Ein Load Balancer ist selbst ein Container; die Routing-Logik steckt in verschachtelten Ressourcen:

- **Listener** — einer pro (Protokoll, Port), auf dem der LB Traffic annimmt. `HTTPS:443` ist ein Listener; `HTTP:80` ist ein weiterer. Ein einzelner LB kann viele Listener haben.
- **Pool** — eine Gruppe von Backend-VMs, pro Listener definiert. Jeder Pool hat einen Algorithmus (`round-robin`, `least-connections`, `source-ip-hash`) und eine Richtlinie für Session-Persistenz.
- **Member** — ein Backend in einem Pool. Verweist auf VM + Port + Gewichtung.
- **Health monitor** — der aktive Health-Check pro Pool. Fehlerhafte Member werden aus der Rotation genommen, bis sie sich erholen.

Die Endpoints unten arbeiten mit dem Load Balancer auf oberster Ebene. Die verschachtelten CRUD-Operationen für Listener/Pools/Member/Health Monitors liegen unter `/v1/load-balancers/{id}/listeners` usw. (nicht in diesem minimalen Beispiel — beschrieben in der Live-Spezifikation).

## SSL-Terminierung {#ssl}

Für HTTPS-Listener haben Sie zwei Möglichkeiten:

- **TLS wird am LB terminiert.** Laden Sie ein Zertifikat hoch (oder nutzen Sie Let's Encrypt über das Add-on cert-manager); der LB spricht TLS mit den Clients und Klartext mit Ihren VMs. Einfacher zu verwalten; der LB kann HTTP-Header für das L7-Routing auswerten.
- **TLS-Passthrough.** Der LB leitet nur auf L4 per TCP weiter; Ihre VMs übernehmen TLS. Erforderlich, wenn das Backend das ursprüngliche Client-Zertifikat sehen muss.

## Health-Checks {#health-checks}

Ein Health Monitor prüft jeden Member regelmäßig (standardmäßig alle 10 s) auf einem konfigurierten Pfad / Port. Drei Ergebnisse:

- **Healthy** (fehlerfrei) — die letzten 2 Prüfungen waren erfolgreich (Standard; konfigurierbar). Der Member erhält Traffic.
- **Unhealthy** (fehlerhaft) — die letzten 3 Prüfungen sind fehlgeschlagen (konfigurierbar). Der Member wird aus der Rotation genommen; bestehende Verbindungen laufen aus.
- **Recovering** (in Erholung) — war Unhealthy und besteht die Prüfungen jetzt wieder. Wechselt nach 2 erfolgreichen Prüfungen zu Healthy.

Bei HTTP-Health-Checks sendet der LB einen GET an `/healthz` (konfigurierbar) und erwartet 200. Implementieren Sie `/healthz` in Ihrer App so, dass es schnell einen Body zurückgibt — und lassen Sie den Check keine echte Arbeit erledigen, sonst wird der Check selbst zur Last.

## Preise {#pricing}

Load Balancer werden pauschal pro Stunde und Region abgerechnet (\$0,024/Stunde für das Standard-Tier in der EN-Preisreferenz). Listener / Pool / Member / Health Monitor anzulegen ist kostenlos. Traffic zwischen LBs in verschiedenen Regionen zählt als normaler Egress zwischen Regionen.

## Nächste Schritte {#next-steps}

- [Virtuelle Maschinen](/docs/api/vms) — was zu Membern eines Pools wird.
- [Floating-IPs](/docs/api/floating-ips) — Alternative für den öffentlichen Zugriff auf eine einzelne VM ohne LB.
- [Sicherheitsgruppen](/docs/api/security-groups) — die Firewall an der VM-Schnittstelle; LBs beachten die Sicherheitsgruppen der Member.
