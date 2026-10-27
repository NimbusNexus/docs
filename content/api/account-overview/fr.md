---
title: "Vue d’ensemble du compte"
description: "Les métadonnées du compte — propriétaire, contact de facturation, accès aux régions, niveau de plan."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: account-overview
---

# Vue d’ensemble du compte

Un « compte » se situe au-dessus de chaque espace de travail, projet et ressource que vous possédez chez NimbusNexus. Il porte le contact de facturation, le nom de l’entité juridique qui figure sur les factures, le niveau de plan (Free / Starter / Production / Enterprise), les régions où votre compte est autorisé et les préférences valables pour tout le compte. Il y a exactement un compte par inscription.

La plupart de ces endpoints sont en lecture seule pour les non-propriétaires et en lecture-écriture pour les propriétaires. Le travail quotidien se fait au niveau du projet ; les appels au niveau du compte servent en général à des opérations menées une fois par trimestre (changer le contact de facturation, demander une nouvelle région, passer à un niveau de plan supérieur).

## Étapes suivantes {#next-steps}

- [Espaces de travail](/docs/api/workspaces) — le niveau juste en dessous, à l’intérieur du compte.
- [Demandes de région](/docs/api/region-requests) — demander l’accès à une région à laquelle vous n’avez pas encore accès.
