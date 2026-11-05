---
title: "Utilisateurs"
description: "Les identités d’un espace de travail — attribuez des rôles, générez des clés API."
publishedAt: 2026-05-20
updatedAt: 2026-11-05
kind: reference
---

# Utilisateurs

Un utilisateur est une identité à l’intérieur d’un [espace de travail](/docs/api/workspaces). Les utilisateurs détiennent des rôles sur les [projets](/docs/api/projects) de l’espace de travail (qui accordent des permissions) et peuvent générer des clés API (chacune appartient à l’utilisateur et est propre à un seul projet).

## Utilisateur ≠ compte de connexion {#identity-model}

Dans cette API, un « utilisateur » est **la fiche d’identité**, pas la personne. Chaque utilisateur appartient à exactement un espace de travail, et son nom y est unique. Au sein de l’espace de travail, un même utilisateur peut détenir des rôles différents sur des projets différents :

- Un rôle sur `prod` (le projet de production)
- Un autre rôle sur `staging`
- Aucun rôle sur `dev`

Ce qu’un utilisateur peut faire dans un projet découle des rôles qu’il y détient, accordés directement ou via un [groupe](/docs/api/user-groups). C’est la frontière sur laquelle s’appuyer pour contenir le rayon d’impact : n’accordez des rôles sur `prod` qu’aux utilisateurs qui en ont besoin.

## Ce que vous pouvez faire sur un utilisateur {#actions}

- **Créer** — ajouter un utilisateur à l’espace de travail de l’appelant, avec un `name` et, en option, un `password`, une `description` et l’indicateur `enabled`.
- **Lire** — lire la fiche d’un utilisateur par son ID.
- **Modifier** — changer le nom, la description, l’indicateur d’activation ou le mot de passe.
- **Supprimer** — supprimer définitivement. Toutes les attributions de rôles et les clés API de l’utilisateur sont révoquées de façon atomique.

Les quatre exigent le rôle `admin` et une session dont la portée est l’espace de travail lui-même, et non l’un de ses projets. Une clé API est toujours propre à un seul projet : un appel avec une clé à l’une d’elles reçoit donc `400`.

Un mot de passe entre et ne ressort jamais : la fiche d’un utilisateur ne contient que `id`, `name`, `description` et `enabled`.

Il n’existe pas de « désactiver » distinct de « supprimer ». Si vous voulez une désactivation douce (conserver l’historique d’audit, empêcher la connexion), définissez `enabled: false` via une mise à jour — c’est la voie de la désactivation douce. La suppression est définitive et révoque tout.

## Ce que vous ne pouvez pas faire {#cant-do}

- **Déplacer un utilisateur vers un autre espace de travail.** Créez un nouvel utilisateur dans l’espace de travail cible, accordez-y les rôles voulus, supprimez l’ancien. Au sein d’un même espace de travail, il n’y a rien à déplacer : accordez à l’utilisateur un rôle sur l’autre projet.
- **Atteindre un utilisateur d’un autre espace de travail.** Lire, modifier et supprimer ne trouvent que les utilisateurs de l’espace de travail de l’appelant. Pour tout autre, l’API répond `404`.

## Étapes suivantes {#next-steps}

- [Espaces de travail](/docs/api/workspaces) — le conteneur dans lequel vivent les utilisateurs.
- [Rôles](/docs/api/roles) — ce qu’il faut accorder à un utilisateur une fois qu’il existe.
- [Authentification](/docs/authentication) — comment fonctionnent les clés API (émises par utilisateur).
