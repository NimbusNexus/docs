---
title: "Un Postgres de production en 10 minutes"
description: "Provisionnez un Postgres managé avec HA, sauvegardes et mises à jour sans interruption — en trois appels d’API."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Un Postgres de production en 10 minutes

À la fin de ce guide, vous aurez un cluster Postgres 16 managé avec :

- Trois nœuds (un primaire, deux réplicas) répartis sur plusieurs zones de disponibilité
- Des sauvegardes quotidiennes automatiques + une restauration à un instant T sur 7 jours
- Le connection pooler activé
- Un accès en TLS uniquement, depuis une IP autorisée
- Une chaîne de connexion prête à intégrer dans votre application

Durée totale : environ 10 minutes (surtout l’étape de provisionnement du cluster).

## Prérequis {#prereqs}

- Un compte NimbusNexus avec une clé API. Voir [Démarrage rapide](/docs/quickstart) si vous n’en avez pas encore.
- La région voulue — Virginie (`us-east-1`), Los Angeles (`us-west-1`), Francfort (`eu-central-1`) ou Singapour (`ap-southeast-1`).
- `psql` installé en local si vous voulez vous connecter à la fin.

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · Créer le cluster {#create}

```bash
curl -X POST {{API_BASE_URL}}/v1/databases \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "app-prod",
    "engine": "postgres",
    "engine_version": "16",
    "tier": "production-4-16",
    "region": "us-east-1",
    "high_availability": true,
    "backup_retention_days": 7,
    "connection_pooler": true,
    "tls_required": true
  }'
```

Le rôle de chaque option :

- `tier: 'production-4-16'` — 4 vCPU, 16 GB de RAM, 200 GB de SSD. La bonne taille pour les applications à trafic faible à moyen (~1,000 QPS). Voir [le tableau des tiers](/docs/api/managed-databases) pour la liste complète des tailles.
- `high_availability: true` — primaire + deux réplicas répartis sur plusieurs AZ. Ajoute ~80 % au coût ; retire beaucoup d’incidents d’astreinte.
- `backup_retention_days: 7` — sauvegarde complète quotidienne + streaming continu du WAL, restaurable à n’importe quel instant des 7 derniers jours.
- `connection_pooler: true` — PgBouncer activé sur le port 6432. Utilisez-le depuis toute application dont vous contrôlez le dimensionnement du pool de connexions (c’est le cas de la plupart).
- `tls_required: true` — les connexions sans TLS sont rejetées au niveau du listener. Activez toujours cette option.

La réponse contient l’`id` du cluster. Enregistrez-le :

```bash
export DB_ID="db_01HG7..."
```

## 2 · Attendre qu’il soit prêt {#wait}

Le provisionnement prend 4–7 minutes. Interrogez l’API jusqu’à ce que `state` vaille `running` :

```bash
while true; do
  state=$(curl -s {{API_BASE_URL}}/v1/databases/$DB_ID \
    -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.state')
  echo "state: $state"
  [ "$state" = "running" ] && break
  sleep 10
done
```

Ou, si vous préférez recevoir un webhook, [abonnez-vous à `database.created`](/docs/webhooks#events) et passez-vous de la boucle de polling.

## 3 · Autoriser votre IP {#allowlist}

Par défaut, le cluster accepte les connexions de toute source vers laquelle il peut router. En production, il vous faut une liste d’autorisation explicite :

```bash
MY_IP=$(curl -s ifconfig.me)/32

curl -X POST {{API_BASE_URL}}/v1/databases/$DB_ID/allowlist \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"cidr\": \"$MY_IP\", \"description\": \"my laptop\" }"
```

Ajoutez une entrée par CIDR que vous voulez laisser entrer. Pour une VM qui doit atteindre cette base, ajoutez le CIDR de son IP flottante (ou celui de son NAT sortant si elle est derrière un NAT). Les entrées de la liste d’autorisation sont avec état — en supprimer une coupe les nouvelles connexions ; les connexions existantes restent ouvertes jusqu’à l’expiration de leur délai d’inactivité ou jusqu’au redémarrage du cluster.

## 4 · Se connecter {#connect}

Récupérez les informations de connexion :

```bash
curl -s {{API_BASE_URL}}/v1/databases/$DB_ID/connection \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Réponse :

```json
{
  "host": "{{DB_HOST_DEMO}}",
  "port": 5432,
  "pooler_port": 6432,
  "database": "app",
  "username": "app",
  "password": "•••• (one-time view in dashboard)",
  "tls_root_cert_url": "{{BASE_URL}}/ca-certs/nimbusnexus-root.pem"
}
```

Téléchargez une fois le certificat racine :

```bash
curl -o ~/.postgresql/nn-root.crt {{BASE_URL}}/ca-certs/nimbusnexus-root.pem
```

Connectez-vous :

```bash
psql "postgresql://app:••••@{{DB_HOST_DEMO}}:6432/app?sslmode=verify-full&sslrootcert=~/.postgresql/nn-root.crt"
```

Utilisez le port `6432` (pooler) depuis les serveurs d’application ; le port `5432` uniquement pour les outils d’administration/de migration qui ont besoin d’un accès direct au primaire (par exemple `pg_dump`, `pg_restore`, les outils de migration de schéma qui prennent des advisory locks).

`sslmode=verify-full` vérifie le certificat par rapport au nom d’hôte — le bon choix par défaut. `verify-ca` est aussi acceptable ; `require` est acceptable hors production, mais saute la vérification du nom d’hôte (et laisse donc passer toute une classe d’attaques MITM). N’utilisez jamais `prefer` ni `disable`.

## Récapitulatif {#summary}

Vous avez maintenant un cluster Postgres de qualité production :

- Trois nœuds, basculement automatique
- Sauvegardes quotidiennes + PITR sur 7 jours
- Connection pooler activé (port 6432)
- TLS obligatoire, accès restreint par liste d’autorisation
- Coût : environ $200/mois pour le tier `production-4-16` avec HA + sauvegardes sur 7 jours dans us-east-1

La même structure fonctionne pour MySQL, MongoDB, Redis, Kafka, OpenSearch — changez `engine`, changez `engine_version` : les autres options restent valables, avec des valeurs par défaut adaptées au moteur.

## Étapes suivantes {#next-steps}

- [Référence des bases de données managées](/docs/api/managed-databases) — toutes les options de l’appel de création, tous les endpoints de gestion du cluster.
- [Migrer depuis AWS RDS](/docs/guides/migrate-from-rds) — la même configuration, avec une migration de données ponctuelle depuis un cluster RDS existant.
- [Webhooks de la plateforme](/docs/webhooks) — brancher les événements `database.created`, `database.upgrade_completed` et `backup.completed` sur votre monitoring.
- [Snapshots](/docs/api/snapshots) — des copies à un instant T, à la demande, comme filet de sécurité avant un déploiement.
