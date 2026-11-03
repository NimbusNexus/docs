---
title: "Espaces de travail"
description: "Le niveau d’isolation au-dessus des projets. Un espace de travail contient des projets ; les projets contiennent des ressources."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: workspaces
---

# Espaces de travail

Un **espace de travail** est le niveau d’isolation le plus élevé du modèle de compte NimbusNexus. Chaque projet appartient à exactement un espace de travail ; l’accès de chaque utilisateur a pour portée des espaces de travail (et des projets précis en leur sein). La hiérarchie est **espace de travail → projet → ressource**.

Pour la plupart des comptes, un seul espace de travail suffit. Les grandes organisations utilisent plusieurs espaces de travail pour séparer la facturation, les accès et les limites de ressources au niveau des unités organisationnelles — par exemple un espace de travail par division, ou un par entité juridique. La facturation se fait par espace de travail, et l’accès ne franchit la frontière d’un espace de travail que lorsque vous l’ouvrez : vous y invitez quelqu’un, ou vous partagez un réseau ou une zone DNS avec un autre projet.

Ne confondez pas un espace de travail avec une zone DNS — c’est le même mot dans certains contextes (OpenStack appelle les espaces de travail des « domaines »). L’API garde le mot d’OpenStack : les endpoints des espaces de travail se trouvent sous `/api/v1/domains/`, et leurs champs emploient aussi « domain » (`domain_id`, `domain_name`, `domain_description`).

## Étapes suivantes {#next-steps}

- [Projets](/docs/api/projects) — le niveau en dessous ; ce que contiennent les espaces de travail.
- [Utilisateurs](/docs/api/users) et [Rôles](/docs/api/roles) — les autorisations IAM ont pour portée un espace de travail.
- [Délégations inter-projets](/docs/api/cross-project-trusts) — des délégations de courte durée qui permettent à NimbusNexus de terminer un travail pour vous sur un projet.
