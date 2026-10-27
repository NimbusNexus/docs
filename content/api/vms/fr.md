---
title: "Machines virtuelles"
description: "Provisionnez, inspectez, redimensionnez et détruisez des VM. Référence des endpoints en direct, générée automatiquement à partir de la spécification OpenAPI."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Machines virtuelles

Une machine virtuelle NimbusNexus est une instance de calcul à consommation mesurée — un arbre de processus, une interface réseau, un disque racine — facturée à la seconde. Vous en créez une en choisissant une taille et une région ; tout le reste (volumes block, IP publiques, snapshots) s’y attache sous forme de ressources distinctes.

## Quand utiliser une VM {#when-to-use}

Les VM sont la bonne brique quand il vous faut :

- Un état persistant sur disque entre les requêtes (une base de données, un cache de build, un worker de file d’attente qui tourne longtemps).
- Un contrôle total de l’OS — installer des paquets, régler des paramètres du noyau, exécuter tout ce qui demande un accès système.
- Une forme d’instance précise — beaucoup de mémoire pour une charge analytique, un GPU pour l’inférence, une taille Compute optimized pour un service limité par le CPU.

Si votre charge de travail est **sans état et organisée en requêtes**, les plateformes de conteneurs (services Kubernetes managés, runtimes serverless) conviennent généralement mieux. La frontière est à peu près la suivante : si un redémarrage de processus qui effacerait les fichiers locaux vous poserait problème, il vous faut une VM.

## Tailles, familles, nommage {#sizes}

Les tailles suivent le format `<family>-<vCPU>-<RAM_GB>`. Trois familles aujourd’hui :

- `gp-*` — General purpose. CPU + RAM équilibrés. La plupart des charges de travail commencent ici.
- `co-*` — Compute optimized. 2× le CPU par dollar de `gp`, la moitié de la RAM par dollar.
- `mo-*` — Memory optimized. Le compromis inverse. Adapté aux caches en mémoire, aux tas JVM, aux espaces temporaires d’analytique.

Ainsi, `gp-4-16` correspond à 4 vCPU, 16 GB de RAM, General purpose. `co-16-32` correspond à 16 vCPU, 32 GB de RAM, Compute optimized. La liste complète se trouve à `GET /v1/vms/sizes` (pas encore rendue automatiquement dans cette référence — bientôt disponible).

## Cycle de vie {#lifecycle}

Une VM passe par les états suivants :

- `provisioning` — le disque est en cours de préparation et l’hyperviseur alloue l’instance. ~5–30 secondes sur une image en cache, jusqu’à 90 secondes lors de la première récupération d’une image.
- `running` — démarrage terminé, l’instance accepte du trafic. C’est l’état stable dans lequel vous passez la plupart du temps.
- `stopping` → `stopped` — arrêt propre. La VM persiste ; le calcul cesse d’être facturé, mais le stockage reste facturé.
- `terminated` — la VM a été détruite. Les volumes block attachés ont soit été détruits eux aussi (le comportement par défaut), soit été détachés et restent disponibles (si `preserve_volumes: true` a été défini lors de la suppression).

Les transitions d’état apparaissent dans le champ `state` de chaque `GET`. Les transitions longues signalent leur progression dans un objet `operation` imbriqué — voir la page [Conventions](/docs/conventions) pour le schéma de polling des opérations, utilisé ici comme dans le reste de l’API.

## Nommage et identifiants stables {#ids}

Chaque VM porte deux identifiants :

- `id` — opaque, préfixe `vm_`, suffixe base32 de 26 caractères. Stable pendant toute la vie de la VM. Utilisez-le dans les URL, les clés étrangères, les journaux d’audit.
- `name` — lisible par un humain, 1–63 caractères, alphanumériques + tirets, unique au sein d’un projet. Modifiable via `PUT /v1/vms/{id}`. Ne l’utilisez dans aucun chemin de code que vous ne voulez pas réécrire le jour où quelqu’un renomme la VM.

La référence des endpoints ci-dessous utilise `{id}` dans les modèles de chemin ; la valeur à passer est l’identifiant opaque.
