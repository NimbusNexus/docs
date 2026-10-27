---
title: "Workspaces"
description: "Die Isolationsebene über Projekten. Ein Workspace enthält Projekte, Projekte enthalten Ressourcen."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: workspaces
---

# Workspaces

Ein **Workspace** ist die oberste Isolationsebene im Kontomodell von NimbusNexus. Jedes Projekt gehört zu genau einem Workspace; der Zugriff jedes Benutzers ist auf Workspaces beschränkt (und auf bestimmte Projekte darin). Die Hierarchie lautet **Workspace → Projekt → Ressource**.

Für die meisten Konten reicht ein einziger Workspace. Größere Organisationen nutzen mehrere Workspaces, um Abrechnung, Zugriff und Ressourcenlimits auf Ebene von Organisationseinheiten zu trennen — z. B. ein Workspace pro Geschäftsbereich oder einer pro juristischer Person. Traffic, IAM und Abrechnung über Workspace-Grenzen hinweg sind bewusst vollständig isoliert.

Verwechseln Sie einen Workspace nicht mit einer DNS-Zone — in manchen Kontexten wird dasselbe Wort verwendet (OpenStack nennt Workspaces „Domains“), aber in der Produktoberfläche heißt es überall, wo Nutzer es sehen, „Workspace“.

## Nächste Schritte {#next-steps}

- [Projekte](/docs/api/projects) — die nächste Ebene darunter; was Workspaces enthalten.
- [Benutzer](/docs/api/users) und [Rollen](/docs/api/roles) — IAM-Berechtigungen gelten innerhalb eines Workspaces.
- [Projektübergreifende Trusts](/docs/api/cross-project-trusts) — zeitlich begrenzte Berechtigungen über Projektgrenzen hinweg innerhalb eines Workspaces.
