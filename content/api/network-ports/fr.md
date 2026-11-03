---
title: "Ports réseau"
description: "Ports L2/L3 sur un réseau. La brique de plus bas niveau à laquelle se lient les interfaces de VM et les load balancers."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: network-ports
---

# Ports réseau

Un port réseau est le point de connexion entre un réseau et ce qui l’utilise — une VM, un load balancer, un routeur. La plupart des utilisateurs ne gèrent pas les ports directement : ils créent une VM avec un rattachement réseau, et le port est créé en coulisses. Les endpoints de cette page servent aux cas où vous avez réellement besoin d’un contrôle direct : créer un port avec une IP connue et l’attacher à une VM en cours d’exécution, attacher un load balancer à une IP connue précise, ou migrer l’IP d’un service d’un hôte à un autre.

Les ports portent une adresse MAC, une ou plusieurs adresses IP sur le sous-réseau parent et, en option, des [groupes de sécurité](/docs/api/security-groups) qui filtrent le trafic entrant et sortant. Un port que vous créez vous-même survit à la VM à laquelle il est attaché, prêt pour une VM de remplacement ; les ports qu’une VM reçoit lorsqu’elle est créée sur un réseau sont supprimés avec elle. Un port sur le réseau externe est facturé jusqu’à ce que vous le supprimiez (voir [Données tarifaires](/docs/api/pricing-data)).

La création d’une VM ne prend que des réseaux (`network`) : un port que vous avez créé rejoint donc une VM après son lancement, avec `POST /api/v1/instance/{server_id}/interfaces/` et son `port_id`.

## Étapes suivantes {#next-steps}

- [Interfaces de VM](/docs/api/vm-interfaces) — la couche de plus haut niveau, du type « attacher ceci à une VM », qui crée des ports en coulisses.
- [Réseaux](/docs/api/networks) et [Sous-réseaux](/docs/api/subnets) — ce dans quoi vivent les ports.
- [Groupes de sécurité](/docs/api/security-groups) — ce qui filtre le trafic des ports.
