---
title: "Kontoübersicht"
description: "Anmeldung und Sitzung — registrieren, an- und abmelden, ein Passwort zurücksetzen oder ändern und Projekt, Workspace oder Region wechseln."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: account-overview
---

# Kontoübersicht

Diese Endpoints verwalten Ihre Anmeldung und die Sitzung, die sie eröffnet. Die Registrierung legt einen [Workspace](/docs/api/workspaces) an, der nach Ihrer E-Mail-Adresse benannt ist, mit Ihnen als erstem Benutzer. Die Abrechnung gehört zu diesem Workspace; siehe [Abrechnung](/docs/api/invoices).

Jeder Aufruf wirkt auf die eigene Anmeldung, Sitzung oder das eigene Passwort des Aufrufers:

- **Registrieren** — `POST /api/v1/account/registration` sendet ein Verifizierungstoken per E-Mail. `POST /api/v1/account/reset_password` mit `type: register`, dem `token` und einem `new_password` (mindestens 8 Zeichen, in `confirm_password` wiederholt) schließt die Registrierung ab.
- **An- und abmelden** — `POST /api/v1/account/login` nimmt `email` und `password` entgegen und gibt ein `access_token` mit seinem `expires_at` zurück. Ein Benutzer, der innerhalb eines Workspaces angelegt wurde, sendet außerdem `domain`, den Namen des Workspaces. `GET /api/v1/account/logout` beendet die Sitzung.
- **Passwörter** — `POST /api/v1/account/forgot_password_request` sendet ein einmaliges Reset-Token per E-Mail, und `POST /api/v1/account/reset_password` mit `type: reset` setzt das neue Passwort. `POST /api/v1/account/change_password` nimmt das `current_password` und das neue Passwort entgegen.
- **Scope und Region** — `GET /api/v1/account/rescope` wechselt die Sitzung zu einem `project` oder einer `domain` (einem Workspace) und kann auch ihre `region` wechseln. `GET /api/v1/account/get_scope_choices` listet die Workspaces, Projekte und Regionen auf, zu denen Sie wechseln können, `GET /api/v1/account/datacenters` listet die Regionen mit ihrem Zustand auf, und `GET /api/v1/account/un_scope` hebt den Scope auf.

## Nächste Schritte {#next-steps}

- [Workspaces](/docs/api/workspaces) — was die Registrierung anlegt; darin liegen die Projekte.
- [Authentifizierung](/docs/authentication) — wie API-Keys funktionieren.
- [Regionsanfragen](/docs/api/region-requests) — NimbusNexus bitten, eine Region zu eröffnen, die es noch nicht bedient.
