---
title: "Images de VM"
description: "Images de démarrage OS — modèles publics et images personnalisées propres au projet."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Images de VM

Une image de VM est le modèle d’OS utilisé pour démarrer le disque racine d’une nouvelle VM. NimbusNexus fournit des **images publiques** pour les principales distributions Linux et pour Windows Server ; vous pouvez aussi téléverser vos propres **images personnalisées**, construites avec des outils comme Packer ou en prenant un snapshot d’une VM configurée.

## Images publiques {#public-images}

Le catalogue public est mis à jour chaque mois avec les correctifs de sécurité. Les slugs restent stables d’un correctif à l’autre ; récupérer `ubuntu-24.04` aujourd’hui puis dans 6 mois vous donne 6 mois de correctifs appliqués à la même base. Épinglez un slug daté (par exemple `ubuntu-24.04-20260301`) si vous avez besoin de démarrages reproductibles à l’octet près.

Slugs publiés actuellement :

- `ubuntu-24.04`, `ubuntu-22.04`, `ubuntu-20.04`
- `debian-12`, `debian-11`
- `fedora-40`, `fedora-39`
- `rocky-9`, `rocky-8`
- `almalinux-9`, `almalinux-8`
- `windows-2022`, `windows-2019`

Chaque image publique inclut notre configuration cloud-init minimale : les clés SSH injectées à partir des clés enregistrées du projet (voir [Clés SSH](/docs/api/ssh-keys)), `apt-get update` ou équivalent au premier démarrage, et le service de métadonnées fixé sur `169.254.169.254`.

## Images personnalisées {#custom-images}

Les images que vous apportez sont acceptées sous forme de fichiers **raw**, **qcow2** ou **vmdk** d’au plus **128 GB** non compressés. L’image est convertie dans notre format interne au téléversement (~1–3 minutes par GB), puis devient une image amorçable ordinaire pour n’importe quelle VM de la même région.

Les images personnalisées sont facturées \$0.013/GB-mois (tarif du stockage objet Standard) pour le stockage. Il n’y a pas de tier distinct de « stockage d’images ».

## Régions {#regions}

Les images publiques sont disponibles dans chaque région active. Les images personnalisées sont propres à une région — téléverser une image dans `us-east-1` ne la rend pas amorçable dans `eu-central-1` sans copie. Utilisez `POST /v1/vm-images/{id}/copy` (absent de la référence ci-dessous — à venir) pour la répliquer.

## Étapes suivantes {#next-steps}

- [Machines virtuelles](/docs/api/vms) — provisionner une VM avec l’une de ces images.
- [Tailles de VM](/docs/api/vm-sizes) — la configuration de calcul dans laquelle l’image démarre.
- [Snapshots](/docs/api/snapshots) — capturer une VM existante sous forme de snapshot, puis le convertir en image personnalisée.
