---
title: "Stockage en bloc"
description: "Volumes persistants pour les VM — créez, attachez, détachez, agrandissez et supprimez."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Stockage en bloc

Les volumes block sont des disques persistants que vous attachez à des VM. Chaque volume vit dans la région de votre session ; un volume de données survit à la VM à laquelle il est attaché (vous pouvez le détacher puis le rattacher à une nouvelle VM) ; les volumes peuvent être agrandis ; et vous pouvez en prendre un snapshot ou une sauvegarde via [Sauvegardes](/docs/api/backups).

## Types de volume {#tiers}

`GET /api/v1/storage/artifacts` liste ce que vous pouvez créer dans la région de votre session : les types de volume dans `types`, et les options de stockage tarifées dans `volume_options`. `POST /api/v1/storage/` prend la `size` en GB et le `volume_type`, l’un des libellés de `volume_options`, qui fixe le prix. Les champs facultatifs sont un `type` issu de `types`, un `name`, une `description`, une `image` à partir de laquelle construire le volume, et `subscription`, le plan de facturation (`Hourly` par défaut).

Un volume conserve son type toute sa vie : aucun appel ne permet de le changer. Les prix par `volume_type` se trouvent dans [Données tarifaires](/docs/api/pricing-data).

## Cycle de vie {#lifecycle}

`POST /api/v1/storage/` met le travail en file d’attente et répond sans identifiant ; le nouveau volume apparaît dans `GET /api/v1/storage/`. Son `status` provient du service de stockage en bloc. Les valeurs que vous rencontrerez le plus souvent :

- `available` — créé mais pas attaché. Facturé comme un volume attaché (le stockage ne fait pas la différence).
- `in-use` — lié à une VM. Visible dans la VM comme périphérique bloc (`/dev/vdb`, `/dev/vdc`, …).
- `detaching` → `available` — en cours de libération d’une VM. Démontez le système de fichiers dans la VM avant de détacher le volume.

Le détachement est un appel distinct de la suppression. Supprimer une VM supprime le volume de démarrage créé à partir de son image ; les volumes que vous avez attachés, ou passés dans `volumes` lors de la création de la VM, restent `available`.

`DELETE /api/v1/storage/` détruit les volumes dont vous listez les identifiants dans `ids`. Un volume supprimé est **impossible à récupérer** : sauvegardez-le donc d’abord si vous voulez une copie récupérable. Avec `cascade: true`, les snapshots du volume sont supprimés en même temps que lui.

## Redimensionner {#resize}

`POST /api/v1/storage/resize` avec `{"volume_id": "…", "new_size": 500}` agrandit un volume à 500 GB. `new_size` doit être supérieur à la taille actuelle ; pour toute autre valeur, l’API répond `400`. Le système de fichiers de la VM a besoin d’un appel séparé à `resize2fs` / `xfs_growfs` pour occuper le nouvel espace.

La réduction n’est pas possible. Pour réduire la taille : créez un nouveau volume plus petit, attachez-le, copiez les données et détachez l’ancien.

## Snapshots {#snapshots}

Les snapshots et sauvegardes d’un volume se font via [Sauvegardes](/docs/api/backups) : `POST /api/v1/backup_restore/volume_backups/create_backup` avec le `volume_id` et `type: snapshot` (une copie à un instant T conservée avec le volume) ou `type: backup` (une copie complète distincte).

Le snapshot est cohérent au niveau de la couche bloc, pas de la couche applicative. Pour une base de données, suspendez d’abord les écritures ou utilisez l’outil de sauvegarde propre à la base. Les snapshots de la couche bloc conviennent aux volumes de système de fichiers qui ne font pas tourner de moteur transactionnel.

Une restauration remet la copie à la place du volume, à la même taille ; voir [Sauvegardes](/docs/api/backups#restore).

## Sémantique d’attachement {#attach}

Un volume ne peut être attaché qu’à **une seule VM à la fois**. Le multi-attachement (sémantique de disque partagé) n’est pas pris en charge.

`POST /api/v1/storage/attach` prend le `volume_id`, l’`instance_id` et un `mountpoint` facultatif ; sans `mountpoint`, le volume reçoit le premier périphérique libre à partir de `/dev/vdb`. `POST /api/v1/storage/detach` prend l’`instance_id`, le `volume_id` et l’`attachment_id`, que `GET /api/v1/storage/detach_artifacts` liste pour une VM.

Un volume et la VM à laquelle il s’attache se trouvent tous deux dans la région de votre session.

## Notes sur les tarifs {#pricing}

- Stockage : facturé au GB au prix du `volume_type` du volume, selon le plan indiqué dans `subscription`. Les prix se trouvent dans [Données tarifaires](/docs/api/pricing-data).
- Pas de facturation à l’IOPS. Pas de frais par attachement. Pas de supplément lié au débit.

## Étapes suivantes {#next-steps}

- [Machines virtuelles](/docs/api/vms) — ce à quoi vous attachez les volumes.
- [Stockage objet](/docs/api/object-storage) — pour les données non structurées qui n’ont pas besoin d’un accès au niveau bloc (logs, sauvegardes, fichiers téléversés par les utilisateurs).
- [Sauvegardes](/docs/api/backups) — les snapshots et sauvegardes d’un volume, et leur restauration.
