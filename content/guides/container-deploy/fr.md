---
title: "Modèles de déploiement de conteneurs"
description: "Une seule VM, Docker géré par systemd, derrière une IP flottante. Le modèle qui couvre 80 % des cas."
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: guide
---

# Modèles de déploiement de conteneurs

NimbusNexus ne propose pas (encore) de service Kubernetes managé. Le modèle qui couvre 80 % des cas pour exécuter ici un petit nombre de services conteneurisés : une VM par service, Docker comme runtime de conteneurs, systemd comme superviseur, une IP flottante pour l’adresse publique. Simple, observable, facile à déboguer.

Ce guide présente le modèle de référence. Pour des services à grande échelle où vous avez vraiment besoin d’orchestration (>10 services qui interagissent, routage de trafic complexe, autoscaling), apportez votre propre Kubernetes (k3s ou k0s sur un petit cluster de VM, ou une offre managée ailleurs) ; cela sort du cadre de cette page.

## Ce que vous aurez à la fin {#overview}

- Une VM qui exécute votre conteneur sous systemd
- Une [IP flottante](/docs/api/floating-ips) qui pointe vers elle
- Des logs envoyés dans journald (et, de là, où vous voulez)
- Une méthode propre de déploiement progressif pour les mises à jour du code

## 1 · Provisionner une VM {#vm}

