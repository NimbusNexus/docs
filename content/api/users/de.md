---
title: "Benutzer"
description: "Identitätsdatensätze in einem Workspace — Rollen zuweisen, API-Keys generieren, Trusts übernehmen."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Benutzer

Ein Benutzer ist eine Identität in einem [Workspace](/docs/api/workspaces). Benutzer haben Rollen in den [Projekten](/docs/api/projects) des Workspaces (die Berechtigungen erteilen), können API-Keys generieren (jeder gehört dem Benutzer und gilt für ein einzelnes Projekt) und Trusts übernehmen, um im Namen anderer Projekte zu handeln.

## Benutzer ≠ Login {#identity-model}

Ein „Benutzer“ ist in dieser API **der Identitätsdatensatz**, nicht der Mensch. Jeder Benutzer gehört zu genau einem Workspace, und sein Name ist dort eindeutig. Innerhalb des Workspaces kann derselbe Benutzer in verschiedenen Projekten verschiedene Rollen haben:

- Eine Rolle in `prod` (dem Produktionsprojekt)
- Eine andere Rolle in `staging`
- Gar keine Rolle in `dev`

Was ein Benutzer in einem Projekt tun kann, ergibt sich aus den Rollen, die er dort hat, direkt erteilt oder über eine [Gruppe](/docs/api/user-groups). Auf diese Grenze stützen Sie sich, um den Schadensradius einzudämmen: Erteilen Sie Rollen in `prod` nur den Benutzern, die sie brauchen.

## Was Sie mit einem Benutzer tun können {#actions}

- **Abrufen** — einen Benutzerdatensatz per ID lesen.
- **Aktualisieren** — Name, Beschreibung, Aktivierungs-Flag oder Passwort ändern.
- **Löschen** — dauerhaft entfernen. Alle Rollenzuweisungen und API-Keys des Benutzers werden atomar widerrufen.

Alle drei erfordern die Rolle `admin`. Aktualisieren und Löschen akzeptieren auch den API-Key eines Admins. Abrufen braucht eine Sitzung, die für den Workspace selbst gilt, nicht für eines seiner Projekte. Ein API-Key gilt immer für ein einzelnes Projekt, deshalb antwortet die API beim Abrufen mit einem Key mit `400`.

Menschen kommen über **Members** in Ihrer [Kontokonsole]({{ACCOUNT_BASE_URL}}/members) in einen Workspace und verlassen ihn auch dort: Laden Sie sie dort ein und entfernen Sie sie dort. Diese API liest und aktualisiert ihre Benutzerdatensätze.

Aktualisieren nimmt weiterhin ein `password` an, aber das Dashboard und die Apps fragen nie danach, denn beide melden Menschen mit ihrem NimbusNexus-Konto an. Ein Passwort kommt nie wieder heraus: Ein Benutzerdatensatz enthält nur `id`, `name`, `description` und `enabled`.

Es gibt kein „Deaktivieren“ getrennt vom „Löschen“. Wenn Sie einen Benutzer nur weich deaktivieren wollen (Audit-Verlauf behalten, Anmeldung verhindern), setzen Sie per Aktualisierung `enabled: false` — das ist der Weg zum weichen Deaktivieren. Löschen bedeutet endgültiges Löschen + Widerruf von allem.

## Was Sie nicht tun können {#cant-do}

- **Einen Benutzer erstellen.** `POST /api/v1/users` antwortet mit `403 Forbidden`. Ein über die API erstellter Benutzer hätte kein NimbusNexus-Konto, mit dem er sich anmelden könnte, deshalb laden Sie Menschen stattdessen in der Kontokonsole ein.
- **Einen Benutzer in einen anderen Workspace verschieben.** Laden Sie die Person unter **Members** in der Kontokonsole in den anderen Workspace ein und erteilen Sie ihr dort die Rollen, die sie braucht. Innerhalb eines Workspaces gibt es nichts zu verschieben: Erteilen Sie dem Benutzer eine Rolle im anderen Projekt.
- **Einen Benutzer aus einem anderen Workspace abrufen.** Abrufen findet nur Benutzer im Workspace des Aufrufers. Für alle anderen antwortet die API mit `404`.

## Nächste Schritte {#next-steps}

- [Workspaces](/docs/api/workspaces) — der Container, in dem Benutzer liegen.
- [Rollen](/docs/api/roles) — was Sie einem Benutzer erteilen, sobald er existiert.
- [Authentifizierung](/docs/authentication) — wie API-Keys (pro Benutzer ausgestellt) funktionieren.
