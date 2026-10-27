---
title: "Snapshots"
description: "Copies à un instant T de VM, de volumes block et de bases de données managées."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Snapshots

Un snapshot est une copie à un instant T d’une ressource source — une VM, un volume block ou une base de données managée — écrite dans le stockage objet. Les snapshots survivent à leur source : supprimer une VM ne supprime pas ses snapshots. Restaurer un snapshot crée une **nouvelle** ressource ; l’original n’est jamais modifié.

## Trois types de source {#source-kinds}

| Type de source | Ce qui est capturé | Cible de restauration |
| --- | --- | --- |
| `vm` | Disque racine + état des volumes attachés à un moment cohérent | Une nouvelle VM de taille identique ou supérieure, dans n’importe quelle région |
| `volume` | Contenu du volume block à un moment cohérent | Un nouveau volume block de taille identique ou supérieure, dans n’importe quelle région |
| `database` | Snapshot logique au niveau du moteur (barrière WAL Postgres / MySQL, point de l’oplog MongoDB, etc.) | Une nouvelle base de données du même moteur + de la même version |

Le champ `source_kind` du snapshot vous indique de quel type il s’agit ; l’endpoint de restauration aiguille vers le bon backend selon ce champ.

## Comment un snapshot reste cohérent {#consistency}

- **Les snapshots de volume** mettent en pause la file d’E/S, prennent un snapshot au niveau bloc (~10 secondes), puis poursuivent la copie en arrière-plan. La VM continue de tourner ; les écritures en cours après le point de snapshot sont reportées dans l’état postérieur au snapshot.
- **Les snapshots de VM** capturent de façon atomique le disque racine + chaque volume attaché. Si vous avez configuré des hooks pré/post-snapshot (des scripts cloud-init qui vident les tampons d’une application), ils s’exécutent dans le cadre du snapshot.
- **Les snapshots de base de données** utilisent le mécanisme de cohérence natif du moteur. Aucune mise en pause des E/S n’est nécessaire côté appelant ; la barrière du journal de commit de la base garantit que vous pouvez restaurer à un point cohérent sur le plan transactionnel.

Pour les applications qui ont besoin d’une cohérence au niveau applicatif (par exemple une base de données Postgres hébergée sur une VM, et non via les bases de données managées), préférez l’API de snapshot de la base de données elle-même à un snapshot de volume.

## Stockage et rétention {#storage}

Les snapshots sont stockés sur le tier froid (\$0.04/GB-mois, dédupliqués par rapport aux snapshots précédents de la même source). La rétention est de **7 jours** par défaut ; passez `retention_days` à la création pour la prolonger jusqu’à 365 jours.

La déduplication signifie qu’une série de snapshots quotidiens d’une même VM pèse à peu près la taille de la VM d’origine plus le delta quotidien — et non N× la taille de la VM. En régime établi, le coût d’une politique de snapshot quotidien avec 30 jours de rétention sur une VM de 100 GB correspond en général à 130–160 GB au total, selon la quantité de changements.

## Sémantique de restauration {#restore}

La restauration crée une **nouvelle ressource** à partir du snapshot. La ressource source (si elle existe encore) n’est pas affectée. Les VM restaurées reçoivent un nouvel identifiant, une nouvelle IP et une nouvelle injection de clés SSH à partir des clés actuelles du projet (le jeu de clés d’origine n’est pas conservé — restaurer une ancienne VM après une rotation des clés vous donne des VM auxquelles les anciennes clés, supprimées, ne peuvent pas accéder).

La restauration inter-région est prise en charge. Le transfert interne des données pour la copie du snapshot est facturé comme de l’egress inter-région (\$0.005/GB) la première fois ; les restaurations suivantes dans la région de destination ne répètent pas le transfert.

## Étapes suivantes {#next-steps}

- [Machines virtuelles](/docs/api/vms) — le cycle de vie des VM que capturent les snapshots.
- [Stockage en bloc](/docs/api/block-storage) — les snapshots de volumes en particulier.
- [Bases de données managées](/docs/api/managed-databases) — les snapshots propres aux bases de données, via l’endpoint de la base elle-même.
- [Stockage à froid](/docs/api/cold-storage) — le tier sur lequel sont stockés les snapshots.
