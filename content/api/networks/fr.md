---
title: "Réseaux"
description: "Domaines de diffusion L2 auxquels s’attachent les VM et les load balancers. La brique de base du VPC d’un projet."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Réseaux

Un réseau est un domaine de diffusion L2 virtuel au sein d’une région. Les VM et les load balancers ne se connectent pas directement à internet — ils s’attachent à un **sous-réseau**, qui vit dans un **réseau** : c’est ce que décrit cette ressource.

## Deux variantes {#flavors}

| Variante | Créé par | Routable vers internet | Utilisé pour |
| --- | --- | --- | --- |
| **Externe** | Provisionné automatiquement dans chaque région ; partagé | Oui (via les IP flottantes) | La liaison montante par défaut de la plupart des charges de travail |
| **Tenant** | Vous, dans le projet | Pas directement — nécessite un routeur | VPC privé, applications multi-tiers, services uniquement internes |

Le réseau externe de chaque région (format d’identifiant : `net_external_us_east_1`) est partagé entre tous les projets de cette région, mais isolé au niveau groupe de sécurité / VLAN. Les réseaux tenant sont entièrement privés et visibles uniquement dans votre projet.

## Pourquoi créer un réseau tenant {#why-tenant}

- **Architecture multi-tiers.** Les VM frontend sur un sous-réseau exposé au public ; les VM backend / de base de données sur un sous-réseau privé. Les deux côtés communiquent par le réseau tenant sans jamais toucher l’internet public.
- **Plusieurs environnements isolés dans une même région.** prod / staging / dev sur trois réseaux tenant distincts ; aucune communication accidentelle entre eux.
- **Conformité.** Certaines charges de travail exigent un adressage privé pour tout, sauf un chemin de sortie documenté. Un réseau tenant + un routeur vous permettent de construire ce chemin explicitement.

Pour les configurations simples à une seule VM, attachez simplement la VM au réseau externe et laissez complètement de côté les réseaux tenant.

## MTU et IPv6 {#mtu-ipv6}

Par défaut, les réseaux ont une MTU de 1500 (standard Ethernet). Vous pouvez demander un réseau jumbo frames (MTU 9000) à la création pour les charges VM à VM à haut débit au sein d’un même réseau — attention : certains CDN / partenaires externes ne négocient pas proprement les jumbo frames.

IPv6 s’active en définissant la version IP du réseau sur `dual` ou `ipv6` (par défaut `ipv4`). Les sous-réseaux découpés dans un réseau où IPv6 est activé peuvent être v4 ou v6 (les mélanger au sein d’un même réseau est pris en charge).

## Étapes suivantes {#next-steps}

- [Sous-réseaux](/docs/api/subnets) — des blocs d’adresses IP découpés dans un réseau.
- [Routeurs](/docs/api/routers) — relier les réseaux tenant à la passerelle externe.
- [Groupes de sécurité](/docs/api/security-groups) — des règles de pare-feu appliquées aux interfaces d’un réseau.
- [Load balancers](/docs/api/load-balancers) — répartir le trafic entre les VM d’un réseau.
