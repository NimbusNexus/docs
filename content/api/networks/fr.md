---
title: "Réseaux"
description: "Domaines de diffusion L2 auxquels s’attachent les VM et les load balancers. La brique de base du VPC d’un projet."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Réseaux

Un réseau est un domaine de diffusion L2 virtuel au sein d’une région. Les VM et les load balancers s’attachent à un **réseau** par l’intermédiaire de ports, et l’adresse de chaque port provient de l’un des **sous-réseaux** du réseau.

## Deux variantes {#flavors}

| Variante | Créé par | Routable vers internet | Utilisé pour |
| --- | --- | --- | --- |
| **Externe** | Provisionné automatiquement dans chaque région ; partagé | Oui — directement, ou via les IP flottantes | La liaison montante par défaut de la plupart des charges de travail |
| **Tenant** | Vous, dans le projet | Pas directement — nécessite un routeur | VPC privé, applications multi-tiers, services uniquement internes |

Le réseau externe de chaque région est partagé entre tous les projets de cette région. Son identifiant est un UUID comme les autres ; `GET /api/v1/network/` le liste avec `router:external: true`. Les réseaux tenant ne sont visibles que dans votre projet, sauf si vous [les partagez](/docs/api/network-sharing).

## Pourquoi créer un réseau tenant {#why-tenant}

- **Architecture multi-tiers.** Les VM frontend sur un sous-réseau exposé au public ; les VM backend / de base de données sur un sous-réseau privé. Les deux côtés communiquent par le réseau tenant sans jamais toucher l’internet public.
- **Plusieurs environnements isolés dans une même région.** prod / staging / dev sur trois réseaux tenant distincts ; aucune communication accidentelle entre eux.
- **Conformité.** Certaines charges de travail exigent un adressage privé pour tout, sauf un chemin de sortie documenté. Un réseau tenant + un routeur vous permettent de construire ce chemin explicitement.

Pour les configurations simples à une seule VM, attachez simplement la VM au réseau externe et laissez complètement de côté les réseaux tenant. Le port de la VM porte alors une adresse publique. Créer une VM sur le réseau externe exige `bandwidth_mbps` et `subscription.bandwidth`, et le port ainsi que sa bande passante sont facturés (voir [Données tarifaires](/docs/api/pricing-data)).

## MTU et IPv6 {#mtu-ipv6}

Définissez la `mtu` d’un réseau lorsque vous le créez ou le modifiez. La valeur par défaut et la valeur maximale autorisée sont des paramètres de la plateforme.

Un réseau n’a pas de version IP propre ; ce sont ses sous-réseaux qui en ont une. Chaque sous-réseau prend une `ip_version` de 4 ou 6, et un même réseau peut contenir les deux.

## Étapes suivantes {#next-steps}

- [Sous-réseaux](/docs/api/subnets) — des blocs d’adresses IP découpés dans un réseau.
- [Routeurs](/docs/api/routers) — relier les réseaux tenant à la passerelle externe.
- [Groupes de sécurité](/docs/api/security-groups) — des règles de pare-feu appliquées aux interfaces d’un réseau.
- [Load balancers](/docs/api/load-balancers) — répartir le trafic entre les VM d’un réseau.
