---
title: "Tailles de VM"
description: "Catalogue des configurations de calcul des familles gp, co, mo et gx."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Tailles de VM

Une taille de VM est une configuration de calcul nommée — nombre de vCPU, RAM, taille du disque racine et famille. Chaque VM est créée avec un code de taille (par exemple `gp-4-16`) ; redimensionner une VM remplace ce code pendant son exécution.

## Les quatre familles {#families}

| Famille | Préfixe de code | Ce pour quoi elle est optimisée |
| --- | --- | --- |
| **General purpose** | `gp-*` | CPU + RAM équilibrés. Le choix par défaut pour la plupart des charges de travail. |
| **Compute optimized** | `co-*` | 2× le CPU par dollar de `gp`, la moitié de la RAM par dollar. Adapté aux services limités par le CPU, aux traitements par lots, à l’encodage vidéo. |
| **Memory optimized** | `mo-*` | Le compromis inverse. Adapté aux caches en mémoire, aux tas JVM, aux espaces temporaires d’analytique. |
| **GPU** | `gx-*` | Accélérateurs NVIDIA L4 / H100. Inférence ML, entraînement, transcodage. |

## Convention de nommage {#naming}

Les codes de taille suivent le format `<family>-<vCPU>-<RAM_GB>`. Ainsi :

- `gp-1-2` — 1 vCPU, 2 GB de RAM, General purpose (la plus petite taille utile, ~\$0.0145/vCPU-heure)
- `gp-4-16` — 4 vCPU, 16 GB de RAM, General purpose
- `co-16-32` — 16 vCPU, 32 GB de RAM, Compute optimized
- `mo-8-64` — 8 vCPU, 64 GB de RAM, Memory optimized
- `gx-4-32-l4` — 4 vCPU, 32 GB de RAM, 1× GPU L4 (les tailles GPU ajoutent le code de l’accélérateur)

L’endpoint du catalogue renvoie la liste complète, avec le tarif actuel de chaque taille. Les prix varient légèrement d’une région à l’autre ; la réponse inclut une table de prix par région.

## Redimensionner {#resizing}

Une VM peut changer de taille sans être reprovisionnée. Un redimensionnement au sein d’une même famille se fait à chaud (sans interruption). Un redimensionnement entre familles nécessite un cycle arrêt / démarrage. Un redimensionnement entre architectures (par exemple de `gp` à `gx`) est une destruction / recréation — l’API rejette l’appel de redimensionnement direct pour rendre explicite la perte de données implicite.

## Étapes suivantes {#next-steps}

- [Machines virtuelles](/docs/api/vms) — les endpoints qui provisionnent réellement une VM dans l’une de ces tailles.
- [Images de VM](/docs/api/vm-images) — les modèles d’OS avec lesquels vous démarrez la VM.
- [Clés SSH](/docs/api/ssh-keys) — les clés publiques injectées dans les VM au démarrage.
