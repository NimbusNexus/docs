---
title: "Routeurs"
description: "Reliez les sous-réseaux tenant à la passerelle externe du projet."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Routeurs

C’est le routeur qui donne à un **réseau tenant** (et à ses sous-réseaux) l’accès à internet. Les VM attachées à un sous-réseau tenant ne peuvent pas atteindre l’internet public par elles-mêmes — elles sont sur un segment L2 privé. Un routeur relie ce segment au réseau externe de la région, en faisant du NAT pour le trafic sortant et (en option) en hébergeant des IP flottantes pour le trafic entrant.

## Quand vous avez besoin d’un routeur {#when-needed}

- **VM exposées au public sur un réseau tenant.** Attachez un routeur, puis allouez et attachez une [IP flottante](/docs/api/floating-ips). Le trafic sortant passe par le NAT du routeur ; le trafic entrant sur l’IP flottante est routé jusqu’à la VM.
- **Tiers applicatifs mixtes privés/publics.** Le tier web se trouve derrière un routeur avec une IP flottante ; les tiers app + db restent privés et atteignent internet (par exemple pour les mises à jour de paquets) via le source-NAT du routeur.
- **Routage multi-sous-réseau.** Un routeur peut desservir plusieurs sous-réseaux simultanément. Le trafic entre deux sous-réseaux d’un même routeur est intra-VPC, ne quitte jamais NimbusNexus et n’est pas facturé comme de l’egress.

Si vous attachez des VM directement au réseau externe, vous n’avez pas besoin de routeur — le réseau externe EST la passerelle.

## SNAT, DNAT et IP flottantes {#nat}

Un routeur a une connexion de passerelle externe (vers le réseau externe de la région) et zéro ou plusieurs connexions internes (vers des sous-réseaux tenant).

- **Trafic sortant d’une VM privée** → le routeur fait du source-NAT vers son IP externe. Plusieurs VM privées partagent cette unique IP externe pour le trafic sortant.
- **Trafic entrant vers une IP flottante** → le routeur fait du destination-NAT vers la VM privée à laquelle l’IP flottante est attachée. La VM privée voit l’IP source d’origine (nous préservons l’IP du client à travers le NAT pour le trafic entrant ; seul le trafic sortant subit un SNAT).

Vous ne configurez pas le NAT directement ; le routeur s’en charge en fonction des sous-réseaux attachés et des IP flottantes que vous avez créées.

## Routes statiques {#static-routes}

Un routeur porte une table de routes statiques que vous pouvez remplir pour des destinations autres que celle par défaut — par exemple pour faire passer le trafic d’un sous-réseau destiné à un CIDR précis par une autre VM (une appliance VPN, un proxy transparent). La plupart des utilisateurs n’y touchent jamais ; elle existe pour les architectures VPC avancées qui en ont besoin.

## Étapes suivantes {#next-steps}

- [Réseaux](/docs/api/networks) et [Sous-réseaux](/docs/api/subnets) — ce que relient les routeurs.
- [IP flottantes](/docs/api/floating-ips) — les adresses publiques entrantes qui s’appuient sur un routeur.
- [Groupes de sécurité](/docs/api/security-groups) — la couche de pare-feu appliquée à l’interface de la VM (le routeur lui-même ne filtre pas).
