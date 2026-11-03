---
title: "Images de VM"
description: "Images de démarrage OS — modèles publics et images personnalisées propres au projet."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Images de VM

Une image de VM est le modèle d’OS utilisé pour démarrer le disque racine d’une nouvelle VM. NimbusNexus fournit des **images publiques**, et vous pouvez téléverser vos propres **images personnalisées**, construites avec des outils comme Packer.

## Images publiques {#public-images}

`GET /api/v1/image/` liste les images que vous pouvez utiliser ; `visibility=public` restreint la liste aux images publiques. Une image est identifiée par son `id`, un UUID, et c’est lui que vous passez dans `image` quand vous créez une VM. Les noms sont des libellés, pas des slugs versionnés : recherchez donc l’`id` plutôt que de coder un nom en dur.

Au démarrage, une VM reçoit la clé SSH que vous avez indiquée dans `sshs` (voir [Clés SSH](/docs/api/ssh-keys)) et les éventuelles `user_data` que vous avez passées ; une image dotée de cloud-init les applique au premier démarrage.

## Images personnalisées {#custom-images}

Une image personnalisée nécessite deux appels :

1. `POST /api/v1/image/` crée la fiche de l’image à partir d’un `name` (au moins 5 caractères), d’un `disk_format` et d’un `container_format`, et renvoie son `id`. Définissez en option `visibility` (`private` par défaut : votre projet uniquement) et `subscription`, le plan de facturation (`Hourly` par défaut).
2. `POST /api/v1/image/file` téléverse le fichier, en multipart avec `file` et `image_id`. Ou bien `POST /api/v1/image/import` avec `{"id": "…", "url": "…"}` récupère l’image depuis une URL.

Les extensions de fichier acceptées sont `.img`, `.qcow2`, `.vmdk`, `.vhd`, `.vhdx`, `.raw`, `.iso`, `.ami`, `.ari`, `.aki` et `.vdi` ; pour toute autre extension, l’API répond `400`.

Les images personnalisées sont facturées au GB, arrondi au GB entier supérieur, comme un produit à part entière, selon le plan indiqué dans `subscription` ; voir [Données tarifaires](/docs/api/pricing-data).

## Régions {#regions}

Les appels sur les images s’appliquent à la région de votre session. Il n’existe aucun appel pour copier une image vers une autre région.

## Étapes suivantes {#next-steps}

- [Machines virtuelles](/docs/api/vms) — provisionner une VM avec l’une de ces images.
- [Tailles de VM](/docs/api/vm-sizes) — la configuration de calcul dans laquelle l’image démarre.
- [Sauvegardes](/docs/api/backups) — les snapshots et sauvegardes des volumes d’une VM.
