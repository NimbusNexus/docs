---
title: "Tailles de VM"
description: "Les flavors de calcul — vCPU, RAM et swap — et comment une VM en obtient un."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Tailles de VM

Une taille de VM est un flavor : un nombre de vCPU (`vcpus`), une RAM en MB (`ram`) et un swap en MB (`swap`). Vous ne choisissez pas de flavor quand vous créez une VM : vous définissez `spec.cpu` et `spec.ram`, et l’API utilise un flavor qui a exactement ces valeurs, en le créant s’il n’en existe aucun. Le disque de démarrage ne fait pas partie du flavor ; c’est un volume distinct.

## Architecture et classe de VM {#families}

Outre `cpu` et `ram`, la `spec` d’une VM indique une `architecture` et une `vm_class`. Ensemble, elles déterminent le produit sous lequel la VM est facturée. Les choix proposés dans la région de votre session figurent dans le `vm_options` que renvoie `GET /api/v1/instance/artifacts`.

## Convention de nommage {#naming}

Lisez la forme d’un flavor dans `vcpus`, `ram` et `swap`, pas dans son nom. Un flavor que l’API crée pour une VM porte le nom de son `id`, un UUID, tout comme un flavor créé avec `POST /api/v1/flavor/` sans `name`. `GET /api/v1/flavor/` filtre sur la forme avec `min_vcpus`, `max_vcpus`, `min_ram`, `max_ram`, `min_swap` et `max_swap`.

Les prix dépendent de l’`architecture`, de la `vm_class`, du `cpu` et de la `ram` ; voir [Données tarifaires](/docs/api/pricing-data).

## Redimensionner {#resizing}

Une VM peut changer de taille sans être reprovisionnée. Envoyez `POST /api/v1/instance/{instance_id}/resize` avec une nouvelle `spec` (`architecture`, `vm_class`, `cpu`, `ram`). La VM redémarre sur le nouveau flavor et attend dans l’état `VERIFY_RESIZE` : `POST /api/v1/instance/{instance_id}/confirm_resize` conserve la nouvelle taille, et `POST /api/v1/instance/{instance_id}/revert_resize` revient à l’ancienne. Les deux répondent `400` si la VM n’est pas en `VERIFY_RESIZE`.

## Étapes suivantes {#next-steps}

- [Machines virtuelles](/docs/api/vms) — les endpoints qui provisionnent réellement une VM dans l’une de ces tailles.
- [Images de VM](/docs/api/vm-images) — les modèles d’OS avec lesquels vous démarrez la VM.
- [Clés SSH](/docs/api/ssh-keys) — les clés publiques injectées dans les VM au démarrage.
