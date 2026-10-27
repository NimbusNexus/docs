---
title: "Benutzergruppen"
description: "Gruppen von Benutzern für gemeinsame Rollenzuweisungen. Nützlich, wenn Teams über Berechtigungen pro Benutzer hinauswachsen."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: user-groups
---

# Benutzergruppen

Eine Benutzergruppe ist eine benannte Sammlung von Benutzern, denen gemeinsam Rollen erteilt werden können. Statt fünfzehn Entwicklern einzeln `vms:read` zu erteilen, erteilen Sie es der Gruppe `backend-team` und fügen neue Entwickler der Gruppe hinzu.

Gruppen gehören zu einem Workspace. Ein Benutzer kann mehreren Gruppen angehören; eine Gruppe kann Rollen in mehreren Projekten ihres Workspaces haben. Rollenzuweisungen sind additiv — ein Benutzer erhält die Vereinigungsmenge aller Rollen, die ihm direkt erteilt wurden, plus aller Rollen, die einer Gruppe erteilt wurden, der er angehört.

Für kleine Teams (unter ~10 Personen) reichen Berechtigungen pro Benutzer meist aus. Gruppen werden irgendwo zwischen 10 und 50 Benutzern zur richtigen Lösung, wenn sich „prüfen, wer Zugriff auf Projekt X hat“ in Sekunden beantworten lassen muss und nicht durch manuelles Durchsehen von 30 IAM-Einträgen.

## Nächste Schritte {#next-steps}

- [Benutzer](/docs/api/users) — woraus Gruppen bestehen.
- [Rollen](/docs/api/roles) — was einer Gruppe erteilt wird.
- [Workspaces](/docs/api/workspaces) — der Bereich, zu dem Gruppen gehören.
