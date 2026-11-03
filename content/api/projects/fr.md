---
title: "Projets"
description: "L’unité d’isolation des ressources et du contrôle d’accès, au sein d’un espace de travail."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Projets

Un projet est l’**unité d’isolation** de NimbusNexus — pour les ressources et le contrôle d’accès. Chaque projet appartient à un [espace de travail](/docs/api/workspaces). Chaque ressource (VM, volume, bucket, réseau, …) appartient à exactement un projet, et chaque clé API a pour portée exactement un projet. La facturation se fait par espace de travail : une seule facture couvre tous ses projets.

## Pourquoi les projets comptent {#why}

Deux garanties qu’apporte la frontière de projet :

1. **Rayon d’impact.** Une clé API compromise du projet `dev` ne peut pas toucher aux ressources de `prod`. Elles ne sont littéralement pas visibles depuis `dev`.
2. **Quota.** Les quotas sont par projet. Un projet qui s’emballe en créant des VM n’entame pas la marge d’un autre projet.

## Créer un projet {#create}

`POST /api/v1/projects/` prend l’ID de l’espace de travail dans `domain_id`, un `project_name` et, en option, une `project_description` et `enabled`. Le nom doit être unique dans l’espace de travail, sinon l’API répond `409`. Un espace de travail peut avoir une limite de projets ; au-delà, la création répond `403`.

Les projets sont côte à côte dans leur espace de travail. L’API ne permet pas d’imbriquer un projet dans un autre.

## Ce que contient un projet {#contents}

- VM, volumes, sauvegardes
- Buckets
- Réseaux, sous-réseaux, routeurs, groupes de sécurité, IP flottantes, load balancers
- Zones DNS + enregistrements
- Attributions de rôles et clés API (les utilisateurs à qui elles appartiennent vivent dans l’espace de travail)

Les projets ne peuvent pas être fusionnés. Pour regrouper deux projets, il faut exporter puis réimporter les ressources et supprimer l’original — il n’existe délibérément aucune opération de fusion atomique, car l’attribution qui en résulterait (« qu’est-ce qui a été fusionné où ») serait impossible à auditer.

## Suppression {#deletion}

`DELETE /api/v1/projects/` prend l’`id` du projet dans le corps de la requête, et c’est **irréversible**. L’appel supprime le réseau par défaut du projet, puis le projet et ses attributions de rôles. Il ne supprime rien d’autre : supprimez donc d’abord les VM, volumes, buckets et autres ressources du projet.

## Étapes suivantes {#next-steps}

- [Espaces de travail](/docs/api/workspaces) — le conteneur dans lequel vivent les projets.
- [Rôles](/docs/api/roles) — ce que les utilisateurs doivent détenir pour pouvoir agir.
- [Quotas](/docs/api/quotas) — les limites de ressources par projet.