Choisissez une taille adaptée à votre service. Pour la plupart des charges API/web sans état, un vCPU et 2 GB de RAM sont un bon point de départ — passez à une taille supérieure si nécessaire. [Démarrage rapide](/docs/quickstart#region) montre d’où viennent l’image, le réseau, le groupe de sécurité et les valeurs de `spec`. Le groupe de sécurité doit laisser entrer SSH et le port de votre service ([Groupes de sécurité](/docs/api/security-groups)), et `sshs` nomme une [clé SSH](/docs/api/ssh-keys) que vous avez enregistrée.

```bash
export SSH_KEY_NAME="<ssh-key-name>"
USER_DATA='#!/bin/bash\napt-get update && apt-get install -y docker.io'

curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"api-prod\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 1,
      \"ram\": 2048,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 25,
    \"network\": [\"$NETWORK_ID\"],
    \"security_group\": [\"$SECURITY_GROUP_ID\"],
    \"sshs\": \"$SSH_KEY_NAME\",
    \"user_data\": \"$USER_DATA\"
  }"
```

`user_data` s’exécute au premier démarrage — ici, il installe Docker. La VM atteint `ACTIVE` avant la fin de ce script : laissez-lui donc une minute ou deux.

L’appel répond sans identifiant. Retrouvez la VM par son nom et vérifiez que son `status` a atteint `ACTIVE` :

```bash
export VM_ID=$(curl -s {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq -r '.data[] | select(.name == "api-prod") | .id')

curl -s {{API_BASE_URL}}/api/v1/instance/$VM_ID \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data.status'
```

## 2 · Allouer une IP flottante {#floating-ip}

Le réseau de la VM a besoin d’un [routeur](/docs/api/routers) vers le réseau externe. Lisez ce dont l’appel suivant a besoin, le réseau externe ainsi que le port et l’IP fixe de la VM :

```bash
curl -s "{{API_BASE_URL}}/api/v1/floating_ip/artifacts?resource_id=$VM_ID" \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '{ networks: [.data.floating_networks.data[] | { id, name }], interfaces: .data.interfaces.data }'
```

```bash
export FLOATING_NETWORK_ID="<external-network-id>"
export PORT_ID="<port-id>"
export FIXED_IP="<fixed-ip>"
```

Puis allouez l’IP. Une nouvelle IP flottante a besoin d’un plan et d’un plafond de bande passante : `bandwidth_mbps` est un multiple de 10, et la bande passante est facturée ([Données tarifaires](/docs/api/pricing-data)).

```bash
export PUBLIC_IP=$(curl -s -X POST {{API_BASE_URL}}/api/v1/floating_ip/allocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"floating_network_id\": \"$FLOATING_NETWORK_ID\",
    \"vm_port_id\": \"$PORT_ID\",
    \"vm_ip_address\": \"$FIXED_IP\",
    \"bandwidth_subscription\": \"Monthly\",
    \"bandwidth_mbps\": 100
  }" | jq -r '.data.ip_address')
```

L’IP s’attache à la VM et devient son adresse publique.

Faites pointer votre DNS vers elle ([Enregistrements DNS](/docs/api/dns-records) ou votre registrar actuel).

## 3 · Construire + pousser votre image de conteneur {#image}

Construisez votre image de conteneur où vous voulez (en local, en CI). Poussez-la vers le registre de votre choix :

- **Docker Hub** — gratuit pour les images publiques.
- **GitHub Container Registry** (`ghcr.io`) — gratuit pour les dépôts publics, inclus avec GitHub.
- **Stockage objet NimbusNexus** — si vous préférez l’auto-hébergement, poussez des tarballs vers un conteneur privé de stockage objet et récupérez-les dans l’unité systemd (la gestion des tags demande un peu plus de travail).

Dans ce guide, nous utilisons `ghcr.io/yourorg/api:v1.4.2`.

## 4 · Configurer l’unité systemd sur la VM {#systemd}

Connectez-vous à la VM en SSH :

```bash
ssh ubuntu@$PUBLIC_IP
```

Créez le fichier d’unité `/etc/systemd/system/api.service` :

```ini
[Unit]
Description=API container
After=docker.service network-online.target
Requires=docker.service

[Service]
Restart=always
RestartSec=5
TimeoutStartSec=60

# Pull the image; ignore failures (we'll retry on next start)
ExecStartPre=-/usr/bin/docker pull ghcr.io/yourorg/api:v1.4.2
# Stop any existing container; ignore failure (no container = fine)
ExecStartPre=-/usr/bin/docker stop api
ExecStartPre=-/usr/bin/docker rm api

ExecStart=/usr/bin/docker run \
  --name api \
  --rm \
  --network host \
  --env-file /etc/api/env \
  ghcr.io/yourorg/api:v1.4.2

ExecStop=/usr/bin/docker stop api

[Install]
WantedBy=multi-user.target
```

Quelques remarques :

- **`--network host`** — le conteneur se lie directement au réseau de la VM. Plus simple que le réseau bridge par défaut ; convient à une configuration à un seul conteneur. Ne l’utilisez pas si vous exécutez plusieurs conteneurs qui doivent communiquer entre eux sur des ports privés.
- **`--rm`** — supprime le conteneur après sa sortie. Combiné à `Restart=always`, systemd le relance en cas de crash.
- **`--env-file /etc/api/env`** — charge les secrets + la configuration depuis un fichier. Ce fichier ne doit être lisible que par root (`chmod 600`).
- **`Restart=always`** — systemd relance le conteneur en cas de crash. Un `RestartSec` de cinq secondes évite les boucles de crash rapprochées.

Mettez vos secrets dans `/etc/api/env` :

```env
DATABASE_URL=postgresql://app:••••@10.0.2.10:5432/app?sslmode=require
NIMBUS_KEY=<your-api-key>
JWT_SECRET=...
```

Activez et démarrez :

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now api.service
```

## 5 · Vérifier que le service répond {#verify}

```bash
curl http://$PUBLIC_IP/healthz
```

Si vous voyez la réponse de votre service, c’est terminé.

## 6 · Déploiements progressifs {#deploys}

Pour déployer une nouvelle version, il suffit de mettre à jour le tag de l’image dans le fichier d’unité et de redémarrer :

```bash
sudo sed -i 's|api:v1.4.2|api:v1.4.3|g' /etc/systemd/system/api.service
sudo systemctl daemon-reload
sudo systemctl restart api.service
```

Cela provoque une coupure de 1–2 secondes (arrêt du conteneur → pull de l’image → démarrage du nouveau conteneur).

Pour un déploiement sans interruption, utilisez le [modèle blue/green](/docs/guides/blue-green) : deux VM, deux conteneurs, et l’IP flottante passe de l’une à l’autre au moment de la bascule.

## 7 · Logs {#logs}

Les sorties stdout/stderr du conteneur arrivent automatiquement dans journald :

```bash
sudo journalctl -u api.service -f
```

Pour conserver les logs plus longtemps, envoyez-les depuis journald là où vous stockez vos logs :

- **systemd-journal-remote** — envoi intégré vers une autre machine systemd.
- **Vector** — envoi de logs vers plusieurs sorties.
- **Promtail + Loki** — agrégation de logs de la stack Grafana.

## Pourquoi ce modèle plutôt que Kubernetes {#why}

**Pour un seul service :** Kubernetes, c’est 80 % de surcoût. Le control plane, le scheduler, les manifestes YAML — tout cela pour exécuter un seul conteneur. Systemd fait le même travail en 30 lignes.

**Pour deux services :** toujours non. Deux VM, deux unités systemd. Le trafic entre services passe par les IP flottantes publiques (ou par un [réseau](/docs/api/networks) privé si vous voulez les garder hors d’internet).

**À partir de cinq services :** le rapport surcoût/valeur s’inverse. À ce stade, envisagez Kubernetes (k3s sur un petit cluster de VM est un compromis pragmatique) ou Nomad (plus léger que k8s, conçu pour cette taille).

## Ce que ce modèle ne fait pas {#limitations}

- **Pas d’autoscaling.** Vous ajoutez de la capacité en créant une VM (`POST /api/v1/instance/`) et vous en retirez en supprimant une VM (`POST /api/v1/instance/action`). Convient aux charges stables ; inadapté aux charges qui suivent les variations du trafic.
- **Pas de découverte de services.** Les services se trouvent via des IP publiques connues ou le DNS — pas via des résolutions internes au cluster. Pour deux ou trois services, cela suffit ; au-delà, il vous faut un registre.
- **Pas de redémarrage piloté par des contrôles de santé, au-delà du code de sortie du conteneur.** systemd redémarre en cas de crash ; il ne redémarre pas quand « le processus tourne mais n’est pas en bonne santé ». Ajoutez votre propre watchdog (un sidecar qui appelle `/healthz` et envoie `kill -1` au conteneur en cas d’échec) si vous en avez besoin.

## Étapes suivantes {#next-steps}

- [Déploiements blue/green avec IP flottantes](/docs/guides/blue-green) — la version sans interruption du déploiement décrit ci-dessus.
- [Machines virtuelles](/docs/api/vms) — toutes les options de l’appel de création.
- [Surveiller une flotte de VM](/docs/guides/monitoring-vms) — mise en place de Prometheus + Grafana.
