---
title: "IP flottantes"
description: "IP publiques propres à une région, détachables d’une VM et rattachables à une autre."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# IP flottantes

Une IP flottante est une adresse IP publique qui **appartient à votre projet, pas à une VM précise**. Vous en réservez une sur un réseau externe, vous l’allouez à un port d’une VM, et elle devient l’IP publique de cette VM. Détachez-la plus tard et rattachez-la à une autre VM — votre trafic va désormais vers la nouvelle VM, sans que l’adresse change.

## Pourquoi les IP flottantes existent {#why}

L’IP attribuée par défaut à une VM est **éphémère** — détruire la VM rend l’IP au pool, et une VM recréée en reçoit une nouvelle. Cela convient aux workers sans état placés derrière un load balancer. C’est désastreux pour :

- Tout ce qui est adressé par un enregistrement DNS A/AAAA (l’enregistrement casse à chaque recréation de la VM)
- Tout ce qui figure dans la liste d’autorisation d’IP d’un partenaire (le partenaire doit autoriser la nouvelle adresse)
- Les déploiements blue/green, où vous voulez basculer le trafic entre deux VM déjà démarrées sans attendre la propagation DNS

Une IP flottante règle ces trois cas. L’IP survit à n’importe quelle VM ; vous la basculez d’une VM à l’autre avec un seul appel d’API.

## Portée régionale {#region}

Les IP flottantes sont **propres à une région**. Une IP provient du réseau externe d’une région et ne s’attache qu’à des ports de cette région.

## Facturation {#billing}

Une IP flottante est facturée à son propre prix, de sa création à sa suppression, qu’elle soit attachée ou non. L’attacher à une VM ne l’intègre pas au coût de la VM. [Données tarifaires](/docs/api/pricing-data) indique le prix actuel.

Le schéma habituel : créez l’IP quand vous en avez besoin, attachez-la aussitôt, et supprimez-la quand vous avez terminé.

## IPv4 ou IPv6 {#ipv4-ipv6}

Il n’y a pas de champ de version : une adresse provient du réseau externe que vous indiquez dans `floating_network_id`, et `POST /api/v1/floating_ip/reserve` peut aussi prendre une `ip_address` précise. `GET /api/v1/floating_ip/artifacts` liste les réseaux externes avec l’`ip_version` de chaque sous-réseau.

Chaque IP flottante se lie à une IP fixe sur un port (`vm_port_id` et `vm_ip_address`) : une VM qui a plusieurs IP fixes peut donc porter une IP flottante sur chacune.

## Sémantique d’attachement et de détachement {#attach}

- **L’attachement** passe par `POST /api/v1/floating_ip/allocate`, avec le réseau externe (`floating_network_id`), le port (`vm_port_id`) et son IP fixe (`vm_ip_address`). Passez `floating_ip_id` pour attacher une adresse que vous avez déjà ; sans lui, allocate en crée une nouvelle. `GET /api/v1/floating_ip/artifacts?resource_id=<id>` liste les ports d’une VM ou d’un load balancer.
- **Le détachement** passe par `POST /api/v1/floating_ip/deallocate`. Il ne libère pas l’IP ; il la dissocie seulement de la VM. L’IP reste facturée jusqu’à ce que vous la supprimiez, avec `DELETE /api/v1/floating_ip/` (son identifiant dans `ids`) ou avec `deallocate` et `delete: true`.
- Rattacher la même IP à une autre VM : c’est exactement le chemin du basculement. Détachez, attachez à la nouvelle cible, le DNS ne change pas.

## Étapes suivantes {#next-steps}

- [Machines virtuelles](/docs/api/vms) — la ressource à laquelle s’attachent les IP flottantes.
- [Régions](/docs/api/regions) — les IP flottantes sont propres à une région.
