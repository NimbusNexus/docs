---
title: "Load balancers"
description: "Répartition managée du trafic L4 / L7 sur un pool de VM backend."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Load balancers

Un load balancer place une flotte de VM derrière une seule VIP (IP virtuelle) : il répartit le trafic entre les backends et retire automatiquement de la rotation ceux qui sont défaillants. Un listener parle `TCP`, `UDP`, `SCTP`, `HTTP`, `HTTPS`, `TERMINATED_HTTPS` ou `PROMETHEUS`, et envoie tout son trafic à son pool par défaut ; il n’y a pas de règles de routage par chemin ni par header.

## Les quatre sous-ressources {#sub-resources}

Un load balancer est lui-même un conteneur ; la logique de routage réside dans des ressources imbriquées :

- **Listener** — un par couple (protocole, port) sur lequel le LB accepte du trafic. `HTTPS:443` est un listener ; `HTTP:80` en est un autre. Un même LB peut héberger de nombreux listeners.
- **Pool** — un groupe de backends, attaché à un listener (`listener_id`) ou au load balancer (`loadbalancer_id`). Chaque pool a un `protocol` (`HTTP`, `HTTPS`, `TCP`, `UDP`, `SCTP`, `PROXY` ou `PROXYV2`) et un `lb_algorithm` : `ROUND_ROBIN`, `LEAST_CONNECTIONS`, `SOURCE_IP` ou `SOURCE_IP_PORT`. Il n’y a pas de paramètre de persistance de session.
- **Membre** — un backend dans un pool : une `address` IP et un `protocol_port`, avec un `weight` (0–256, 1 par défaut).
- **Moniteur de santé** — le contrôle de santé actif de chaque pool. Les membres en échec sont retirés de la rotation jusqu’à leur rétablissement.

Chacune a ses propres endpoints, listés ci-dessous : `/api/v1/loadbalancers/`, `/api/v1/listeners/`, `/api/v1/pools/`, `/api/v1/pools/{pool_id}/members/` et `/api/v1/health_monitors/`.

## Terminaison SSL {#ssl}

Pour les listeners HTTPS, deux options s’offrent à vous :

- **TLS terminé sur le LB.** Utilisez un listener `TERMINATED_HTTPS` et faites pointer `default_tls_container_ref` (et `sni_container_refs`, pour d’autres certificats) vers un conteneur de certificats existant. Le LB sert le TLS aux clients et communique en clair avec vos VM. Cette API ne téléverse ni n’émet de certificats.
- **TLS passthrough.** Le LB fait uniquement du transfert TCP L4 ; vos VM gèrent le TLS. Nécessaire quand le backend doit voir le certificat client d’origine. Utilisez un listener `HTTPS` ou `TCP`.

## Contrôles de santé {#health-checks}

Un moniteur de santé sonde chaque membre toutes les `delay` secondes et attend une réponse pendant `timeout` secondes, une valeur inférieure à `delay` ; vous définissez les deux. Son `type` est `HTTP`, `HTTPS`, `PING`, `TCP`, `TLS-HELLO`, `UDP-CONNECT` ou `SCTP`. `GET /api/v1/loadbalancers/{loadbalancer_id}/status` affiche l’`operating_status` de chaque membre.

- Un membre est retiré de la rotation après `max_retries_down` sondes en échec (3 si vous l’omettez).
- Il revient dans la rotation après `max_retries` sondes réussies, une valeur que vous devez définir.

Pour les contrôles HTTP et HTTPS, définissez `url_path`, `http_method` et `expected_codes`. Faites pointer `url_path` vers un élément de votre application qui renvoie rapidement un corps — et évitez de faire faire un vrai travail au contrôle, sinon c’est le contrôle lui-même qui devient la charge.

## Étapes suivantes {#next-steps}

- [Machines virtuelles](/docs/api/vms) — ce qui devient membre d’un pool.
- [IP flottantes](/docs/api/floating-ips) — l’alternative pour l’accès public à une seule VM, sans LB.
- [Groupes de sécurité](/docs/api/security-groups) — le pare-feu au niveau de l’interface de la VM ; les LB respectent les groupes de sécurité des membres.
