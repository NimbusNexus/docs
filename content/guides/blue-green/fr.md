---
title: "Déploiements blue/green avec IP flottantes"
description: "Des déploiements sans interruption en basculant une IP flottante entre deux VM déjà démarrées."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Déploiements blue/green avec IP flottantes

Le modèle blue/green classique : faites tourner la production actuelle derrière une IP flottante, construisez la nouvelle version sur une VM séparée, lancez des smoke tests sur celle-ci tant qu’elle n’est pas encore exposée au public, puis basculez l’IP flottante de l’ancienne VM vers la nouvelle. Le trafic bascule en ~2 secondes. En cas de problème, rebasculez l’IP.

Ce guide suppose une charge de travail sur une seule VM (une VM de production, une VM de staging). Pour des charges sur plusieurs VM derrière un load balancer, voir [Load balancers](/docs/api/load-balancers) — le même modèle s’applique, mais vous échangez plutôt les pools de cibles du LB.

## Prérequis {#prereqs}

- Deux VM dans la même région. Nous les appellerons `blue` (en service actuellement) et `green` (version suivante).
- Une [IP flottante](/docs/api/floating-ips) actuellement attachée à `blue`.
- Un enregistrement DNS A qui pointe vers l’IP flottante.
- La CLI `nimbus` installée, ou curl avec $NIMBUS_KEY défini.

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export BLUE_ID="vm_01HG7Y3..."     # currently serving
export GREEN_ID="vm_01HG7Y4..."    # new version
export FLOATING_IP_ID="ip_01HG7..."
```

## 1 · Construire la VM green {#build-green}

Démarrez la nouvelle version avec le code et la configuration mis à jour, mais sans attacher l’IP flottante. À ce stade, c’est une VM autonome avec une IP publique par défaut ; rien en production ne l’atteint.

Déployez-y votre application, lancez les migrations de base de données (si elles assurent la compatibilité ascendante, dite forward compatibility — voir « migrations de schéma » ci-dessous), préchauffez les caches et exécutez tout le travail de démarrage qui doit avoir lieu avant l’arrivée du trafic.

## 2 · Lancer les smoke tests sur green {#smoke}

Appelez directement l’IP publique par défaut de green :

```bash
GREEN_IP=$(curl -s {{API_BASE_URL}}/v1/vms/$GREEN_ID \
  -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.ipv4')

curl -H "Host: app.example.com" "http://$GREEN_IP/healthz"
curl -H "Host: app.example.com" "http://$GREEN_IP/api/critical-endpoint"
```

Le header `Host` vous permet de tester les comportements qui dépendent du nom d’hôte canonique (par exemple le routage, CORS ou tout ce qui repose sur un certificat épinglé) sans modifier le DNS. Si votre service exige HTTPS et que vous avez épinglé un certificat sur `app.example.com`, installez ce certificat sur green à l’avance (Let’s Encrypt avec un challenge HTTP-01 sur l’IP par défaut de green fonctionne).

Lancez tous les autres tests que vous feriez avant une mise en production :

- Suite complète de smoke tests
- Vérification de la connectivité à la base de données (surtout si green passe par une configuration de connection pooler différente)
- Vérification de signature des webhooks (si vous avez fait tourner le secret)

## 3 · Basculer l’IP flottante {#swing}

C’est la bascule. Un seul appel d’API :

```bash
curl -X POST {{API_BASE_URL}}/v1/floating-ips/$FLOATING_IP_ID/attach \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"vm_id\": \"$GREEN_ID\" }"
```

Ce qui se passe :

- L’IP flottante se détache de `blue` (qui l’avait parmi ses adresses publiques)
- L’IP flottante s’attache à `green`
- La propagation réseau prend ~2 secondes ; l’IP commence à servir depuis green
- Les connexions TCP vers l’IP de l’ancienne VM restent ouvertes jusqu’à l’expiration de leur délai d’inactivité (en général 30–60 secondes pour le keepalive HTTP) ; les nouvelles connexions arrivent sur green

Pour la plupart des charges HTTP, la bascule se fait en pratique sans interruption. Les connexions existantes terminent leurs requêtes sur blue ; les nouvelles requêtes arrivent sur green. Les utilisateurs sur des connexions longues (SSE, WebSocket) sont reconnectés automatiquement par leurs clients.

## 4 · Surveiller green sous trafic {#watch}

Suivez les logs de green en continu, surveillez les taux d’erreur et le graphique des requêtes dans la console. C’est ici qu’apparaissent les anomalies du trafic réel que les smoke tests n’ont pas détectées.

La fenêtre pendant laquelle un retour arrière coûte peu correspond aux ~5 premières minutes. Au-delà, blue « exécute l’ancien code sans trafic » et vous la payez ; vous voudrez alors soit :

- Promouvoir green et arrêter blue (le cas nominal)
- Arrêter les deux et tout recommencer (rare)

## 5 · Arrêter blue {#stop-blue}

Si tout est au vert (c’est le cas de le dire), arrêtez blue pour ne plus la payer :

```bash
curl -X POST {{API_BASE_URL}}/v1/vms/$BLUE_ID/stop \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Ne lancez pas `delete` tout de suite. Les VM arrêtées coûtent ~10 % du prix des VM en marche (stockage uniquement), et vous pouvez les relancer avec `start` comme retour arrière rapide pendant ~24 heures. Après 24 heures, supprimez-les.

## Procédure de retour arrière {#rollback}

Si green se comporte mal sous trafic, le retour arrière est symétrique :

```bash
curl -X POST {{API_BASE_URL}}/v1/floating-ips/$FLOATING_IP_ID/attach \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"vm_id\": \"$BLUE_ID\" }"
```

Mêmes ~2 secondes, et le trafic revient sur blue. Les retours arrière deviennent plus difficiles si vos migrations de base de données n’assuraient pas la compatibilité ascendante — découplez les migrations de schéma des déploiements de code, et vous gardez la possibilité de revenir en arrière.

## Migrations de schéma {#migrations}

Le modèle qui permet au blue/green de bien fonctionner avec des changements de schéma : **découpler la migration du déploiement**.

Chaque changement de schéma se fait en deux PR, à une semaine d’intervalle :

1. **PR de migration.** Une migration de schéma rétrocompatible. Nouvelles tables, nouvelles colonnes nullables, nouveaux index. L’ancien code fonctionne toujours avec le nouveau schéma. Déployez-la par le circuit habituel (pas besoin de blue/green — la rétrocompatibilité signifie que la migration peut être livrée seule sans risque).
2. **PR de code.** Le code qui utilise le nouveau schéma. Déployez-la en blue/green.

Quand vous devez supprimer une colonne ou changer un type, la séquence est inversée : le code cesse d’utiliser la colonne → déploiement du code → la migration supprime la colonne. Toujours deux PR séparées dans le temps. Toujours un état intermédiaire sûr, quelle que soit la durée de la pause.

Ce modèle demande plus de travail que « toujours déployer schéma + code ensemble », mais il préserve la sécurité du retour arrière, qui est justement la raison d’être du blue/green.

## Étapes suivantes {#next-steps}

- [Référence des IP flottantes](/docs/api/floating-ips) — tous les endpoints de la ressource qui rend ce modèle possible.
- [Load balancers](/docs/api/load-balancers) — la version multi-VM du même modèle.
- [Basculement multi-région](/docs/guides/multi-region) — la même idée, appliquée à des paires géographiquement éloignées.
