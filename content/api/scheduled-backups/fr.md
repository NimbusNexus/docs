---
title: "Sauvegardes planifiées"
description: "Planifications de sauvegarde récurrentes — quotidiennes, hebdomadaires, personnalisées. Distinctes des sauvegardes à la demande."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: scheduled-backups
---

# Sauvegardes planifiées

Les [sauvegardes](/docs/api/backups) à la demande couvrent le cas « je veux un snapshot de ce volume tout de suite ». Les sauvegardes planifiées couvrent tout le reste : des sauvegardes nocturnes de chaque volume de production, des sauvegardes complètes hebdomadaires associées à des incrémentales quotidiennes, des snapshots mensuels conservés un an pour la conformité.

Une planification est un petit document JSON — choisissez une cible (un volume, une VM, une base de données), une fréquence (de style cron), une politique de rétention (conserver les N plus récentes, ou expirer après X jours) et une politique de stockage (quelle région/classe de stockage pour les sauvegardes). Le planificateur tourne en arrière-plan ; les exécutions en échec sont réessayées avec backoff et apparaissent dans le journal d’exécution de la planification.

La plupart des comptes de production utilisent 2–4 planifications : daily-keep-14, weekly-keep-8, monthly-keep-12, et parfois un snapshot de fin d’année conservé 7 ans pour la finance ou le juridique.

## Étapes suivantes {#next-steps}

- [Sauvegardes](/docs/api/backups) — l’équivalent à la demande, et le type de ressource que produisent les planifications.
- [Stockage en bloc](/docs/api/block-storage) et [Snapshots](/docs/api/snapshots) — les sources des sauvegardes.
- [Bases de données managées](/docs/api/managed-databases) — possèdent leur propre modèle de rétention ; n’utilisent pas les planifications de cet endpoint.
