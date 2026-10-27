---
title: "Migrer depuis AWS RDS"
description: "Migrez à chaud une base de données Postgres ou MySQL depuis RDS, sans perte de données et avec ~30 s d’interruption."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Migrer depuis AWS RDS

Ce guide déplace une base de données Postgres ou MySQL de production depuis AWS RDS vers les bases de données managées NimbusNexus, à l’aide de la réplication logique. Le principe : faire la copie en masse à chaud (sans interruption), transmettre en continu les modifications via le WAL/binlog, puis basculer avec une brève pause des connexions.

Interruption attendue : **~30 secondes** pour la bascule. Durée totale : dépend du volume de données (8–30 minutes pour la copie initiale aux tailles habituelles).

Fonctionne pour :

- Postgres 12+
- MySQL 8.0+

## Prérequis {#prereqs}

Côté AWS :

- La réplication logique doit être activée sur l’instance RDS (`rds.logical_replication = 1` pour Postgres ; `binlog_format = ROW` pour MySQL).
- Un utilisateur capable de répliquer (vous pouvez aussi utiliser l’utilisateur master).
- Un accès réseau entrant depuis les IP NimbusNexus (nous obtiendrons les CIDR précis dans un instant).
- Une sauvegarde récente de l’instance RDS. Au cas où.

Côté NimbusNexus :

- Une clé API.
- Une région choisie. La latence entre l’hôte de migration et l’instance RDS source compte — choisissez la région la plus proche de la région RDS (par exemple `us-east-1` pour une instance RDS dans `us-east-1`).

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · Provisionner le cluster cible {#provision}

Créez le cluster de destination avec le même moteur + la même version que la source :

```bash
curl -X POST {{API_BASE_URL}}/v1/databases \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "app-prod-migrated",
    "engine": "postgres",
    "engine_version": "16",
    "tier": "production-4-16",
    "region": "us-east-1",
    "high_availability": true,
    "tls_required": true
  }'
```

Reprenez la classe d’instance de la source aussi fidèlement que possible. Avec une taille nettement inférieure, la cible risque de prendre du retard pendant la phase de streaming du WAL/binlog. Vous pourrez redimensionner une fois la migration terminée.

Enregistrez l’identifiant du cluster :

```bash
export DB_ID="db_01HG7..."
```

Attendez `state: running` (4–7 minutes).

## 2 · Autoriser les IP NimbusNexus sur RDS {#allowlist}

Récupérez les CIDR d’egress de nos workers de migration dans votre région :

```bash
curl {{API_BASE_URL}}/v1/databases/migration-source-cidrs?region=us-east-1 \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

La réponse est une liste de blocs `/24`. Ajoutez-les aux règles entrantes du groupe de sécurité de votre instance RDS, sur le port Postgres ou MySQL. Limitez l’accès à ces seuls CIDR — n’ouvrez pas `0.0.0.0/0`.

## 3 · Lancer la migration {#kick-off}

```bash
curl -X POST {{API_BASE_URL}}/v1/databases/$DB_ID/migrate \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "host": "mydb.abc123.us-east-1.rds.amazonaws.com",
      "port": 5432,
      "database": "app",
      "username": "migration_user",
      "password": "••••",
      "tls_required": true
    },
    "mode": "logical-replication"
  }'
```

La réponse contient un `migration_id` :

```bash
export MIG_ID="mig_01HG7Y3..."
```

La migration se déroule en trois phases, que l’API expose explicitement :

1. **`copying`** — la copie en masse. Lit chaque ligne de la source et l’écrit dans la cible. C’est ce qui prend le plus de temps. La source reste pleinement opérationnelle pendant cette phase ; lectures + écritures continuent normalement.
2. **`streaming`** — une fois la copie terminée, la cible commence à suivre le WAL (Postgres) ou le binlog (MySQL) de la source. Le retard est alors en général < 1 seconde.
3. **`cutover-ready`** — la copie est terminée, le streaming a rattrapé son retard. Vous êtes prêt à basculer.

## 4 · Suivre la progression {#progress}

```bash
while true; do
  curl -s {{API_BASE_URL}}/v1/databases/migrations/$MIG_ID \
    -H "Authorization: Bearer $NIMBUS_KEY" \
    | jq '{ phase, rows_copied, rows_total, lag_seconds }'
  sleep 30
