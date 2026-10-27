---
title: "Bases de données managées"
description: "Postgres, MySQL, MongoDB, Redis, Kafka et OpenSearch managés — provisionnez, prenez des snapshots, restaurez."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Bases de données managées

NimbusNexus exploite six moteurs de base de données sous forme de services managés. Nous nous chargeons du travail opérationnel — basculement, sauvegardes, mises à jour de version mineure, correctifs de l’OS — et vous obtenez une chaîne de connexion et le protocole natif du moteur à l’autre bout. **Aucun format de transmission propriétaire, aucune bibliothèque cliente spéciale requise** : connectez-vous avec `psql`, `mongo`, le client Kafka officiel, etc.

## Moteurs {#engines}

| Moteur | Usage | Taille de départ |
| --- | --- | --- |
| `postgres` | Charge transactionnelle, le choix sûr par défaut pour « j’ai besoin d’une base de données ». | `db-1-4` |
| `mysql` | Quand l’application ou l’équipe est déjà sur MySQL. PostgreSQL est le bon choix par défaut pour les nouveaux projets. | `db-1-4` |
| `mongodb` | Charge orientée documents, schémas dynamiques, sémantique de replica set. | `db-2-8` |
| `redis` | Cache, stockage de sessions, pub/sub, files d’attente. Pas d’interface SQL. | `db-1-2` |
| `kafka` | Streaming d’événements, agrégation de logs, pub/sub durable. Trois brokers minimum. | `db-2-8` × 3 |
| `opensearch` | Recherche plein texte, analyse de logs. | `db-4-16` |

Les codes de taille suivent la même convention que les VM (`db-<vCPU>-<RAM_GB>`), avec un multiplicateur de prix propre à chaque moteur — Redis est moins cher que Postgres sur le même matériel parce qu’il n’y a pas de WAL sur disque ; MongoDB est plus cher à cause du surcoût de licence lié aux replica sets.

## Cycle de vie {#lifecycle}

Les bases de données passent par cinq états :

- `provisioning` — instance(s) en cours de démarrage. 60–120 secondes pour les moteurs à nœud unique (Postgres, MySQL, Redis), 90–180 secondes pour les moteurs répliqués (MongoDB, Kafka, OpenSearch).
- `running` — accepte les connexions sur la chaîne de connexion publiée.
- `maintenance` — application d’une mise à jour mineure ou d’un correctif. Les connexions survivent ; la base de données est brièvement indisponible pendant la bascule (en général <5 secondes pour Postgres/MySQL, plus longtemps pour Kafka).
- `stopping` → `stopped` — en pause. Le calcul cesse d’être facturé ; le stockage reste facturé. Redémarrage possible à tout moment.
- `terminated` — détruite.

L’état figure dans chaque réponse GET, dans le champ `state`. Les transitions longues (provisionnement initial, mise à jour de version) signalent leur progression dans un objet `operation` imbriqué — voir [Conventions](/docs/conventions).

## Sauvegardes et snapshots {#backups}

Deux mécanismes de sauvegarde fonctionnent côte à côte :

- **Sauvegarde WAL continue** (Postgres, MySQL uniquement). Activée par défaut. Nous envoyons le write-ahead log vers le stockage objet toutes les ~5 secondes et pouvons restaurer à n’importe quel moment des 7 derniers jours. **Restauration à un instant T**.
- **Snapshots à la demande** (tous les moteurs). Déclenchés par `POST /v1/databases/{id}/snapshots`. Cohérents (aucune mise en pause des E/S requise), stockés dans le stockage objet, restaurables vers une nouvelle base de données dans la même région.

Les snapshots sont indépendants de la base de données source — détruire la source préserve les snapshots. La rétention est de 7 jours par défaut ; augmentez-la dans la console ou en passant `retention_days` dans la requête de snapshot.

## Connexions {#connections}

La réponse GET de chaque base de données inclut un objet `connection` :

```json
{
  "connection": {
    "host": "{{DB_HOST_DEMO}}",
    "port": 5432,
    "database": "main",
    "username": "nimbus",
    "password_secret": "secret://projects/.../database-passwords/db_01H8FZ...",
    "ssl": "require"
  }
}
```

Le mot de passe est référencé par une URL de secret, et non inclus en clair — récupérez-le via `GET /v1/secrets/{secret-id}` et mettez-le en cache pour la durée de vie de la connexion. Ainsi, aucun log qui capture l’enregistrement complet d’une base de données ne contient de mot de passe.

Toutes les bases de données imposent TLS pour les connexions des clients. Les certificats autosignés ne sont pas acceptés ; nous publions le bundle de CA à `/v1/databases/ca-bundle.pem`. Les clients Postgres / MySQL doivent utiliser `sslmode=verify-full` et faire pointer `sslrootcert` vers le bundle.

## Versions et mises à jour {#versions}

- **Les versions mineures** s’appliquent automatiquement pendant la fenêtre de maintenance hebdomadaire (le dimanche, 02:00–04:00 dans la région de la base de données, configurable). Sans interruption pour Postgres/MySQL avec WAL continu ; les moteurs à replica set subissent un bref basculement.
- **Les versions majeures** nécessitent un appel explicite à `POST /v1/databases/{id}/upgrade`. Nous testons la mise à jour sur vos données, à partir d’un snapshot, avant de basculer le primaire : une mise à jour ratée se traduit par un retour arrière, pas par une corruption.

Les versions majeures sont prises en charge pendant au moins 24 mois après leur publication en amont. Nous publions les calendriers de fin de vie dans le changelog, avec un préavis d’au moins 90 jours.

## Notes sur les tarifs {#pricing}

- Calcul : à la seconde, par équivalent vCPU, avec un multiplicateur selon le moteur (voir la [page des tarifs]({{BASE_URL}}/managed-databases)).
- Stockage : \$0.18/GB-mois (NVMe Performance, le choix par défaut).
- Sauvegardes : \$0.04/GB-mois pour le tier des snapshots.
- Réplication inter-région (là où elle est prise en charge) : facturée au tarif de l’egress inter-région standard (\$0.005/GB).
- Pas de frais par connexion, pas de facturation à l’IOPS, aucun frais pour les basculements.

Le prix de départ affiché est de \$19/mois pour un Postgres `db-1-4` en Virginie — une instance 1 vCPU / 4 GB / 50 GB, la plus petite taille raisonnable pour des charges de production.

## Étapes suivantes {#next-steps}

- [Authentification](/docs/authentication) pour le schéma de token Bearer commun à tous les endpoints.
- [Conventions](/docs/conventions) pour le fonctionnement des opérations, de la pagination et des erreurs.
- [Stockage en bloc](/docs/api/block-storage) — si vous faites tourner votre propre base de données sur une VM, c’est le disque sur lequel elle réside.
- L’article **Postgres / MySQL / Mongo / Redis : lequel choisir, et quand** dans les [Ressources](/resources/postgres-mysql-mongo-redis-when-to-use) — guide de choix du moteur.
