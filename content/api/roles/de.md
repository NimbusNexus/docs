---
title: "Rollen"
description: "Integrierte und benutzerdefinierte Rollen sowie die Endpoints für Rollenzuweisungen, die einem Benutzer eine Rolle in einem Projekt erteilen."
publishedAt: 2026-05-20
updatedAt: 2026-11-05
kind: reference
---

# Rollen

Eine Rolle ist ein Bündel von Berechtigungen. Eine **Rollenzuweisung** erteilt einem Benutzer oder einer [Gruppe](/docs/api/user-groups) eine Rolle in einem Projekt oder im Workspace selbst. Derselbe Benutzer kann in verschiedenen Projekten verschiedene Rollen haben; ein Benutzer ohne Rolle in einem Projekt kann es gar nicht sehen.

## Integrierte Rollen {#built-in}

`GET /api/v1/roles/` listet die globalen Rollen der Plattform auf, markiert mit `is_global: true`, und alle benutzerdefinierten Rollen, die Ihr Workspace angelegt hat; `GET /api/v1/roles/{role_id}` liest eine davon. Von den globalen Rollen können Sie `manager`, `member`, `reader` und `billing` erteilen. Die anderen, `admin` eingeschlossen, lassen sich nicht erteilen.

## Benutzerdefinierte Rollen {#custom}

`POST /api/v1/roles/` legt in Ihrem Workspace eine Rolle mit einem `name` und optional einer `description` an. `PATCH /api/v1/roles/{role_id}` ändert beides, und `DELETE /api/v1/roles/{role_id}` entfernt die Rolle. Nur die eigenen Rollen Ihres Workspaces lassen sich ändern oder löschen; für eine globale Rolle antworten beide mit `404`.

## Erteilen und widerrufen {#grant}

`POST /api/v1/roles/grant` nimmt eine Liste von Zuweisungen entgegen, sodass ein Aufruf mehrere erteilen kann. Jede Zuweisung nennt eine `role`, genau einen `user` oder eine `group` und genau ein Ziel: ein `project` oder, für den Workspace selbst, eine `domain`, jeweils per ID. Eine Zuweisung ohne Subjekt oder Ziel oder mit zweien erhält `422`. `POST /api/v1/roles/revoke` nimmt dieselbe Liste entgegen und entfernt diese Zuweisungen.

Erteilen und Widerrufen bleiben in Ihrem eigenen Workspace. Ein Ziel muss Ihr Workspace oder eines seiner Projekte sein (bei einem API-Key der Workspace, zu dem sein Projekt gehört), und die Rolle muss `manager`, `member`, `reader`, `billing` oder eine der eigenen Rollen Ihres Workspaces sein. Die API prüft jede Zuweisung, bevor sie eine vornimmt: Wird eine abgelehnt, antwortet der Aufruf mit `403`, und nichts aus der Liste wird angewendet.

`GET /api/v1/roles/assignments` listet die Zuweisungen des Workspaces auf, in seinen Projekten und im Workspace selbst, einschließlich derer, die über eine Gruppe kommen. Filtern Sie nach `role`, `user`, `group`, `project` oder `domain`.

Erteilen und Widerrufen akzeptieren auch den API-Key eines Admins. Die anderen Rollen-Aufrufe brauchen die Sitzung eines Admins, die für den Workspace selbst gilt: Ein API-Key gilt immer für ein einzelnes Projekt, deshalb antwortet die API auf den Aufruf eines Keys bei ihnen mit `400`.

## Wie sich Rollenzuweisungen kombinieren {#compose}

Ein Benutzer kann in einem Projekt mehrere Rollenzuweisungen haben. Die effektiven Berechtigungen sind die **Vereinigungsmenge** — die Rollenliste ist additiv, nicht multiplikativ. Eine Rolle, die dem Benutzer direkt erteilt wurde, und eine, die einer seiner Gruppen erteilt wurde, gelten beide.

Wenn Sie eine Rolle widerrufen, bleiben die anderen bestehen. Um einem Benutzer alle Rechte zu entziehen, widerrufen Sie jede Zuweisung einzeln oder löschen Sie den Benutzer (das widerruft alle Zuweisungen atomar).

## Nächste Schritte {#next-steps}

- [Benutzer](/docs/api/users) — wem Sie Rollen erteilen.
- [Projekte](/docs/api/projects) — worauf sich die erteilten Rollen beziehen.
- [Authentifizierung](/docs/authentication) — wie API-Keys den Rollen von Benutzern zugeordnet sind.
