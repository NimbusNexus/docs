---
title: "Load balancers"
description: "Répartition managée du trafic L4 / L7 sur un pool de VM backend."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Load balancers

Un load balancer place une flotte de VM derrière une seule VIP (IP virtuelle) : il répartit le trafic entre les backends et retire automatiquement de la rotation ceux qui sont défaillants. Deux variantes : **L4** (TCP / UDP / proxy-protocol) et **L7** (HTTP / HTTPS avec routage par chemin + header).

## Les quatre sous-ressources {#sub-resources}

Un load balancer est lui-même un conteneur ; la logique de routage réside dans des ressources imbriquées :

- **Listener** — un par couple (protocole, port) sur lequel le LB accepte du trafic. `HTTPS:443` est un listener ; `HTTP:80` en est un autre. Un même LB peut héberger de nombreux listeners.
- **Pool** — un groupe de VM backend, défini par listener. Chaque pool a un algorithme (`round-robin`, `least-connections`, `source-ip-hash`) et une politique de persistance de session.
- **Membre** — un backend dans un pool. Référence une VM + un port + un poids.
- **Moniteur de santé** — le contrôle de santé actif de chaque pool. Les membres en échec sont retirés de la rotation jusqu’à leur rétablissement.

Les endpoints ci-dessous agissent sur le load balancer de premier niveau. Le CRUD imbriqué des listeners/pools/membres/moniteurs de santé se trouve sous `/v1/load-balancers/{id}/listeners`, etc. (absent de cet exemple minimal — couvert par la spécification en direct).

## Terminaison SSL {#ssl}

Pour les listeners HTTPS, deux options s’offrent à vous :

- **TLS terminé sur le LB.** Téléversez un certificat (ou utilisez Let’s Encrypt via le module complémentaire cert-manager) : le LB sert le TLS aux clients et communique en clair avec vos VM. Plus simple à gérer ; permet au LB d’inspecter les headers HTTP pour le routage L7.
- **TLS passthrough.** Le LB fait uniquement du transfert TCP L4 ; vos VM gèrent le TLS. Nécessaire quand le backend doit voir le certificat client d’origine.

## Contrôles de santé {#health-checks}

Un moniteur de santé sonde chaque membre périodiquement (par défaut toutes les 10 s) sur un chemin / port configuré. Trois résultats possibles :

- **Healthy** (sain) — les 2 dernières sondes ont réussi (par défaut ; configurable). Le membre reçoit du trafic.
- **Unhealthy** (défaillant) — les 3 dernières sondes ont échoué (configurable). Le membre est retiré de la rotation ; les connexions en cours se terminent progressivement.
- **Recovering** (en rétablissement) — était défaillant, réussit de nouveau les sondes. Repasse à l’état sain après 2 sondes réussies.

Pour les contrôles de santé HTTP, le LB envoie un GET à `/healthz` (configurable) et attend un 200. Implémentez `/healthz` dans votre application pour qu’il renvoie rapidement un corps — et évitez de faire faire un vrai travail au contrôle, sinon c’est le contrôle lui-même qui devient la charge.

## Tarifs {#pricing}

Les load balancers sont facturés à un tarif fixe par heure et par région (\$0.024/hr pour le tier standard dans la référence tarifaire EN). La création de listeners / pools / membres / moniteurs de santé est gratuite. Le trafic entre LB de régions différentes compte comme de l’egress inter-région standard.

## Étapes suivantes {#next-steps}

- [Machines virtuelles](/docs/api/vms) — ce qui devient membre d’un pool.
- [IP flottantes](/docs/api/floating-ips) — l’alternative pour l’accès public à une seule VM, sans LB.
- [Groupes de sécurité](/docs/api/security-groups) — le pare-feu au niveau de l’interface de la VM ; les LB respectent les groupes de sécurité des membres.
