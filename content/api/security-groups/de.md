---
title: "Sicherheitsgruppen"
description: "Zustandsbehaftete Firewall-Regelsätze für die Netzwerkschnittstellen von VMs."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Sicherheitsgruppen

Sicherheitsgruppen sind Regelsätze einer **zustandsbehafteten Firewall**. Sie hängen eine oder mehrere Gruppen an die Netzwerkschnittstelle einer VM an; durchgesetzt wird die Vereinigungsmenge der Regeln aller Gruppen. Standardverhalten: **jeden eingehenden Traffic ablehnen, jeden ausgehenden erlauben** — eine explizite Allow-List für eingehenden Traffic, ausgehend offen, bis Sie etwas anderes festlegen.

## Was zustandsbehaftet bedeutet {#stateful}

Sie schreiben Regeln nur für die **initiierende** Richtung. Wenn Sie eingehendes TCP auf Port 443 erlauben, sind die Antwortpakete an den Client automatisch erlaubt — für den Rückverkehr ist keine separate ausgehende Regel nötig.

Zum Vergleich: Bei einer zustandslosen ACL (z. B. AWS Network ACLs) bräuchten Sie symmetrische Regeln in beide Richtungen. Sicherheitsgruppen sind für Firewalling auf Anwendungsebene leichter zu durchschauen; zustandslose ACLs sind für Richtlinien von Tenant-Netzwerken auf einer Schicht unterhalb der VM leichter zu durchschauen.

## Aufbau einer Regel {#rules}

Jede Regel hat:

- **Richtung** — `ingress` oder `egress`
- **Protokoll** — `tcp`, `udp`, `icmp` oder `any`
- **Portbereich** — einzelner Port (`80`), Bereich (`8000-9000`) oder „any“
- **Quelle / Ziel** — ein CIDR-Block (`0.0.0.0/0`, `10.0.0.0/8`) ODER die ID einer anderen Sicherheitsgruppe

Der Modus „Quelle ist eine andere Sicherheitsgruppe“ ist der, den Sie am ehesten kennen sollten. Eine Regel wie „Port 5432 von `web-tier-sg` erlauben“ lässt jede VM der Gruppe `web-tier-sg` Ihre Postgres-VM auf 5432 erreichen — ohne dass Sie IPs aufzählen müssen, und die Regel funktioniert weiter, wenn VMs in `web-tier-sg` hinzukommen oder wegfallen.

## Ein gängiges Muster {#pattern}

Für eine Web-App mit 3 Schichten:

1. **`web-tier-sg`** — eingehend `tcp/80` und `tcp/443` von `0.0.0.0/0` erlauben (öffentlich)
2. **`app-tier-sg`** — eingehend `tcp/8080` von `web-tier-sg` erlauben (nur die Web-Schicht erreicht die App-Schicht)
3. **`db-tier-sg`** — eingehend `tcp/5432` von `app-tier-sg` erlauben (nur die App-Schicht erreicht die Datenbank)

Das lässt sich kombinieren: Sie können eine 4. Gruppe für ein Ops-VPN hinzufügen, die SSH von den IPs Ihres Büros erlaubt, und sie neben `db-tier-sg` an die Datenbank-VMs anhängen, ohne die App-Regeln anzufassen.

## Nächste Schritte {#next-steps}

- [Virtuelle Maschinen](/docs/api/vms) — woran Sicherheitsgruppen angehängt werden.
- [Netzwerke](/docs/api/networks) und [Subnetze](/docs/api/subnets) — die Netzwerkbausteine, die Sicherheitsgruppen schützen.
