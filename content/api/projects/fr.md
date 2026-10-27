---
title: "Projets"
description: "L’unité d’isolation des ressources, de la facturation et du contrôle d’accès."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Projets

Un projet est l’**unité d’isolation** de NimbusNexus — pour les ressources, la facturation et le contrôle d’accès. Chaque ressource (VM, volume, bucket, base de données, réseau, …) appartient à exactement un projet ; chaque clé API a pour portée exactement un projet ; chaque ligne de facture concerne exactement un projet.

## Pourquoi les projets comptent {#why}

Trois garanties qu’apporte la frontière de projet :

1. **Rayon d’impact.** Une clé API compromise du projet `dev` ne peut pas toucher aux ressources de `prod`. Elles ne sont littéralement pas visibles depuis `dev`.
2. **Attribution des coûts.** Chaque projet a sa propre facture. Si la finance veut refacturer au marketing l’hébergement du site web, le marketing obtient son propre projet. Si l’ingénierie veut répartir les dépenses par équipe, chaque équipe obtient son propre projet.
3. **Quota.** Les quotas sont par projet. Un projet qui s’emballe en créant des VM n’entame pas la marge d’un autre projet.

## Hiérarchie des projets {#hierarchy}

Les projets peuvent avoir un projet parent (à partir du niveau organisation). La hiérarchie ressemble à ceci :

```text
acme-org (root)
├── acme-prod
├── acme-staging
└── acme-dev
```

Un utilisateur qui a le rôle `admin` sur `acme-org` hérite automatiquement des droits admin sur chaque enfant. Un utilisateur admin uniquement sur `acme-prod` ne voit ni `acme-staging` ni `acme-dev`. C’est le mécanisme standard pour une « gouvernance centralisée, un quotidien décentralisé ».

La hiérarchie est facultative. Les comptes du niveau par défaut ont un seul projet racine par compte ; les comptes de niveau organisation peuvent construire des arborescences jusqu’à 5 niveaux de profondeur.

## Ce que contient un projet {#contents}

- VM, volumes, snapshots, sauvegardes
- Buckets, archives
- Bases de données
- Réseaux, sous-réseaux, routeurs, groupes de sécurité, IP flottantes, load balancers
- Zones DNS + enregistrements
- Utilisateurs, rôles + attributions, clés API
- Le compte de facturation qui paie tout ce qui précède

Les projets ne peuvent pas être fusionnés. Pour regrouper deux projets, il faut exporter puis réimporter les ressources et supprimer l’original — il n’existe délibérément aucune opération de fusion atomique, car l’attribution qui en résulterait (« qu’est-ce qui a été fusionné où ») serait impossible à auditer.

## Suppression {#deletion}

`DELETE /v1/projects/{id}` est **destructif et irréversible**. Chaque ressource du projet est détruite : VM, volumes, snapshots, sauvegardes, buckets, bases de données, zones DNS — tout. Les fiches des utilisateurs et les attributions de rôles sont révoquées de façon atomique.

Par sécurité, l’API exige un header de confirmation (`X-Confirm-Project-Delete: <project-id>`) sur cet appel ; sans lui, la requête renvoie 400.

## Étapes suivantes {#next-steps}

- [Utilisateurs](/docs/api/users) — les identités d’un projet.
- [Rôles](/docs/api/roles) — ce que les utilisateurs doivent détenir pour pouvoir agir.
- [Quotas](/docs/api/quotas) — les limites de ressources par projet.
