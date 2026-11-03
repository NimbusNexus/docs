---
title: "Vue d’ensemble du compte"
description: "Connexion et session — inscrivez-vous, connectez-vous et déconnectez-vous, réinitialisez ou changez un mot de passe, et changez de projet, d’espace de travail ou de région."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: account-overview
---

# Vue d’ensemble du compte

Ces endpoints gèrent votre connexion et la session qu’elle ouvre. L’inscription crée un [espace de travail](/docs/api/workspaces) qui porte le nom de votre adresse e-mail et dont vous êtes le premier utilisateur. La facturation relève de cet espace de travail ; voir [Facturation](/docs/api/invoices).

Chaque appel agit sur la connexion, la session ou le mot de passe de l’appelant lui-même :

- **Inscription** — `POST /api/v1/account/registration` envoie un token de vérification par e-mail. `POST /api/v1/account/reset_password` avec `type: register`, le `token` et un `new_password` (au moins 8 caractères, répété dans `confirm_password`) termine l’inscription.
- **Connexion et déconnexion** — `POST /api/v1/account/login` prend `email` et `password` et renvoie un `access_token` avec son `expires_at`. Un utilisateur créé au sein d’un espace de travail envoie aussi `domain`, le nom de l’espace de travail. `GET /api/v1/account/logout` met fin à la session.
- **Mots de passe** — `POST /api/v1/account/forgot_password_request` envoie par e-mail un token de réinitialisation à usage unique, et `POST /api/v1/account/reset_password` avec `type: reset` définit le nouveau mot de passe. `POST /api/v1/account/change_password` prend le `current_password` et le nouveau.
- **Portée et région** — `GET /api/v1/account/rescope` fait passer la session sur un `project` ou un `domain` (un espace de travail), et peut aussi changer sa `region`. `GET /api/v1/account/get_scope_choices` liste les espaces de travail, les projets et les régions vers lesquels vous pouvez basculer, `GET /api/v1/account/datacenters` liste les régions avec leur état de santé, et `GET /api/v1/account/un_scope` retire la portée.

## Étapes suivantes {#next-steps}

- [Espaces de travail](/docs/api/workspaces) — ce que crée l’inscription ; les projets y vivent.
- [Authentification](/docs/authentication) — comment fonctionnent les clés API.
- [Demandes de région](/docs/api/region-requests) — demander à NimbusNexus d’ouvrir une région qu’il ne dessert pas encore.
