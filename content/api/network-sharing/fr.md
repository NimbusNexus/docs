---
title: "Partage de réseau"
description: "Partagez un réseau, un sous-réseau ou un port entre les projets d’un même espace de travail."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: network-sharing
---

# Partage de réseau

Les réseaux sont normalement isolés par projet — un réseau du projet `acme-prod` est invisible depuis `acme-staging`. Le partage de réseau ouvre une brèche contrôlée dans cette isolation : le projet propriétaire partage un réseau précis avec un autre projet précis (dans le même espace de travail), et le projet destinataire peut attacher des VM au réseau partagé comme s’il s’agissait du sien.

Cas d’usage : un réseau de services partagés (bases de données, caches, API internes) que plusieurs projets applicatifs doivent atteindre. L’alternative consiste à exposer les services sur des IP publiques et à les sécuriser de nouveau en L7 — c’est possible, mais plus complexe que de partager le segment L2 à l’intérieur de la frontière de confiance d’un espace de travail.

Le partage entre espaces de travail est impossible — c’est une frontière d’isolation délibérée.

## Étapes suivantes {#next-steps}

- [Réseaux](/docs/api/networks) — la ressource qui est partagée.
- [Espaces de travail](/docs/api/workspaces) — la limite du partage.
- [Groupes de sécurité](/docs/api/security-groups) — ce qui filtre le trafic sur un réseau partagé.
