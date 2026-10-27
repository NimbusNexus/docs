---
title: "Subredes"
description: "Bloques de direcciones IP obtenidos de una red. Cada subred tiene su propio CIDR, gateway y política de DHCP."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Subredes

Una subred es un bloque de direcciones IP dentro de una [red](/docs/api/networks). Las VMs y los balanceadores de carga se conectan a subredes, no directamente a redes — una red es solo un contenedor dentro del que viven una o más subredes.

## Tamaño del CIDR {#cidr}

Eliges el CIDR al crear la subred. Tamaños típicos:

| Caso de uso                    | CIDR  | Direcciones utilizables |
| ------------------------------ | ----- | ----------------------- |
| Pruebas con una sola VM        | `/29` | 5                       |
| Aplicación pequeña (≤ 20 VMs)  | `/27` | 27                      |
| Aplicación mediana (≤ 100 VMs) | `/25` | 123                     |
| Aplicación grande              | `/24` | 251                     |
| VPC de todo el proyecto        | `/16` | 65.531                  |

Cada subred reserva: la dirección de red (la primera), la de broadcast (la última), el gateway (normalmente `.1`) y nuestro servidor DHCP (normalmente `.2`). Así que una subred `/24` tiene 256 direcciones en bruto, pero solo 251 utilizables para VMs.

Puedes **ampliar** una subred (`/27` → `/25`) en caliente sin interrupciones. **No puedes** reducir una subred sin recrearla; habría que renumerar las IPs de las VMs existentes.

## Comportamiento de DHCP, SLAAC y el gateway {#dhcp}

- **Las subredes IPv4** usan DHCP por defecto. Cada VM recibe una dirección fija del rango disponible de la subred. Puedes reservar de antemano IPs concretas con el endpoint de puertos cuando necesites una dirección estable (p. ej. para un backend de un LB en el DNS).
- **Las subredes IPv6** usan SLAAC por defecto. Cada VM genera automáticamente una dirección a partir del prefijo `/64` de la subred + su dirección MAC. DHCPv6 está disponible de forma opcional para los entornos que requieren direccionamiento determinista.
- **El gateway** se configura por subred. En las subredes de tenant que necesitan acceso a internet, el gateway apunta al [router](/docs/api/routers) conectado a la subred; en la subred creada automáticamente de la red externa, el gateway apunta a nuestro borde de red.

## Varias subredes por red {#multiple}

Puedes conectar varias subredes a una misma red. Una VM conectada a esa red puede ser accesible desde todas las subredes que contiene (sujeto a los grupos de seguridad). Esto es útil para dual-stack IPv4 + IPv6 — una subred v4 + una subred v6 en la misma red dan a cada VM los dos stacks.

## Próximos pasos {#next-steps}

- [Redes](/docs/api/networks) — el padre de las subredes.
- [Routers](/docs/api/routers) — a qué conectar una subred de tenant para que pueda llegar a internet.
- [Máquinas virtuales](/docs/api/vms) — las VMs se conectan a las subredes mediante puertos.
