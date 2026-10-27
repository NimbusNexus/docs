---
title: "Kontingente"
description: "Limits pro Projekt für VMs, vCPU, RAM, Speicher, Floating-IPs und weitere Ressourcen."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Kontingente

Kontingente sind Limits pro Projekt, die begrenzen, wie viel einer Ressource ein Projekt haben kann. Sie verhindern ausufernde Kosten durch versehentliche Schleifen und stellen sicher, dass der Verbrauch eines Projekts nicht die Kapazität einer Region aufbraucht.

## Wofür es Kontingente gibt {#what}

Jedes Projekt hat ein Kontingent für jede dieser Ressourcen:

| Ressource | Standardkontingent | Hinweise |
| --- | --- | --- |
| VMs | 50 | Pro Region; als „VM“ zählt jeder Zustand außer `terminated` |
| vCPU | 200 | Summe über alle laufenden VMs |
| RAM (GB) | 800 | Summe über alle laufenden VMs |
| Blockspeicher (GB) | 5.000 | Summe aller Volumes (angehängt + getrennt) |
| Objektspeicher (GB) | unbegrenzt | Nur weiches Limit: Ab ~50 TB melden wir uns bei Ihnen, um die Erwartungen abzustimmen |
| Snapshots | 200 | Pro Region; gelöschte Snapshots zählen nicht |
| Backups | 500 | Pro Region |
| Floating-IPs | 20 | Pro Region |
| Netzwerke | 10 | Pro Region |
| Sicherheitsgruppen | 50 | Pro Region |
| Load Balancer | 10 | Pro Region |
| DNS-Zonen | 50 | Projektweit |
| Benutzer | 25 | Projektweit |

Die Standardwerte sind konservativ. Bei den meisten Produktionsprojekten werden die am stärksten genutzten Achsen (vCPU, RAM, Speicher) kurz nach dem Start auf 5–10× angehoben.

## Kontingent vs. Verbrauch {#quota-vs-usage}

Die Endpoints liefern beides:

- `GET /v1/quotas` — die **Limits** (50 VMs, 200 vCPU usw.)
- `GET /v1/quotas/usage` — den **aktuellen Verbrauch** (12 von 50 VMs genutzt, 48 von 200 vCPU usw.)

Prüfen Sie immer den Verbrauch, bevor Sie Ressourcen in großer Zahl erstellen; ein Request, der Sie über das Kontingent bringen würde, erhält 429 mit leerem `Retry-After` (da das Kontingent nicht zeitlich begrenzt ist, hilft Wiederholen nicht — Sie müssen etwas löschen oder das Kontingent erhöhen).

## Kontingent erhöhen {#raising}

Kontingenterhöhungen laufen über das Support-Kontaktformular, nicht über die API. Drei Gründe:

1. **Kapazitätsplanung.** Für große Erhöhungen (10×+) muss Hardware in der Zielregion reserviert werden.
2. **Compliance.** Manche Kontingenterhöhungen erfordern ein kurzes Gespräch über die Art des Workloads.
3. **Missbrauchsschutz.** Einen Self-Service-Endpoint für Kontingenterhöhungen würde ein kompromittiertes Konto als Erstes aufrufen.

Die meisten Erhöhungen sind in weniger als einem Werktag erledigt. Produktionsmigrationen werden noch am selben Tag bearbeitet, wenn Sie sie in der Anfrage kennzeichnen.

## Kontingente über Regionen hinweg {#regions}

Die meisten Kontingente gelten **pro Region** (VMs, Snapshots, Netzwerke). Einige gelten **projektweit** (DNS-Zonen, Benutzer). Die Antwort des Endpoints macht das explizit — jeder Kontingenteintrag hat ein Feld `scope` (`region: us-east-1` oder `project`).

## Nächste Schritte {#next-steps}

- [Projekte](/docs/api/projects) — der Container, für den Kontingente gelten.
- [Authentifizierung](/docs/authentication) — wie Sie diese Endpoints aufrufen.
- Das **Support-Kontaktformular** unter [/contact/support]({{BASE_URL}}/contact/support) — dort beantragen Sie Kontingenterhöhungen.
