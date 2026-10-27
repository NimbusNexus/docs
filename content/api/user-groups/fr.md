---
title: "Groupes d’utilisateurs"
description: "Des groupes d’utilisateurs pour attribuer des rôles en commun. Utile quand les équipes deviennent trop grandes pour des attributions individuelles."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: user-groups
---

# Groupes d’utilisateurs

Un groupe d’utilisateurs est un ensemble nommé d’utilisateurs à qui vous pouvez accorder des rôles collectivement. Au lieu d’accorder `vms:read` à quinze ingénieurs un par un, vous l’accordez au groupe `backend-team` et vous ajoutez les nouveaux ingénieurs au groupe.

La portée d’un groupe est un espace de travail. Un utilisateur peut appartenir à plusieurs groupes ; un groupe peut détenir des rôles dans plusieurs projets de son espace de travail. Les attributions de rôles sont additives — un utilisateur obtient l’union de tous les rôles qui lui sont accordés directement et de tous les rôles accordés aux groupes dont il fait partie.

Pour les petites équipes (moins de ~10 personnes), les attributions par utilisateur suffisent généralement. Les groupes deviennent la bonne réponse quelque part entre 10 et 50 utilisateurs, quand « auditer qui a accès au projet X » doit pouvoir se faire en quelques secondes, et non en vérifiant 30 entrées IAM à la main.

## Étapes suivantes {#next-steps}

- [Utilisateurs](/docs/api/users) — ce que contiennent les groupes.
- [Rôles](/docs/api/roles) — ce qui est accordé à un groupe.
- [Espaces de travail](/docs/api/workspaces) — la portée des groupes.
