---
title: "Sous-réseaux"
description: "Blocs d’adresses IP découpés dans un réseau. Chaque sous-réseau a son propre CIDR, sa passerelle et sa politique DHCP."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Sous-réseaux

Un sous-réseau est un bloc d’adresses IP à l’intérieur d’un [réseau](/docs/api/networks). Les VM et les load balancers s’attachent aux sous-réseaux, pas directement aux réseaux — un réseau n’est qu’un conteneur dans lequel vivent un ou plusieurs sous-réseaux.

## Dimensionnement du CIDR {#cidr}

Vous choisissez le CIDR à la création. Tailles typiques :

| Cas d’usage | CIDR | Adresses utilisables |
| --- | --- | --- |
| Test avec une seule VM | `/29` | 5 |
| Petite application (≤ 20 VM) | `/27` | 27 |
| Application moyenne (≤ 100 VM) | `/25` | 123 |
| Grande application | `/24` | 251 |
| VPC à l’échelle du projet | `/16` | 65,531 |

Chaque sous-réseau réserve : l’adresse réseau (la première), l’adresse de diffusion (la dernière), la passerelle (en général `.1`) et notre serveur DHCP (en général `.2`). Un sous-réseau `/24` compte donc 256 adresses brutes, mais seulement 251 utilisables pour des VM.

Vous pouvez redimensionner un sous-réseau pour l’**agrandir** (`/27` → `/25`) à chaud, sans perturbation. Vous **ne pouvez pas** réduire un sous-réseau sans le recréer ; il faudrait renuméroter les IP des VM existantes.

## DHCP, SLAAC et comportement de la passerelle {#dhcp}

- **Les sous-réseaux IPv4** utilisent DHCP par défaut. Chaque VM reçoit une adresse fixe dans la plage disponible du sous-réseau. Vous pouvez pré-allouer des IP précises via l’endpoint des ports quand vous avez besoin d’une adresse stable (par exemple pour un backend de LB inscrit dans le DNS).
- **Les sous-réseaux IPv6** utilisent SLAAC par défaut. Chaque VM génère automatiquement une adresse à partir du préfixe `/64` du sous-réseau + son adresse MAC. DHCPv6 est disponible en option pour les environnements qui exigent un adressage déterministe.
- **La passerelle** se définit par sous-réseau. Pour les sous-réseaux tenant qui ont besoin d’un accès à internet, la passerelle pointe vers le [routeur](/docs/api/routers) attaché au sous-réseau ; pour le sous-réseau créé automatiquement dans le réseau externe, la passerelle pointe vers notre couche edge.

## Plusieurs sous-réseaux par réseau {#multiple}

Vous pouvez attacher plusieurs sous-réseaux à un même réseau. Une VM connectée à ce réseau peut être joignable depuis chacun de ses sous-réseaux (sous réserve des groupes de sécurité). C’est utile pour le dual-stack IPv4 + IPv6 — un sous-réseau v4 + un sous-réseau v6 sur le même réseau donnent les deux piles à chaque VM.

## Étapes suivantes {#next-steps}

- [Réseaux](/docs/api/networks) — le parent des sous-réseaux.
- [Routeurs](/docs/api/routers) — ce à quoi attacher un sous-réseau tenant pour qu’il puisse atteindre internet.
- [Machines virtuelles](/docs/api/vms) — les VM s’attachent aux sous-réseaux via des ports.
