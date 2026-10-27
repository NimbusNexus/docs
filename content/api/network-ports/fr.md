---
title: "Ports réseau"
description: "Ports L2/L3 sur un réseau. La brique de plus bas niveau à laquelle se lient les interfaces de VM et les load balancers."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: network-ports
---

# Ports réseau

Un port réseau est le point de connexion entre un réseau et ce qui l’utilise — une VM, un load balancer, un routeur. La plupart des utilisateurs ne gèrent pas les ports directement : ils créent une VM avec un rattachement réseau, et le port est créé en coulisses. Les endpoints de cette page servent aux cas où vous avez réellement besoin d’un contrôle direct : pré-allouer un port + une IP avant de lancer une VM, attacher un load balancer à une IP connue précise, ou migrer l’IP d’un service d’un hôte à un autre.

Les ports portent une adresse MAC, une ou plusieurs adresses IP sur le sous-réseau parent et, en option, des [groupes de sécurité](/docs/api/security-groups) qui filtrent le trafic entrant et sortant. Ils ont un état propre — un port subsiste si vous supprimez la VM à laquelle il était attaché, prêt à être rattaché à une VM de remplacement.

## Étapes suivantes {#next-steps}

- [Interfaces de VM](/docs/api/vm-interfaces) — la couche de plus haut niveau, du type « attacher ceci à une VM », qui crée des ports en coulisses.
- [Réseaux](/docs/api/networks) et [Sous-réseaux](/docs/api/subnets) — ce dans quoi vivent les ports.
- [Groupes de sécurité](/docs/api/security-groups) — ce qui filtre le trafic des ports.
