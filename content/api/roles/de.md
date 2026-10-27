---
title: "Rollen"
description: "Integrierte und benutzerdefinierte Rollen sowie die Endpoints für Rollenzuweisungen, die einem Benutzer eine Rolle in einem Projekt erteilen."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Rollen

Eine Rolle ist ein Bündel von Berechtigungen. Eine **Rollenzuweisung** erteilt einem Benutzer eine Rolle in einem Projekt. Derselbe Benutzer kann in verschiedenen Projekten verschiedene Rollen haben; ein Benutzer ohne Rolle in einem Projekt kann es gar nicht sehen.

## Integrierte Rollen {#built-in}

Jedes Projekt bringt vier integrierte Rollen mit, die Sie zuweisen können, ohne selbst etwas zu definieren:

| Rolle | Was sie darf |
| --- | --- |
| **`viewer`** | Jede Ressource lesen. Kein Schreiben, kein Löschen. Richtig für Monitoring-Tools, Auditoren. |
| **`editor`** | Die meisten Ressourcen erstellen + aktualisieren. Kann IAM (Benutzer, Rollen, Keys) nicht verwalten. Richtig für Entwickler im Alltag. |
| **`admin`** | Alles, was `editor` kann, plus IAM. Kann Benutzer erstellen, Rollen erteilen/widerrufen, API-Keys verwalten. |
| **`billing-admin`** | Rechnungen lesen, Zahlungsmethode ändern, Kontingent ansehen + erhöhen. Kein Zugriff auf Ressourcen. Richtig für die Finanzabteilung. |

Die Rolle `admin` umfasst `billing-admin` **nicht** und umgekehrt. Das ist Absicht — wer die API bedient, sollte nicht auch die Rechnung freigeben.

## Granulare Rollen {#granular}

Über die vier integrierten Rollen hinaus bieten wir granulare Rollen pro Ressource für die Fälle, in denen `editor` zu viel ist:

- `vms:operator` — nur VMs erstellen / starten / stoppen / löschen, kein Netzwerk
- `storage:operator` — Volumes, Buckets, Snapshots, Backups verwalten
- `dns:admin` — vollständige Verwaltung von DNS-Zonen + -Einträgen; sonst nichts
- `networking:admin` — Netzwerke, Subnetze, Sicherheitsgruppen, Floating-IPs, LBs
- `databases:admin` — verwaltete Datenbanken + ihre Backups

Sie weisen diese genauso zu wie die integrierten Rollen, über `POST /v1/role-assignments`.

## Benutzerdefinierte Rollen {#custom}

Definieren Sie eigene Rollen über `POST /v1/roles` (nicht im minimalen Beispiel unten), indem Sie die Berechtigungen auflisten, die gebündelt werden sollen. Berechtigungsnamen folgen dem Muster `<resource>:<action>` — z. B. `vms:read`, `volumes:create`, `databases:snapshot`. Den vollständigen Katalog der Berechtigungen liefert `GET /v1/permissions`.

Anwendungsfälle für benutzerdefinierte Rollen: „alles lesen außer Abrechnung“ für einen Sicherheitsauditor; „DNS-Einträge verwalten, aber keine Zonen“ für ein Marketingteam, das für die Inhalte von Subdomains zuständig ist, aber nicht für die Delegierung der Zone.

## Wie sich Rollenzuweisungen kombinieren {#compose}

Ein Benutzer kann in einem Projekt mehrere Rollenzuweisungen haben. Die effektiven Berechtigungen sind die **Vereinigungsmenge** — die Rollenliste ist additiv, nicht multiplikativ. Erhält derselbe Benutzer `viewer` + `vms:operator`, darf er alles lesen + speziell VMs schreiben.

Wenn Sie eine Rolle widerrufen, bleiben die anderen bestehen. Um einem Benutzer alle Rechte zu entziehen, löschen Sie jede Zuweisung einzeln oder löschen Sie den Benutzer (das widerruft alle Zuweisungen atomar).

## Nächste Schritte {#next-steps}

- [Benutzer](/docs/api/users) — wem Sie Rollen erteilen.
- [Projekte](/docs/api/projects) — worauf sich die erteilten Rollen beziehen.
- [Authentifizierung](/docs/authentication) — wie API-Keys den Rollen von Benutzern zugeordnet sind.
