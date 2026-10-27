---
title: "Espaces de travail"
description: "Le niveau d’isolation au-dessus des projets. Un espace de travail contient des projets ; les projets contiennent des ressources."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: workspaces
---

# Espaces de travail

Un **espace de travail** est le niveau d’isolation le plus élevé du modèle de compte NimbusNexus. Chaque projet appartient à exactement un espace de travail ; l’accès de chaque utilisateur a pour portée des espaces de travail (et des projets précis en leur sein). La hiérarchie est **espace de travail → projet → ressource**.

Pour la plupart des comptes, un seul espace de travail suffit. Les grandes organisations utilisent plusieurs espaces de travail pour séparer la facturation, les accès et les limites de ressources au niveau des unités organisationnelles — par exemple un espace de travail par division, ou un par entité juridique. Le trafic, l’IAM et la facturation sont tous isolés entre espaces de travail, par conception.

Ne confondez pas un espace de travail avec une zone DNS — c’est le même mot dans certains contextes (OpenStack appelle les espaces de travail des « domaines »), mais partout où il s’adresse à l’utilisateur, le produit emploie le terme « workspace ».

## Étapes suivantes {#next-steps}

- [Projets](/docs/api/projects) — le niveau en dessous ; ce que contiennent les espaces de travail.
- [Utilisateurs](/docs/api/users) et [Rôles](/docs/api/roles) — les autorisations IAM ont pour portée un espace de travail.
- [Délégations inter-projets](/docs/api/cross-project-trusts) — des permissions limitées dans le temps, au-delà des frontières entre projets, au sein d’un espace de travail.
