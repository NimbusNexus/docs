---
title: "Sauvegardes"
description: "Snapshots et sauvegardes de volumes block, à la demande ou planifiés, restaurés sur place."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Sauvegardes

Une sauvegarde est une copie à un instant T d’un [volume block](/docs/api/block-storage), de l’un de deux types : un `snapshot`, conservé par le service de stockage en bloc à côté du volume, ou un `backup`, une copie complète distincte. Vous les créez **à la demande**, ou une [planification](/docs/api/scheduled-backups) les crée pour vous.

## Sauvegardes ou snapshots {#backups-vs-snapshots}

Les deux sont des copies à un instant T ; elles diffèrent par leur fonctionnement :

| | `type: snapshot` | `type: backup` |
| --- | --- | --- |
| Nature | Un snapshot conservé avec le volume | Une copie complète distincte, qui peut aussi être envoyée vers votre propre stockage |
| Création | Par un appel direct ou une planification | Par un appel direct ou une planification |
| Restauration | `POST /api/v1/backup_restore/volume_backups/snapshot_restore` | `POST /api/v1/backup_restore/volume_backups/backup_restore` |

Un snapshot appartient à son volume : supprimer le volume avec `cascade: true` (`DELETE /api/v1/storage/`) supprime aussi ses snapshots.

## Créer une copie {#create}

`POST /api/v1/backup_restore/volume_backups/create_backup` copie un volume immédiatement. Indiquez le `volume_id` et le `type`, `snapshot` ou `backup`, ainsi qu’un `name`, une `description` et un `permanent` facultatifs. Pour un `backup`, `storage_ids` envoie aussi la copie vers les connexions de stockage externe que vous avez configurées avec `POST /api/v1/external/connections/`.

L’appel met le travail en file d’attente et répond aussitôt, ou répond `409` si la copie dépasserait votre quota de sauvegarde. `GET /api/v1/backup_restore/volume_backups/` liste vos copies, filtrées par `backup_types` et `statuses`, avec `limit` (10 par défaut) et `offset`. Le `status` d’une copie vaut `pending`, `in_progress`, `completed` ou `failed`.

## Copies planifiées {#policies}

Une planification crée des copies pour vous. Créez-en une avec `POST /api/v1/backup_restore/backup_scheduler/`, en indiquant une `frequency` et une `backup_quantity`, puis liez-la à chaque volume avec `POST /api/v1/backup_restore/volume_scheduler/`, en indiquant le `volume_id`, le `schedule_id` et le `type`. La page [Sauvegardes planifiées](/docs/api/scheduled-backups) donne les détails.

## Rétention {#retention}

Une planification conserve les `backup_quantity` copies les plus récentes (5 par défaut) de chaque volume qui lui est lié, et supprime les plus anciennes à mesure que de nouvelles copies arrivent ; `outside_backup_quantity` (1 par défaut) fait de même pour les copies de chaque stockage externe. Les copies que vous créez à la demande restent jusqu’à ce que vous les supprimiez.

Pour soustraire une copie à cette rotation, définissez `permanent: true` sur elle, lors de sa création ou plus tard avec `PATCH /api/v1/backup_restore/volume_backups/{volume_backup_id}`.

Supprimez une copie avec `DELETE /api/v1/backup_restore/volume_backups/single/{volume_backup_id}`, ou plusieurs avec `DELETE /api/v1/backup_restore/volume_backups/bulk` et leurs identifiants dans le paramètre de requête `backup_ids`.

## Restaurer {#restore}

Restaurez un snapshot avec `POST /api/v1/backup_restore/volume_backups/snapshot_restore`, et une sauvegarde avec `POST /api/v1/backup_restore/volume_backups/backup_restore`. Les deux prennent `{"backup_id": "…"}`, mettent le travail en file d’attente et répondent aussitôt. La copie doit être `completed` et du type de l’endpoint ; sinon, l’appel répond `409`.

Une restauration se fait sur place. Elle construit un nouveau volume à partir de la copie, de la même taille et dans la même zone de disponibilité que l’original, et le met à la place de l’original :

- Un volume de données est détaché de sa VM, et le volume restauré est attaché à sa place.
- Pour le volume de démarrage d’une VM, la VM est reconstruite sur le disque restauré. La nouvelle VM reprend les ports et les IP flottantes de l’ancienne, et l’ancienne VM est supprimée. La VM reçoit un nouvel `id` ; le disque restauré conserve les clés SSH qu’il avait.

Les copies et les liaisons de planification du volume d’origine passent au volume restauré.

## Étapes suivantes {#next-steps}

- [Sauvegardes planifiées](/docs/api/scheduled-backups) — créer des copies selon un calendrier.
- [Stockage en bloc](/docs/api/block-storage) — les volumes dont proviennent ces copies.
- [Machines virtuelles](/docs/api/vms) — ce que reconstruit la restauration d’un volume de démarrage.
