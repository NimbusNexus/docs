---
title: "Machines virtuelles"
description: "Provisionnez, inspectez, redimensionnez et détruisez des VM. Référence des endpoints en direct, générée automatiquement à partir de la spécification OpenAPI."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Machines virtuelles

Une machine virtuelle NimbusNexus est une instance de calcul dotée d’un disque de démarrage et d’une interface réseau par réseau qu’elle rejoint. Vous en créez une avec `POST /api/v1/instance/` dans la région de votre session ; tout le reste (volumes block, IP publiques) s’y attache sous forme de ressources distinctes.

## Quand utiliser une VM {#when-to-use}

Les VM sont la bonne brique quand il vous faut :

- Un état persistant sur disque entre les requêtes (une base de données, un cache de build, un worker de file d’attente qui tourne longtemps).
- Un contrôle total de l’OS — installer des paquets, régler des paramètres du noyau, exécuter tout ce qui demande un accès système.
- Une forme d’instance précise — le nombre de vCPU et la RAM dont votre charge de travail a besoin.

Si votre charge de travail est **sans état et organisée en requêtes**, les plateformes de conteneurs (services Kubernetes managés, runtimes serverless) conviennent généralement mieux. La frontière est à peu près la suivante : si un redémarrage de processus qui effacerait les fichiers locaux vous poserait problème, il vous faut une VM.

## Forme et création {#sizes}

`POST /api/v1/instance/` prend un `name` et une `spec` qui définit la forme de la VM : `architecture` et `vm_class`, `cpu` (vCPU) et `ram` (MB), ainsi que le `volume_type` de son disque de démarrage (voir [Stockage en bloc](/docs/api/block-storage#tiers)). Il faut aussi une `image` (ou des `volumes` amorçables), au moins un `network` et au moins un `security_group`. Les champs facultatifs comprennent `sshs` (la [clé SSH](/docs/api/ssh-keys) à installer), `volume_size` (la taille du disque de démarrage en GB quand vous démarrez depuis `image` ; 5 par défaut), `user_data`, `metadata` et `subscription`. Rejoindre un réseau fournisseur exige aussi `bandwidth_mbps` et `subscription.bandwidth` ; sans eux, l’appel répond `400`.

Il n’y a pas de codes de taille. `GET /api/v1/instance/artifacts` liste dans `vm_options` les choix d’`architecture` et de `vm_class` pour la région de votre session, ainsi que les images, réseaux, groupes de sécurité, clés SSH, groupes de serveurs et volumes que vous pouvez utiliser. La VM tourne sur un [flavor](/docs/api/vm-sizes) qui a exactement vos `cpu` et `ram` ; l’API en crée un s’il n’en existe aucun. Les prix se trouvent dans [Données tarifaires](/docs/api/pricing-data).

## Cycle de vie {#lifecycle}

La création d’une VM est asynchrone : `POST /api/v1/instance/` met le travail en file d’attente et répond `{"success": true}`, sans identifiant. Retrouvez la nouvelle VM dans `GET /api/v1/instance/` et suivez son `status`, la valeur propre au service de calcul. Les valeurs que vous rencontrerez le plus souvent :

- `BUILD` — la VM est en cours de création.
- `ACTIVE` — en cours d’exécution.
- `SHUTOFF` — arrêtée.
- `VERIFY_RESIZE` — redimensionnée, en attente de votre confirmation ou de votre retour arrière (voir [Tailles de VM](/docs/api/vm-sizes#resizing)).
- `ERROR` — quelque chose a échoué ; `fault` indique quoi.

`POST /api/v1/instance/action` démarre, arrête ou supprime des VM : listez leurs identifiants dans `servers` et définissez `cmd` à `start`, `stop` ou `delete`. Une VM arrêtée reste facturée : la facturation court de la création à la suppression, selon le plan indiqué dans `subscription.vm` (`Monthly` par défaut). Supprimer une VM supprime le volume de démarrage créé à partir de son image ; les volumes passés dans `volumes`, ou attachés plus tard, restent `available`.

## Nommage et identifiants stables {#ids}

Chaque VM porte deux identifiants :

- `id` — l’UUID de la VM. Stable pendant toute la vie de la VM. Utilisez-le dans les URL, les clés étrangères, les journaux d’audit.
- `name` — lisible par un humain, n’importe quelle chaîne non vide. Modifiez-le, ou la `description`, avec `PATCH /api/v1/instance/{instance_id}`. Ne l’utilisez dans aucun chemin de code que vous ne voulez pas réécrire le jour où quelqu’un renomme la VM.

La référence des endpoints ci-dessous utilise `{instance_id}` dans les modèles de chemin (`{server_id}` sur les endpoints des [interfaces de VM](/docs/api/vm-interfaces)) ; la valeur à passer est l’`id` de la VM.
