---
title: "Workspaces"
description: "Die Isolationsebene über Projekten. Ein Workspace enthält Projekte, Projekte enthalten Ressourcen."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: workspaces
---

# Workspaces

Ein **Workspace** ist die oberste Isolationsebene im Kontomodell von NimbusNexus. Jedes Projekt gehört zu genau einem Workspace; der Zugriff jedes Benutzers ist auf Workspaces beschränkt (und auf bestimmte Projekte darin). Die Hierarchie lautet **Workspace → Projekt → Ressource**.

Für die meisten Konten reicht ein einziger Workspace. Größere Organisationen nutzen mehrere Workspaces, um Abrechnung, Zugriff und Ressourcenlimits auf Ebene von Organisationseinheiten zu trennen — z. B. ein Workspace pro Geschäftsbereich oder einer pro juristischer Person. Abgerechnet wird pro Workspace, und Zugriff überschreitet die Grenze eines Workspaces nur, wenn Sie sie öffnen: Sie laden jemanden ein, oder Sie teilen ein Netzwerk oder eine DNS-Zone mit einem anderen Projekt.

Verwechseln Sie einen Workspace nicht mit einer DNS-Zone — in manchen Kontexten wird dasselbe Wort verwendet (OpenStack nennt Workspaces „Domains“). Die API behält das Wort von OpenStack bei: Die Endpoints für Workspaces liegen unter `/api/v1/domains/`, und auch ihre Felder sprechen von Domain (`domain_id`, `domain_name`, `domain_description`).

## Nächste Schritte {#next-steps}

- [Projekte](/docs/api/projects) — die nächste Ebene darunter; was Workspaces enthalten.
- [Benutzer](/docs/api/users) und [Rollen](/docs/api/roles) — IAM-Berechtigungen gelten innerhalb eines Workspaces.
- [Projektübergreifende Trusts](/docs/api/cross-project-trusts) — kurzlebige Delegierungen, mit denen NimbusNexus in einem Projekt Arbeit für Sie abschließt.
