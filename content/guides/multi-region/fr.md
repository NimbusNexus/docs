---
title: "Basculement multi-région"
description: "Basculement au niveau DNS entre deux régions, avec un routage piloté par des contrôles de santé. RTO de ~30 s."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Basculement multi-région

Les IP flottantes sont propres à une région — elles ne peuvent pas passer d’une région à l’autre. Pour un basculement inter-région (panne d’une région entière, dégradation de la latence dans une région), la bonne brique est le routage au niveau DNS avec des contrôles de santé. Le routage par latence envoie chaque utilisateur vers sa région saine la plus proche ; en cas de panne régionale, la couche DNS retire cette région de la rotation.

RTO visé avec cette configuration : **20–60 secondes**, selon le TTL et la rapidité avec laquelle vos résolveurs DNS refont leurs requêtes.

## Ce que vous allez mettre en place {#overview}

```text
                    your customers
                          │
                  app.example.com  ← DNS A record set
                          │
            ┌─────────────┴─────────────┐
            ↓                           ↓
       us-east-1                   eu-central-1
   (203.0.113.5/32)             (198.51.100.5/32)
        VM-A                        VM-B
        │                            │
        └─ replicated DB ───────────┘
              (logical replication)
```

Le DNS résout vers la région la plus proche du résolveur. Si une région échoue à son contrôle de santé, le DNS cesse de renvoyer l’IP de cette région jusqu’à ce qu’elle soit rétablie.

## Prérequis {#prereqs}

