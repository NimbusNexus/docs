---
title: "Projekte"
description: "Die Isolationseinheit für Ressourcen, Abrechnung und Zugriffskontrolle."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Projekte

Ein Projekt ist die **Isolationseinheit** bei NimbusNexus — für Ressourcen, Abrechnung und Zugriffskontrolle. Jede Ressource (VM, Volume, Bucket, Datenbank, Netzwerk, …) gehört zu genau einem Projekt; jeder API-Key ist auf genau ein Projekt beschränkt; jede Rechnungsposition gilt für genau ein Projekt.

## Warum Projekte wichtig sind {#why}

Drei Garantien, die Ihnen die Projektgrenze gibt:

1. **Schadensradius.** Ein kompromittierter API-Key für das Projekt `dev` kann keine Ressourcen in `prod` anfassen. Sie sind aus `dev` heraus buchstäblich nicht sichtbar.
2. **Kostenzuordnung.** Jedes Projekt bekommt eine eigene Rechnung. Wenn die Finanzabteilung dem Marketing die Hosting-Rechnung der Website berechnen will, bekommt das Marketing ein Projekt. Wenn die Entwicklung Ausgaben pro Team zuordnen will, bekommt jedes Team ein Projekt.
3. **Kontingent.** Kontingente gelten pro Projekt. Ein Projekt, das außer Kontrolle gerät und VMs am laufenden Band erstellt, verbraucht nicht den Spielraum eines anderen Projekts.

## Projekthierarchie {#hierarchy}

Projekte können ein übergeordnetes Projekt haben (ab dem Tarif Organization). Die Hierarchie sieht so aus:

```text
acme-org (root)
├── acme-prod
├── acme-staging
└── acme-dev
```

Ein Benutzer mit der Rolle `admin` in `acme-org` erbt automatisch Admin-Rechte in jedem untergeordneten Projekt. Ein Benutzer mit Admin-Rechten nur in `acme-prod` kann `acme-staging` und `acme-dev` nicht sehen. Das ist der Standardmechanismus für „zentrale Governance, dezentraler Alltag“.

Die Hierarchie ist optional. Konten im Standardtarif erhalten ein Root-Projekt pro Konto; Konten im Tarif Organization können Bäume mit bis zu 5 Ebenen aufbauen.

## Was in einem Projekt liegt {#contents}

- VMs, Volumes, Snapshots, Backups
- Buckets, Archive
- Datenbanken
- Netzwerke, Subnetze, Router, Sicherheitsgruppen, Floating-IPs, Load Balancer
- DNS-Zonen + -Einträge
- Benutzer, Rollen + Zuweisungen, API-Keys
- Das Abrechnungskonto, das für all das bezahlt

Projekte lassen sich nicht zusammenführen. Um zwei Projekte zu konsolidieren, exportieren Sie die Ressourcen, importieren sie erneut und löschen das ursprüngliche Projekt — eine atomare Zusammenführung gibt es bewusst nicht, weil sich die daraus entstehende Zuordnung „was wurde wohin zusammengeführt“ nicht prüfen ließe.

## Löschen {#deletion}

`DELETE /v1/projects/{id}` ist **destruktiv und nicht umkehrbar**. Jede Ressource im Projekt wird gelöscht: VMs, Volumes, Snapshots, Backups, Buckets, Datenbanken, DNS-Zonen — alles. Die Benutzerdatensätze und Rollenzuweisungen werden atomar widerrufen.

Zur Sicherheit verlangt die API bei diesem Aufruf einen Bestätigungs-Header (`X-Confirm-Project-Delete: <project-id>`); ohne ihn wird der Request mit 400 beantwortet.

## Nächste Schritte {#next-steps}

- [Benutzer](/docs/api/users) — die Identitäten innerhalb eines Projekts.
- [Rollen](/docs/api/roles) — was Benutzer brauchen, um überhaupt etwas tun zu können.
- [Kontingente](/docs/api/quotas) — Ressourcenlimits pro Projekt.
