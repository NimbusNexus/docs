---
title: "Interfaces de VM"
description: "Attachez et détachez des interfaces réseau sur une VM en cours d’exécution."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: vm-interfaces
---

# Interfaces de VM

Une interface de VM est un rattachement réseau sur une VM — le lien entre la VM et l’un de ses [ports réseau](/docs/api/network-ports). La plupart des VM se contentent de l’interface par défaut créée au lancement ; vous ne gérez les interfaces directement que lorsque vous devez attacher une VM à plusieurs réseaux (par exemple pour des services à double rattachement ou des bascules de réseau blue/green).

L’attachement d’une interface se fait à chaud — la VM ne redémarre pas. Le noyau voit immédiatement la nouvelle carte réseau ; vous devrez peut-être l’activer (`ip link set <name> up`) et configurer l’adressage manuellement, sauf si le cloud-init de l’image s’en charge.

Le détachement se fait aussi à chaud. Les sockets liés à l’interface détachée sont coupés ; les sockets des autres interfaces ne sont pas affectés.

## Étapes suivantes {#next-steps}

- [Machines virtuelles](/docs/api/vms) — la ressource parente à laquelle appartiennent ces interfaces.
- [Réseaux](/docs/api/networks) et [Sous-réseaux](/docs/api/subnets) — ce à quoi s’attache une interface.
- [IP flottantes](/docs/api/floating-ips) — la couche d’IP publique au-dessus d’une interface.
