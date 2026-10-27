---
title: "IP flottantes"
description: "IP publiques propres à une région, détachables d’une VM et rattachables à une autre."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# IP flottantes

Une IP flottante est une adresse IP publique qui **appartient à votre projet, pas à une VM précise**. Vous en allouez une, vous l’attachez à une VM, et elle devient l’IP publique de cette VM. Détachez-la plus tard et rattachez-la à une autre VM — votre trafic va désormais vers la nouvelle VM, sans que l’adresse change.

## Pourquoi les IP flottantes existent {#why}

L’IP attribuée par défaut à une VM est **éphémère** — détruire la VM rend l’IP au pool, et une VM recréée en reçoit une nouvelle. Cela convient aux workers sans état placés derrière un load balancer. C’est désastreux pour :

- Tout ce qui est adressé par un enregistrement DNS A/AAAA (l’enregistrement casse à chaque recréation de la VM)
- Tout ce qui figure dans la liste d’autorisation d’IP d’un partenaire (le partenaire doit autoriser la nouvelle adresse)
- Les déploiements blue/green, où vous voulez basculer le trafic entre deux VM déjà démarrées sans attendre la propagation DNS

Une IP flottante règle ces trois cas. L’IP survit à n’importe quelle VM ; vous la basculez d’une VM à l’autre en ~2 secondes avec un seul appel d’API.

## Portée régionale {#region}

Les IP flottantes sont **propres à une région**. Une IP allouée dans `us-east-1` ne peut être attachée qu’à des VM de `us-east-1`. Un basculement inter-région nécessite au choix :

- Une IP flottante par région + un basculement au niveau DNS (basé sur la latence, avec contrôles de santé)
- Un produit d’IP anycast, que nous ne proposons pas actuellement

Nous ne prévoyons pas de lever cette limite — des IP flottantes inter-région exigeraient de router des annonces BGP publiques à l’échelle mondiale, ce qui est un produit totalement différent de l’allocation par région.

## Facturation {#billing}

- **Attachée** à une VM en cours d’exécution : **\$0** — l’IP est comprise dans le coût de la VM.
- **Attachée** à une VM arrêtée : \$2.50/mois — comme la ligne d’IP réservée de la VM.
- **Non attachée** : \$2.50/mois — même tarif. Nous facturons les IP non attachées pour décourager leur accumulation, qui épuiserait le pool régional plus vite que nous ne pouvons l’agrandir.

Le schéma habituel : allouez l’IP quand vous en avez besoin, attachez-la immédiatement, libérez-la quand vous avez terminé.

## IPv4 ou IPv6 {#ipv4-ipv6}

Les IP flottantes existent dans les deux variantes. `version: 'ipv4'` est la valeur par défaut (et ce dont la plupart des gens ont besoin). `version: 'ipv6'` est allouée à partir de notre `/48` propre à chaque région ; les deux sont publiques et routables.

Une VM peut avoir à la fois une IP flottante IPv4 et une IP flottante IPv6 attachées. Plusieurs IPv4 sur une même VM ne sont pas prises en charge ; si vous avez besoin de plusieurs adresses sur une VM, utilisez des adresses privées de VPC avec du NAT.

## Sémantique d’attachement et de détachement {#attach}

- **L’attachement** est atomique : la VM obtient l’adresse en ~2 secondes. Les connexions TCP existantes vers l’ancienne IP publique de la VM (s’il y en avait une) sont coupées — la table de routage du noyau change, tout simplement.
- **Le détachement** ne libère pas l’IP ; il la dissocie seulement de la VM. L’IP reste facturée jusqu’à ce que vous appeliez DELETE.
- Rattacher la même IP à une autre VM : c’est exactement le chemin du basculement. Détachez, attachez à la nouvelle cible, le DNS ne change pas.

## Étapes suivantes {#next-steps}

- [Machines virtuelles](/docs/api/vms) — la ressource à laquelle s’attachent les IP flottantes.
- [Régions](/docs/api/regions) — les IP flottantes sont propres à une région.
- Le guide **Basculement multi-région** (bientôt disponible) décrit le schéma au niveau DNS pour le basculement inter-région quand les IP flottantes seules ne suffisent pas.
