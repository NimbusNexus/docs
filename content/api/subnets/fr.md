---
title: "Sous-réseaux"
description: "Blocs d’adresses IP découpés dans un réseau. Chaque sous-réseau a son propre CIDR, sa passerelle et sa politique DHCP."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Sous-réseaux

Un sous-réseau est un bloc d’adresses IP à l’intérieur d’un [réseau](/docs/api/networks). Une VM s’attache au réseau par l’intermédiaire d’un port, et le port prend son adresse dans l’un des sous-réseaux du réseau.

## Dimensionnement du CIDR {#cidr}

Vous choisissez le CIDR à la création. Tailles typiques :

| Cas d’usage | CIDR |
| --- | --- |
| Test avec une seule VM | `/29` |
| Petite application (≤ 20 VM) | `/27` |
| Application moyenne (≤ 100 VM) | `/25` |
| Grande application | `/24` |
| VPC à l’échelle du projet | `/16` |

Toutes les adresses du bloc ne vont pas aux VM : les ports prennent les leurs dans les `allocation_pools` du sous-réseau.

Le CIDR d’un sous-réseau est fixé une fois le sous-réseau créé. `PUT /api/v1/subnet/{subnet_id}` modifie son `name`, ses `dns_nameservers`, ses `allocation_pools`, sa `gateway_ip` et son `enable_dhcp`, pas sa taille ; pour obtenir plus d’adresses, ajoutez un autre sous-réseau au réseau. Vous **ne pouvez pas** réduire un sous-réseau sans le recréer ; il faudrait renuméroter les IP des VM existantes.

## DHCP, SLAAC et comportement de la passerelle {#dhcp}

- **Les sous-réseaux IPv4** utilisent DHCP par défaut. Chaque VM reçoit une adresse fixe dans la plage disponible du sous-réseau. Vous pouvez pré-allouer des IP précises via l’endpoint des ports quand vous avez besoin d’une adresse stable (par exemple pour un backend de LB inscrit dans le DNS).
- **Les sous-réseaux IPv6** prennent les mêmes champs que les sous-réseaux IPv4, avec `ip_version: 6`. Aucun champ ne permet de choisir entre SLAAC et DHCPv6.
- **La passerelle** se définit par sous-réseau. Pour les sous-réseaux tenant qui ont besoin d’un accès à internet, la passerelle pointe vers le [routeur](/docs/api/routers) attaché au sous-réseau.

## Plusieurs sous-réseaux par réseau {#multiple}

Vous pouvez attacher plusieurs sous-réseaux à un même réseau. C’est ainsi que vous mettez en place le dual-stack IPv4 + IPv6 : un sous-réseau v4 et un sous-réseau v6 sur le même réseau.

## Étapes suivantes {#next-steps}

- [Réseaux](/docs/api/networks) — le parent des sous-réseaux.
- [Routeurs](/docs/api/routers) — ce à quoi attacher un sous-réseau tenant pour qu’il puisse atteindre internet.
- [Machines virtuelles](/docs/api/vms) — les VM s’attachent aux réseaux via des ports.
