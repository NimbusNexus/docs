---
title: "Groupes d’adresses"
description: "Ensembles nommés de CIDR, réutilisables dans les règles des groupes de sécurité."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: address-groups
---

# Groupes d’adresses

Un groupe d’adresses est un ensemble nommé et modifiable de blocs CIDR que vous pouvez référencer depuis les règles des [groupes de sécurité](/docs/api/security-groups). Au lieu de coller la même liste d’autorisation dans dix groupes de sécurité, vous créez un seul groupe d’adresses (`office-cidrs`) et vous le référencez depuis chaque règle. Ajoutez ou retirez un CIDR du groupe ; chaque règle qui le référence est mise à jour immédiatement.

Le cas d’usage type : des CIDR de VPN d’entreprise qui changent avec le temps. Maintenir la liste en dur dans chaque groupe de sécurité oblige à traquer chaque occurrence quand un CIDR change ; la maintenir dans un seul groupe d’adresses permet de la mettre à jour à un seul endroit.

## Étapes suivantes {#next-steps}

- [Groupes de sécurité](/docs/api/security-groups) — là où les groupes d’adresses sont référencés.
- [Réseaux](/docs/api/networks) et [Sous-réseaux](/docs/api/subnets) — la couche réseau dans laquelle s’appliquent les groupes d’adresses.