done
```

Surveillez :

- `phase: 'copying'` → `phase: 'streaming'` (copie initiale terminée)
- `lag_seconds` qui descend à 0–2 (retard rattrapé)
- `phase: 'cutover-ready'` (vous pouvez basculer)

Pour les bases volumineuses (~100 GB+), abonnez-vous au [webhook `database.migration.cutover_ready`](/docs/webhooks#events) pour être prévenu le moment venu.

## 5 · La bascule {#cutover}

Une fois à `cutover-ready`, la fenêtre de bascule se déroule ainsi :

1. **Suspendez les écritures sur la source.** Arrêtez votre application, ou passez l’instance RDS en lecture seule. Étape critique — tout ce qui est écrit sur la source après ce point n’arrivera pas dans la cible.
2. **Attendez `lag_seconds: 0`.** Cela devrait être quasi instantané, puisque les écritures sont suspendues.
3. **Promouvez la cible :**

   ```bash
   curl -X POST {{API_BASE_URL}}/v1/databases/migrations/$MIG_ID/cut-over \
     -H "Authorization: Bearer $NIMBUS_KEY"
   ```

4. **Faites pointer votre application vers la nouvelle chaîne de connexion.** Récupérez la nouvelle chaîne de connexion avec `GET /v1/databases/$DB_ID/connection`.
5. **Reprenez le trafic.** Votre application écrit désormais dans le nouveau cluster.

Durée totale des étapes 1–5 : en général 20–40 secondes.

L’appel de promotion est aussi une étape de confirmation — tant que vous ne l’avez pas fait, la cible continue de suivre la source. Si quelque chose tourne mal en pleine bascule, l’instance RDS d’origine fait donc toujours foi ; reprenez simplement le trafic sur celle-ci. Vous pouvez relancer la migration à tout moment.

## 6 · Vérifier {#verify}

Après la bascule, lancez une requête rapide pour confirmer :

```bash
psql "postgresql://app:••••@{{DB_HOST_DEMO}}:5432/app?sslmode=verify-full" \
  -c "SELECT count(*) FROM users;"
```

Comparez les comptages avec vos relevés d’avant la migration. Vérifiez quelques lignes au hasard.

## 7 · Supprimer le job de migration + décommissionner RDS {#cleanup}

```bash
curl -X DELETE {{API_BASE_URL}}/v1/databases/migrations/$MIG_ID \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Le job de migration cesse de suivre la source et libère ses ressources. Le cluster cible continue de fonctionner normalement ; seule la tuyauterie de migration disparaît.

Décommissionnez RDS côté AWS — d’abord un snapshot, puis supprimez l’instance. Gardez le snapshot une semaine, par sécurité.

## Pièges courants {#gotchas}

- **Séquences désynchronisées.** La réplication logique de Postgres ne réplique pas l’avancement des séquences. Après la bascule, exécutez `SELECT pg_catalog.setval(seq_name, max(id)) FROM ...` sur chaque séquence pour la faire avancer au-delà de la valeur maximale de la table correspondante.
- **Les rôles + permissions ne sont pas répliqués.** Recréez-les sur la cible avant la bascule. Utilisez `pg_dumpall --roles-only` (Postgres) ou l’équivalent.
- **Les extensions ne sont pas répliquées.** Si votre source utilise `pgvector`, `postgis`, etc., activez-les sur la cible avant de lancer la migration.
- **N’oubliez pas l’historique de `pg_stat_statements`.** La réplication logique ne le copie pas. Exécutez `SELECT pg_stat_statements_reset()` sur la cible après la bascule pour que votre monitoring parte d’une base de référence propre.

## Étapes suivantes {#next-steps}

- [Référence des bases de données managées](/docs/api/managed-databases) — toutes les options du cluster de destination.
- [Un Postgres de production en 10 minutes](/docs/guides/postgres-production) — la même configuration, sans la migration.
- [Sauvegardes](/docs/api/backups) — planifier des sauvegardes quotidiennes + une restauration à un instant T (PITR) sur 7 jours sur le nouveau cluster.
