---
title: "Stockage en bloc"
description: "Volumes NVMe persistants attachés aux VM. Trois tiers, redimensionnement à chaud, snapshots."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Stockage en bloc

Les volumes block sont des disques NVMe persistants que vous attachez à des VM. Chaque volume vit dans une seule région ; il survit à la VM à laquelle il est attaché (vous pouvez le détacher puis le rattacher à une nouvelle VM) ; il peut être redimensionné sans interruption ; et il peut faire l’objet d’un snapshot à la demande, stocké dans le stockage objet.

## Tiers {#tiers}

| Tier | Par GB-mois | Débit | IOPS (pic) | Quand l’utiliser |
| --- | --- | --- | --- | --- |
| `standard` | \$0.11 | 250 MB/s | 3,000 | Disques racine, bases de données de dev, tout ce que vous voulez garder bon marché. |
| `performance` | \$0.18 | 1,000 MB/s | 16,000 | Disques de bases de données de production, caches de build, données chaudes. **Par défaut pour les bases de données managées.** |
| `extreme` | \$0.30 | 4,000 MB/s | 64,000 | Charges de travail sensibles à la latence — diffusion publicitaire, espace temporaire pour l’analytique, tout ce qui est limité par le disque. |

Les trois tiers utilisent le même matériel NVMe ; les différences tiennent à la QoS au niveau de l’ordonnancement, pas au support physique. Vous pouvez redimensionner **et** changer de tier sans interruption — commencez en Standard, passez en Performance quand vous dépassez le budget d’IOPS, redescendez si la consommation se stabilise.

## Cycle de vie {#lifecycle}

Les volumes passent par quatre états :

- `available` — créé mais pas attaché. Facturé comme un volume attaché (le stockage ne fait pas la différence).
- `attached` — lié à une VM. Visible dans la VM comme périphérique bloc (`/dev/sdb`, `/dev/sdc`, …).
- `detaching` → `available` — en cours de libération d’une VM. Le démontage a lieu côté serveur ; assurez-vous d’abord que les tampons de votre système de fichiers ont été vidés.
- `deleted` — détruit. **Impossible à récupérer.** Prenez d’abord un snapshot si vous voulez une sauvegarde récupérable.

Le détachement est un appel distinct de la suppression. C’est délibéré : nous ne supprimons pas automatiquement un volume quand la VM à laquelle il est attaché est détruite — perdre un disque de base de données parce qu’un collègue a détruit la mauvaise VM est exactement le genre de catastrophe que l’API doit rendre difficile à provoquer par accident.

## Redimensionner {#resize}

`POST /v1/volumes/{id}/resize` avec `{ "size_gb": 500 }` agrandit un volume. Le disque s’agrandit à chaud ; le système de fichiers de la VM a besoin d’un appel séparé à `resize2fs` / `xfs_growfs` pour occuper le nouvel espace. Nous documentons cette étape dans les [guides VM](/docs/api/vms) propres à chaque OS.

La réduction n’est pas possible à chaud. Pour réduire la taille : prenez un snapshot, créez un nouveau volume plus petit à partir du snapshot, attachez le nouveau, copiez les données, détachez l’ancien. Facile à scripter ; nous ne le proposons pas en natif parce que le risque de perte de données est trop grand.

## Snapshots {#snapshots}

Les snapshots sont des copies à un instant T stockées dans le stockage objet (la classe `cold` — bon marché, récupérée à la demande quand vous restaurez).

- Déclenchés par `POST /v1/volumes/{id}/snapshots`.
- Prennent ~10 secondes pour établir le point de cohérence, puis poursuivent la copie en arrière-plan.
- Stockés à \$0.04/GB-mois.
- Restaurables vers un nouveau volume de taille **identique ou supérieure**, dans n’importe quelle région (une restauration inter-région compte comme de l’egress inter-région, à \$0.005/GB).

Le snapshot est cohérent au niveau de la couche bloc, pas de la couche applicative. Pour les bases de données, préférez l’API de snapshot de la base elle-même (voir [Bases de données managées](/docs/api/managed-databases)) — elle suspend les écritures au niveau du moteur. Les snapshots de la couche bloc conviennent aux volumes de système de fichiers qui ne font pas tourner de moteur transactionnel.

## Sémantique d’attachement {#attach}

Un volume ne peut être attaché qu’à **une seule VM à la fois**. Le multi-attachement (sémantique de disque partagé) n’est pas pris en charge — coordonner des applications sur un volume NVMe partagé est plus difficile que l’API ne le laisse paraître, et nous préférons ne pas fabriquer ce piège.

L’attachement est propre à une région : un volume de `us-east-1` ne peut pas être attaché à une VM de `eu-central-1`. Pour déplacer des données entre régions, la bonne méthode est snapshot + restauration.

## Notes sur les tarifs {#pricing}

- Stockage : au GB-mois, facturé à la seconde. La classe de stockage (Standard/Performance/Extreme) détermine le tarif ; la taille détermine le multiplicateur.
- Snapshots : \$0.04/GB-mois, facturés sur la taille du contenu du snapshot (dédupliqué entre les snapshots d’un même volume).
- Réplication inter-région : \$0.005/GB-mois pour la copie répliquée, plus l’egress inter-région standard pour la synchronisation initiale.
- Pas de facturation à l’IOPS. Pas de frais par attachement. Pas de supplément lié au débit.

## Étapes suivantes {#next-steps}

- [Machines virtuelles](/docs/api/vms) — ce à quoi vous attachez les volumes.
- [Stockage objet](/docs/api/object-storage) — pour les données non structurées qui n’ont pas besoin d’un accès au niveau bloc (logs, sauvegardes, fichiers téléversés par les utilisateurs). Moins cher à grande échelle.
- [Conventions](/docs/conventions) pour le polling des opérations, l’idempotence, les formats d’erreur.
