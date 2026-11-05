---
title: "Rôles"
description: "Rôles intégrés et personnalisés, et les endpoints d’attribution qui donnent à un utilisateur un rôle sur un projet."
publishedAt: 2026-05-20
updatedAt: 2026-11-05
kind: reference
---

# Rôles

Un rôle est un ensemble de permissions. **L’attribution de rôle** consiste à accorder un rôle à un utilisateur ou à un [groupe](/docs/api/user-groups) sur un projet, ou sur l’espace de travail lui-même. Un même utilisateur peut détenir des rôles différents sur des projets différents ; un utilisateur sans rôle sur un projet ne peut pas le voir du tout.

## Rôles intégrés {#built-in}

`GET /api/v1/roles/` liste les rôles globaux de la plateforme, marqués `is_global: true`, et les rôles personnalisés créés par votre espace de travail ; `GET /api/v1/roles/{role_id}` en lit un. Parmi les rôles globaux, vous pouvez accorder `manager`, `member`, `reader` et `billing`. Les autres, `admin` compris, ne peuvent pas être accordés.

## Rôles personnalisés {#custom}

`POST /api/v1/roles/` crée un rôle dans votre espace de travail, avec un `name` et une `description` facultative. `PATCH /api/v1/roles/{role_id}` modifie l’un ou l’autre, et `DELETE /api/v1/roles/{role_id}` supprime le rôle. Seuls les rôles propres à votre espace de travail peuvent être modifiés ou supprimés ; pour un rôle global, les deux appels répondent `404`.

## Accorder et révoquer {#grant}

`POST /api/v1/roles/grant` prend une liste d’attributions, si bien qu’un seul appel peut en accorder plusieurs. Chaque attribution indique un `role`, exactement un `user` ou un `group`, et exactement une cible : un `project` ou, pour l’espace de travail lui-même, un `domain`, le tout par ID. Une attribution sans sujet ou sans cible, ou avec deux, reçoit `422`. `POST /api/v1/roles/revoke` prend la même liste et retire ces attributions.

Les attributions et les révocations restent dans votre propre espace de travail. La cible doit être votre espace de travail ou l’un de ses projets (pour une clé API, l’espace de travail auquel appartient son projet), et le rôle doit être `manager`, `member`, `reader`, `billing` ou l’un des rôles propres à votre espace de travail. L’API vérifie chaque attribution avant d’en faire une seule : si l’une est refusée, l’appel reçoit `403` et rien de la liste n’est appliqué.

`GET /api/v1/roles/assignments` liste les attributions de l’espace de travail, sur ses projets et sur l’espace de travail lui-même, y compris celles qui passent par un groupe. Filtrez-la par `role`, `user`, `group`, `project` ou `domain`.

Accorder et révoquer acceptent aussi la clé API d’un administrateur. Les autres appels sur les rôles exigent une session d’administrateur dont la portée est l’espace de travail lui-même : une clé API est toujours propre à un seul projet, un appel avec une clé reçoit donc `400`.

## Comment se combinent les attributions de rôles {#compose}

Un utilisateur peut détenir plusieurs attributions de rôles sur un même projet. L’ensemble de permissions effectif est l’**union** — la liste des rôles est additive, pas multiplicative. Un rôle accordé directement à l’utilisateur et un autre accordé à l’un de ses groupes s’appliquent tous les deux.

Révoquer un rôle ne révoque pas les autres. Pour retirer complètement les droits d’un utilisateur, révoquez chaque attribution une par une, ou supprimez l’utilisateur (ce qui révoque toutes les attributions de façon atomique).

## Étapes suivantes {#next-steps}

- [Utilisateurs](/docs/api/users) — à qui vous accordez des rôles.
- [Projets](/docs/api/projects) — sur quoi vous accordez des rôles.
- [Authentification](/docs/authentication) — comment les clés API correspondent aux rôles des utilisateurs.
