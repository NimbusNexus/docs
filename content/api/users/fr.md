---
title: "Utilisateurs"
description: "Les identités d’un espace de travail — attribuez des rôles, générez des clés API, utilisez des délégations."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Utilisateurs

Un utilisateur est une identité à l’intérieur d’un [espace de travail](/docs/api/workspaces). Les utilisateurs détiennent des rôles sur les [projets](/docs/api/projects) de l’espace de travail (qui accordent des permissions), peuvent générer des clés API (chacune appartient à l’utilisateur et est propre à un seul projet) et peuvent utiliser des délégations pour agir au nom d’autres projets.

## Utilisateur ≠ compte de connexion {#identity-model}

Dans cette API, un « utilisateur » est **la fiche d’identité**, pas la personne. Chaque utilisateur appartient à exactement un espace de travail, et son nom y est unique. Au sein de l’espace de travail, un même utilisateur peut détenir des rôles différents sur des projets différents :

- Un rôle sur `prod` (le projet de production)
- Un autre rôle sur `staging`
- Aucun rôle sur `dev`

Ce qu’un utilisateur peut faire dans un projet découle des rôles qu’il y détient, accordés directement ou via un [groupe](/docs/api/user-groups). C’est la frontière sur laquelle s’appuyer pour contenir le rayon d’impact : n’accordez des rôles sur `prod` qu’aux utilisateurs qui en ont besoin.

## Ce que vous pouvez faire sur un utilisateur {#actions}

- **Lire** — lire la fiche d’un utilisateur par son ID.
- **Modifier** — changer le nom, la description, l’indicateur d’activation ou le mot de passe.
- **Supprimer** — supprimer définitivement. Toutes les attributions de rôles et les clés API de l’utilisateur sont révoquées de façon atomique.

Les trois exigent le rôle `admin`. Modifier et supprimer acceptent aussi la clé API d’un administrateur. Lire exige une session dont la portée est l’espace de travail lui-même, et non l’un de ses projets. Une clé API est toujours propre à un seul projet : une lecture avec une clé reçoit donc `400`.

Les personnes rejoignent et quittent un espace de travail dans **Members**, dans votre [console de compte]({{ACCOUNT_BASE_URL}}/members) : invitez-les là, et retirez-les là. Cette API lit et modifie leurs fiches d’utilisateur.

Modifier accepte toujours un `password`, mais ni la console ni les apps ne le demandent jamais : elles connectent les personnes avec leur compte NimbusNexus. Un mot de passe ne ressort jamais : la fiche d’un utilisateur ne contient que `id`, `name`, `description` et `enabled`.

Il n’existe pas de « désactiver » distinct de « supprimer ». Si vous voulez une désactivation douce (conserver l’historique d’audit, empêcher la connexion), définissez `enabled: false` via une mise à jour — c’est la voie de la désactivation douce. La suppression est définitive et révoque tout.

## Ce que vous ne pouvez pas faire {#cant-do}

- **Créer un utilisateur.** `POST /api/v1/users` répond `403 Forbidden`. Un utilisateur créé via l’API n’aurait aucun compte NimbusNexus pour se connecter : invitez plutôt les personnes dans votre console de compte.
- **Déplacer un utilisateur vers un autre espace de travail.** Invitez la personne dans l’autre espace de travail depuis **Members**, dans votre console de compte, et accordez-lui là-bas les rôles dont elle a besoin. Au sein d’un même espace de travail, il n’y a rien à déplacer : accordez à l’utilisateur un rôle sur l’autre projet.
- **Lire un utilisateur d’un autre espace de travail.** Lire ne trouve que les utilisateurs de l’espace de travail de l’appelant. Pour tout autre, l’API répond `404`.

## Étapes suivantes {#next-steps}

- [Espaces de travail](/docs/api/workspaces) — le conteneur dans lequel vivent les utilisateurs.
- [Rôles](/docs/api/roles) — ce qu’il faut accorder à un utilisateur une fois qu’il existe.
- [Authentification](/docs/authentication) — comment fonctionnent les clés API (émises par utilisateur).
