---
title: "Sauvegardes"
description: "Sauvegardes planifiées et à la demande, avec déduplication, politiques de rétention et restauration inter-région."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Sauvegardes

Les sauvegardes sont des copies managées de VM, de volumes et de bases de données, conservées sur le tier de stockage à froid avec déduplication et rétention configurable. Les endpoints prennent en charge à la fois les sauvegardes **à la demande** (ponctuelles, vous appelez POST) et les sauvegardes **planifiées** (récurrentes, pilotées par une politique attachée à la ressource source).

## Sauvegardes ou snapshots {#backups-vs-snapshots}

Les deux sont des copies à un instant T ; elles diffèrent par leur fonctionnement :

| | Snapshot | Sauvegarde |
| --- | --- | --- |
| Création | Par appel API direct uniquement | Par appel direct OU par une politique récurrente |
| Rétention | 7 jours par défaut, extension manuelle | Définie par une politique de rétention explicite (niveaux quotidien/hebdomadaire/mensuel) |
| Tarifs | \$0.04/GB-mois (tier froid, dédupliqué) | \$0.04/GB-mois + frais de récupération à chaque restauration |
| Réplication inter-région | Manuelle, par restauration puis copie | Intégrée à la politique |
| Restauration en nouvelle ressource | Oui | Oui |
| Journal d’audit | Standard | Standard + métadonnées d’attribution à la politique |

Utilisez les snapshots pour les copies ponctuelles que vous exploiterez vous-même. Utilisez les sauvegardes pour le schéma récurrent « nous avons toujours une copie de 7 jours, une de 30 jours et une de 365 jours » — c’est la forme pilotée par une politique.

## Sauvegardes pilotées par une politique {#policies}

Attachez une politique de sauvegarde à une VM / un volume / une base de données avec :

```json
{
  "source_id": "vm_01H...",
  "source_kind": "vm",
  "schedule": "daily",
  "retention": {
    "daily": 7,
    "weekly": 4,
    "monthly": 12,
    "yearly": 5
  }
}
```

Cette politique maintient 7 quotidiennes + 4 hebdomadaires + 12 mensuelles + 5 annuelles = 28 sauvegardes actives en régime établi. Les sauvegardes plus anciennes expirent automatiquement ; vous n’avez pas à les nettoyer manuellement.

Les endpoints des politiques se trouvent sous `/v1/backups/policies` (ils ne figurent pas dans l’exemple minimal ci-dessous — la référence complète se trouve dans la spécification en direct).

## Verrous de rétention {#retention}

Une sauvegarde soumise à un niveau de rétention actif (par exemple « quotidienne, conserver 7 ») est **verrouillée par la rétention** pendant cette période. Une tentative de suppression avant l’expiration renvoie 409. C’est la fonctionnalité de conformité : un utilisateur ne peut pas supprimer une sauvegarde encore dans sa fenêtre de rétention, même s’il dispose des droits admin.

Pour passer outre, il faudrait détacher la source de la politique (la sauvegarde devient alors orpheline et n’est plus verrouillée par la rétention), puis la supprimer. Le passage à l’état orphelin est consigné dans la piste d’audit.

## Réplication inter-région {#cross-region}

Une politique peut indiquer une région secondaire : chaque sauvegarde créée par la politique y est répliquée dans les ~10 minutes qui suivent sa création. La copie répliquée est facturée comme du stockage inter-région (\$0.005/GB-mois de plus que la copie primaire).

Restaurer depuis la copie secondaire ne demande aucune formalité particulière — `POST /v1/backups/{id}/restore` avec l’identifiant de la copie secondaire, et la région cible est par défaut celle de la copie secondaire. Exercice de reprise après sinistre courant : chaque mois, restaurer depuis la copie secondaire dans un projet bac à sable, valider, détruire.

## Étapes suivantes {#next-steps}

- [Snapshots](/docs/api/snapshots) — le cousin ponctuel.
- [Stockage à froid](/docs/api/cold-storage) — le tier sur lequel sont stockées les sauvegardes.
- [Machines virtuelles](/docs/api/vms), [Stockage en bloc](/docs/api/block-storage), [Bases de données managées](/docs/api/managed-databases) — les trois types de source possibles.
