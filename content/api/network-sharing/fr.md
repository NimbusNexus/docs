---
title: "Partage de réseau"
description: "Partagez un réseau, une politique QoS, un groupe de sécurité, un pool de sous-réseaux, une portée d’adresses ou un groupe d’adresses avec un autre projet sur lequel vous détenez un rôle."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: network-sharing
---

# Partage de réseau

Les réseaux sont normalement isolés par projet — un réseau du projet `acme-prod` est invisible depuis `acme-staging`. Le partage de réseau ouvre une brèche contrôlée dans cette isolation : vous partagez un objet qui appartient à votre projet avec un autre projet sur lequel vous détenez un rôle, et le projet destinataire peut l’utiliser comme s’il s’agissait du sien — par exemple pour attacher des VM à un réseau partagé.

`POST /api/v1/rbac_policy/` effectue le partage. Il prend l’`object_type` (`network`, `qos_policy`, `security_group`, `subnetpool`, `address_scope` ou `address_group`), l’`object_id` de l’objet, une `action` comme `access_as_shared`, et le projet destinataire dans `target_tenant`.

Cas d’usage : un réseau de services partagés (bases de données, caches, API internes) que plusieurs projets applicatifs doivent atteindre. L’alternative consiste à exposer les services sur des IP publiques et à les sécuriser de nouveau en L7 — c’est possible, mais plus complexe que de partager le segment L2 à l’intérieur de la frontière de confiance d’un espace de travail.

## Étapes suivantes {#next-steps}

- [Réseaux](/docs/api/networks) — la ressource qui est partagée.
- [Projets](/docs/api/projects) — les propriétaires et les destinataires des objets partagés.
- [Groupes de sécurité](/docs/api/security-groups) — ce qui filtre le trafic sur un réseau partagé.
