---
title: "Subredes"
description: "Bloques de direcciones IP obtenidos de una red. Cada subred tiene su propio CIDR, gateway y política de DHCP."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Subredes

Una subred es un bloque de direcciones IP dentro de una [red](/docs/api/networks). Una VM se conecta a la red a través de un puerto, y el puerto toma su dirección de una de las subredes de la red.

## Tamaño del CIDR {#cidr}

Eliges el CIDR al crear la subred. Tamaños típicos:

| Caso de uso                    | CIDR  |
| ------------------------------ | ----- |
| Pruebas con una sola VM        | `/29` |
| Aplicación pequeña (≤ 20 VMs)  | `/27` |
| Aplicación mediana (≤ 100 VMs) | `/25` |
| Aplicación grande              | `/24` |
| VPC de todo el proyecto        | `/16` |

No todas las direcciones del bloque son para las VMs: los puertos toman las suyas de los `allocation_pools` de la subred.

El CIDR de una subred es fijo una vez creada. `PUT /api/v1/subnet/{subnet_id}` cambia su `name`, sus `dns_nameservers`, sus `allocation_pools`, su `gateway_ip` y su `enable_dhcp`, pero no su tamaño; para tener más direcciones, añade otra subred a la red. **No puedes** reducir una subred sin recrearla; habría que renumerar las IPs de las VMs existentes.

## Comportamiento de DHCP, SLAAC y el gateway {#dhcp}

- **Las subredes IPv4** usan DHCP por defecto. Cada VM recibe una dirección fija del rango disponible de la subred. Puedes reservar de antemano IPs concretas con el endpoint de puertos cuando necesites una dirección estable (p. ej. para un backend de un LB en el DNS).
- **Las subredes IPv6** reciben los mismos campos que las IPv4, con `ip_version: 6`. No hay ningún campo para elegir entre SLAAC y DHCPv6.
- **El gateway** se configura por subred. En las subredes de tenant que necesitan acceso a internet, el gateway apunta al [router](/docs/api/routers) conectado a la subred.

## Varias subredes por red {#multiple}

Puedes conectar varias subredes a una misma red. Así es como se monta un dual-stack IPv4 + IPv6: una subred v4 y una subred v6 en la misma red.

## Próximos pasos {#next-steps}

- [Redes](/docs/api/networks) — el padre de las subredes.
- [Routers](/docs/api/routers) — a qué conectar una subred de tenant para que pueda llegar a internet.
- [Máquinas virtuales](/docs/api/vms) — las VMs se conectan a las redes a través de puertos.
