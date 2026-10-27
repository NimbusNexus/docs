---
title: "Utilisateurs"
description: "Les identités d’un projet — attribuez des rôles, générez des clés API, utilisez des délégations."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Utilisateurs

Un utilisateur est une identité à l’intérieur d’un [projet](/docs/api/projects). Les utilisateurs détiennent des rôles (qui accordent des permissions), peuvent générer des clés API (dont la portée est l’utilisateur) et peuvent utiliser des délégations pour agir au nom d’autres projets.

## Utilisateur ≠ compte de connexion {#identity-model}

Dans cette API, un « utilisateur » est **la fiche d’identité**, pas la personne. Une même personne peut être :

- Un utilisateur dans `prod` (le projet de production)
- Un autre utilisateur dans `staging` (fiche d’identité distincte, même e-mail)
- Un troisième utilisateur dans `dev`

Chaque utilisateur est entièrement isolé des autres — il a ses propres attributions de rôles, ses propres clés API, sa propre piste d’audit. C’est la frontière d’isolation des projets sur laquelle nous nous appuyons pour contenir le rayon d’impact : un utilisateur `dev` compromis ne peut pas toucher aux ressources de production, parce qu’il n’y existe littéralement pas en tant qu’identité.

Pour les organisations qui veulent une personne → une identité sur tous les projets, fédérez via SAML/OIDC ; l’identité fournie par le SSO devient le même utilisateur dans tous les projets associés par les règles de l’IdP. C’est une fonctionnalité du niveau Enterprise ; les comptes du niveau par défaut utilisent le modèle par projet décrit ci-dessus.

## Ce que vous pouvez faire sur un utilisateur {#actions}

- **Créer** — provisionner un nouvel utilisateur dans le projet de l’appelant. Nécessite `iam:write` sur le projet.
- **Lire** — lire la fiche d’un utilisateur. `iam:read` suffit.
- **Modifier** — changer le nom, la description, l’indicateur d’activation. Certains champs (par exemple l’e-mail) sont immuables après la création ; l’API renvoie 400 si vous essayez.
- **Supprimer** — supprimer définitivement. Toutes les attributions de rôles et les clés API de l’utilisateur sont révoquées de façon atomique.

Il n’existe pas de « désactiver » distinct de « supprimer ». Si vous voulez une désactivation douce (conserver l’historique d’audit, empêcher la connexion), définissez `enabled: false` via une mise à jour — c’est la voie de la désactivation douce. La suppression est définitive et révoque tout.

## Ce que vous ne pouvez pas faire {#cant-do}

- **Déplacer un utilisateur d’un projet à un autre.** Créez un nouvel utilisateur dans le projet cible, copiez les attributions de rôles voulues, supprimez l’ancien.
- **Définir un mot de passe via l’API.** Les mots de passe passent uniquement par le processus de réinitialisation ; l’API n’accepte jamais un mot de passe en clair en entrée. Les utilisateurs SSO se passent entièrement de mot de passe.
- **Lister les utilisateurs d’un projet sur lequel vous n’avez aucune attribution de rôle.** L’isolation des projets est stricte — aucune énumération inter-projets.

## Étapes suivantes {#next-steps}

- [Projets](/docs/api/projects) — le conteneur dans lequel vivent les utilisateurs.
- [Rôles](/docs/api/roles) — ce qu’il faut accorder à un utilisateur une fois qu’il existe.
- [Authentification](/docs/authentication) — comment fonctionnent les clés API (émises par utilisateur).
