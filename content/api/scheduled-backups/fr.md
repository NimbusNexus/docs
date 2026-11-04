---
title: "Sauvegardes planifiées"
description: "Planifications de sauvegarde récurrentes — quotidiennes, hebdomadaires ou mensuelles. Distinctes des sauvegardes à la demande."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: scheduled-backups
---

# Sauvegardes planifiées

Les [sauvegardes](/docs/api/backups) à la demande couvrent le cas « je veux un snapshot de ce volume tout de suite ». Les sauvegardes planifiées font des copies d’un volume selon un calendrier et conservent les plus récentes.

Une planification a une `frequency` et une `backup_quantity`, le nombre de copies à conserver (5 par défaut). Une planification `daily` s’exécute chaque jour ; `weekly` s’exécute tous les 7 jours et `monthly` tous les 30 jours, à compter du jour de création de la planification. Créez-en une avec `POST /api/v1/backup_restore/backup_scheduler/` ; elle appartient à votre espace de travail. Liez-la ensuite à chaque volume avec `POST /api/v1/backup_restore/volume_scheduler/`, en indiquant le `volume_id`, le `schedule_id` et le `type` de copie, `snapshot` ou `backup`. La liaison répond `409` si les copies dépasseraient votre quota de sauvegarde.

Pour envoyer aussi les copies `backup` vers un stockage externe, définissez `use_outside_storage` sur la liaison et associez le stockage avec `POST /api/v1/backup_restore/volume_scheduler/config-storage` (`config_id`, `storage_id`, `priority`). L’`outside_backup_quantity` de la planification (1 par défaut) fixe le nombre de copies à y conserver.

Le planificateur tourne en arrière-plan. Une exécution en échec est réessayée, et une exécution qui échoue de façon répétée envoie une [notification](/docs/api/notifications). Pour conserver une copie au-delà de la rotation, comme une copie de fin d’année, définissez `permanent: true` sur elle avec `PATCH /api/v1/backup_restore/volume_backups/{volume_backup_id}`.

## Étapes suivantes {#next-steps}

- [Sauvegardes](/docs/api/backups) — l’équivalent à la demande, et le type de ressource que produisent les planifications.
- [Stockage en bloc](/docs/api/block-storage) — les volumes que copient les planifications.
