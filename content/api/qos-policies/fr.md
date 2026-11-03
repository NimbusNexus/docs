---
title: "Politiques QoS"
description: "Limites de bande passante, marquage DSCP et règles de bande passante minimale pour les ports, les réseaux, les passerelles de routeurs et les VIP de load balancers."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: qos-policies
---

# Politiques QoS

Une politique QoS regroupe un ensemble de règles de qualité réseau — plafonds de bande passante, marquage DSCP des paquets et règles de bande passante minimale — et les applique à des [ports réseau](/docs/api/network-ports), à des réseaux entiers, à des passerelles de routeurs ou à des VIP de load balancers, via leur `qos_policy_id` (pour un load balancer, `vip_qos_policy_id`). La règle la plus courante est une **limite de bande passante** (plafonner le débit d’un port à 100 Mbps, par exemple, pour éviter qu’une charge de travail incontrôlée sature les liaisons montantes partagées).

Le marquage DSCP ajoute des indications de priorité aux paquets qui sortent d’un port — utile quand les réseaux en aval (votre bureau, le réseau d’un partenaire) tiennent compte du DSCP pour la mise en forme du trafic. Une règle de bande passante minimale demande au moins `min_kbps` dans une `direction` donnée.

Pour les charges de travail courantes, vous n’avez pas besoin de votre propre politique. NimbusNexus attache déjà une politique de limite de bande passante lorsque vous créez une VM sur le réseau externe ou que vous donnez une passerelle externe à un routeur, dimensionnée selon le `bandwidth_mbps` que vous avez choisi. `POST /api/v1/bandwidth/resize` modifie la limite d’un port, d’une IP flottante ou d’une passerelle de routeur, et sa facturation avec elle. Appliquez des politiques quand vous avez un besoin précis de mise en forme du trafic — en général pour la conformité, pour des charges de travail sensibles à la latence ou pour réduire l’effet des voisins bruyants.

## Étapes suivantes {#next-steps}

- [Ports réseau](/docs/api/network-ports) — l’un des éléments auxquels s’attachent les politiques QoS.
- [Réseaux](/docs/api/networks) et [Sous-réseaux](/docs/api/subnets) — le modèle réseau dans son ensemble.
