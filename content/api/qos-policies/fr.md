---
title: "Politiques QoS"
description: "Limites de bande passante, marquage DSCP et bande passante minimale garantie, appliqués aux ports réseau."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: qos-policies
---

# Politiques QoS

Une politique QoS regroupe un ensemble de règles de qualité réseau — plafonds de bande passante, marquage DSCP des paquets et réservations de bande passante minimale — et les applique à un ou plusieurs [ports réseau](/docs/api/network-ports). La règle la plus courante est une **limite de bande passante** (plafonner le débit d’un port à 100 Mbps, par exemple, pour éviter qu’une charge de travail incontrôlée sature les liaisons montantes partagées).

Le marquage DSCP ajoute des indications de priorité aux paquets qui sortent d’un port — utile quand les réseaux en aval (votre bureau, le réseau d’un partenaire) tiennent compte du DSCP pour la mise en forme du trafic. Les réservations de bande passante minimale garantissent à un port au moins N Mbps, même en cas de contention — utile pour la téléphonie et les charges de travail en temps réel.

Pour les charges de travail courantes, la valeur par défaut (aucune politique QoS) convient. Appliquez des politiques quand vous avez un besoin précis de mise en forme du trafic — en général pour la conformité, pour des charges de travail sensibles à la latence ou pour réduire l’effet des voisins bruyants.

## Étapes suivantes {#next-steps}

- [Ports réseau](/docs/api/network-ports) — ce à quoi s’attachent les politiques QoS.
- [Réseaux](/docs/api/networks) et [Sous-réseaux](/docs/api/subnets) — le modèle réseau dans son ensemble.