- Deux VM dans des régions différentes, chacune derrière une [IP flottante](/docs/api/floating-ips).
- Votre application qui tourne sur les deux VM, prête à servir du trafic.
- Une base de données ou un stockage avec état présent dans les deux régions, répliqué entre elles. Pour Postgres, la [réplication logique, comme pour la migration depuis RDS](/docs/guides/migrate-from-rds), est la même brique. Pour Redis, dupliquez les cache misses ; pour le stockage objet, utilisez la [réplication inter-région](/docs/api/object-storage#cross-region).
- Une zone DNS hébergée sur le DNS NimbusNexus (ou chez tout fournisseur DNS qui prend en charge les jeux d’enregistrements avec contrôles de santé — Route53, Cloudflare, etc.).
- Un endpoint de contrôle de santé qui vérifie réellement que votre application peut servir du trafic (pas seulement un `200 OK` sur `/healthz`).

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export ZONE_ID="zone_01HG7..."
export EAST_IP_ID="ip_01HG7Y3..."      # floating IP in us-east-1
export WEST_IP_ID="ip_01HG7Y4..."      # floating IP in eu-central-1
```

## 1 · Créer le jeu d’enregistrements multivaleur {#record-set}

Ajoutez un jeu d’enregistrements A avec les IP des deux régions, routé par latence :

```bash
EAST_IPV4=$(curl -s {{API_BASE_URL}}/v1/floating-ips/$EAST_IP_ID \
  -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.ipv4')

WEST_IPV4=$(curl -s {{API_BASE_URL}}/v1/floating-ips/$WEST_IP_ID \
  -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.ipv4')

curl -X POST {{API_BASE_URL}}/v1/dns/zones/$ZONE_ID/records \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"app.example.com\",
    \"type\": \"A\",
    \"routing_policy\": \"latency\",
    \"ttl\": 60,
    \"values\": [
      { \"value\": \"$EAST_IPV4\", \"region\": \"us-east-1\" },
      { \"value\": \"$WEST_IPV4\", \"region\": \"eu-central-1\" }
    ]
  }"
```

Champs clés :

- `routing_policy: 'latency'` — les résolveurs DNS reçoivent l’IP de la région géographiquement la plus proche. Alternatives : `'weighted'` (répartition en pourcentage), `'failover'` (primaire/secondaire, jamais de round-robin), `'geo'` (routage selon le pays du client).
- `ttl: 60` — TTL de 60 secondes. TTL plus bas = basculement plus rapide (les résolveurs refont leurs requêtes plus tôt), au prix de davantage de requêtes DNS. Pour un service aux besoins de haute disponibilité, 60 est la bonne valeur ; pour des configurations au SLA moins exigeant, 300 convient.

## 2 · Ajouter des contrôles de santé {#health-checks}

Chaque valeur du jeu d’enregistrements reçoit un contrôle de santé. Les contrôles en échec retirent cette valeur de la rotation :

```bash
curl -X POST {{API_BASE_URL}}/v1/dns/zones/$ZONE_ID/records/$RECORD_ID/health-checks \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "value_index": 0,
    "type": "https",
    "path": "/healthz",
    "expected_status": 200,
    "interval_seconds": 10,
    "failure_threshold": 3,
    "success_threshold": 2
  }'
```

Répétez pour `value_index: 1` (la seconde région). Le rôle de chaque champ :

- `interval_seconds: 10` — un contrôle toutes les 10 secondes.
- `failure_threshold: 3` — trois échecs consécutifs avant de considérer la valeur comme hors service. Combiné à `interval_seconds`, cela fait 30 secondes avant qu’une région ne sorte de la rotation — un peu au-dessus du seuil des micro-coupures réseau, bien en dessous de « nous le voyons déjà dans PagerDuty ».
- `success_threshold: 2` — deux succès consécutifs avant de considérer la valeur comme rétablie. Évite les oscillations pendant un rétablissement instable.

L’endpoint de contrôle de santé compte. Ne lui faites pas faire `return 200 OK` sans condition — cela n’aurait aucun intérêt. Faites-lui vérifier réellement les dépendances en aval (connexion à la base de données, cache, file d’attente), pour qu’il échoue quand l’application échouerait.

## 3 · Tester {#test}

Provoquez une « panne » en bloquant la sonde de contrôle de santé dans une région :

```bash
# On the us-east-1 VM, drop traffic from the health-check source CIDR
sudo iptables -A INPUT -s <healthcheck-cidr> -j DROP
```

(Récupérez les CIDR sources des contrôles de santé avec `GET /v1/dns/healthcheck-source-cidrs`.)

En moins de 30 secondes, le jeu d’enregistrements devrait cesser de renvoyer l’IP de us-east-1 :

```bash
dig +short app.example.com
# Should return only the eu-central-1 IP for the next several seconds
```

Annulez la règle iptables pour rétablir la région. En moins de 20 secondes (`2 * interval_seconds`), elle devrait revenir dans la rotation.

## 4 · Réplication de la base de données {#db}

La couche DNS décide où arrive le trafic ; la couche de données est plus délicate. Les modèles :

**Pour les charges majoritairement en lecture :**

- Base primaire dans une région, réplica en lecture dans l’autre.
- L’application lit dans la région locale (le réplica quand elle est dans la région secondaire).
- Les écritures vont toujours vers le primaire (la région secondaire a donc une latence d’écriture plus élevée).
- En cas de panne de la région primaire : promouvez le réplica en primaire, et basculez lectures + écritures vers le nouveau primaire.

**Pour les charges à forte écriture qui tolèrent le multi-maître :**

- Utilisez une base de données qui prend en charge la réplication actif-actif (CockroachDB, YugabyteDB).
- Les deux régions lisent + écrivent localement ; les conflits sont résolus par le moteur.
- Plus complexe à exploiter ; ne se justifie que si la latence d’écriture en mono-maître pose un vrai problème.

**Pour le cache et la file d’attente :**

- Cache : partez du principe que le cache est froid après le basculement. La plupart des applications s’en remettent en quelques minutes ; l’impact sur le SLA est tolérable.
- File d’attente : gardez une file par région ; l’application accepte qu’une file régionale soit indisponible jusqu’au rétablissement de la région.

NimbusNexus ne propose pas encore de base de données actif-actif multi-région. Pour l’instant, gérez la réplication vous-même via la réplication logique (Postgres), le binlog (MySQL) ou les change streams (MongoDB).

## Ce que ce n’est pas {#not}

- **Pas un basculement actif-actif pour l’état** : les écritures restent concentrées sur un seul primaire. La couche DNS oriente les utilisateurs ; la couche base de données reste mono-maître la plupart du temps.
- **Pas transparent pour les clients** : les connexions TCP vers l’IP de la région en panne sont réinitialisées ; les clients se reconnectent (la plupart des clients HTTP le gèrent bien ; certains clients en long polling ou SSE ont besoin d’un handler de réessai).
- **Pas un RTO nul** : 20–60 secondes, c’est le plancher avec TTL = 60. Un TTL plus bas aide, mais au prix d’un volume de requêtes DNS plus élevé.

## Étapes suivantes {#next-steps}

- [Zones DNS](/docs/api/dns-zones) — l’API des zones, qui contiennent le jeu d’enregistrements.
- [Enregistrements DNS](/docs/api/dns-records) — toutes les politiques de routage + la sémantique des champs.
- [IP flottantes](/docs/api/floating-ips) — la brique de basculement intra-région sur laquelle tout cela repose.
- [Déploiements blue/green avec IP flottantes](/docs/guides/blue-green) — la même idée, au sein d’une région.
