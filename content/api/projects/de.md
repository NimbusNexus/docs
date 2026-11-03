---
title: "Projekte"
description: "Die Isolationseinheit für Ressourcen und Zugriffskontrolle, innerhalb eines Workspaces."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Projekte

Ein Projekt ist die **Isolationseinheit** bei NimbusNexus — für Ressourcen und Zugriffskontrolle. Jedes Projekt gehört zu einem [Workspace](/docs/api/workspaces). Jede Ressource (VM, Volume, Bucket, Netzwerk, …) gehört zu genau einem Projekt, und jeder API-Key ist auf genau ein Projekt beschränkt. Abgerechnet wird pro Workspace: Eine Rechnung deckt alle seine Projekte ab.

## Warum Projekte wichtig sind {#why}

Zwei Garantien, die Ihnen die Projektgrenze gibt:

1. **Schadensradius.** Ein kompromittierter API-Key für das Projekt `dev` kann keine Ressourcen in `prod` anfassen. Sie sind aus `dev` heraus buchstäblich nicht sichtbar.
2. **Kontingent.** Kontingente gelten pro Projekt. Ein Projekt, das außer Kontrolle gerät und VMs am laufenden Band erstellt, verbraucht nicht den Spielraum eines anderen Projekts.

## Ein Projekt erstellen {#create}

`POST /api/v1/projects/` nimmt die ID des Workspaces als `domain_id`, einen `project_name` und optional eine `project_description` und `enabled` entgegen. Der Name muss im Workspace eindeutig sein, sonst antwortet die API mit `409`. Ein Workspace kann ein Limit für die Zahl seiner Projekte haben; darüber hinaus antwortet das Erstellen mit `403`.

Projekte stehen in ihrem Workspace nebeneinander. Die API kann kein Projekt unter einem anderen anlegen.

## Was in einem Projekt liegt {#contents}

- VMs, Volumes, Backups
- Buckets
- Netzwerke, Subnetze, Router, Sicherheitsgruppen, Floating-IPs, Load Balancer
- DNS-Zonen + -Einträge
- Rollenzuweisungen und API-Keys (die Benutzer, denen sie gehören, liegen im Workspace)

Projekte lassen sich nicht zusammenführen. Um zwei Projekte zu konsolidieren, exportieren Sie die Ressourcen, importieren sie erneut und löschen das ursprüngliche Projekt — eine atomare Zusammenführung gibt es bewusst nicht, weil sich die daraus entstehende Zuordnung „was wurde wohin zusammengeführt“ nicht prüfen ließe.

## Löschen {#deletion}

`DELETE /api/v1/projects/` nimmt die `id` des Projekts im Request-Body entgegen und ist **nicht umkehrbar**. Es entfernt das Standardnetzwerk des Projekts und löscht dann das Projekt und seine Rollenzuweisungen. Sonst löscht es nichts, deshalb löschen Sie zuerst die VMs, Volumes, Buckets und anderen Ressourcen des Projekts.

## Nächste Schritte {#next-steps}

- [Workspaces](/docs/api/workspaces) — der Container, in dem Projekte liegen.
- [Rollen](/docs/api/roles) — was Benutzer brauchen, um überhaupt etwas tun zu können.
- [Kontingente](/docs/api/quotas) — Ressourcenlimits pro Projekt.
