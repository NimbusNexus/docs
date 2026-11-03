---
title: "Grupos de seguridad"
description: "Conjuntos de reglas de firewall con estado aplicados a las interfaces de red de las VMs."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Grupos de seguridad

Los grupos de seguridad son conjuntos de reglas de **firewall con estado**. Asocias uno o más grupos a la interfaz de red de una VM; lo que se aplica es la unión de las reglas de todos los grupos. Comportamiento por defecto: **denegar todo el tráfico entrante y permitir todo el saliente** — lista de permitidos explícita para el tráfico entrante y salida abierta hasta que digas lo contrario.

## Qué significa con estado {#stateful}

Solo escribes reglas para la dirección **que inicia** la conexión. Si permites TCP entrante en el puerto 443, los paquetes de respuesta al cliente se permiten automáticamente — no hace falta una regla de salida aparte para el tráfico de vuelta.

Compáralo con una ACL sin estado (p. ej. las Network ACLs de AWS), en la que necesitarías reglas simétricas en las dos direcciones. Los grupos de seguridad son más fáciles de razonar para el firewall a nivel de aplicación; las ACLs sin estado son más fáciles de razonar para la política de la red de tenant en una capa por debajo de la VM.

## Forma de una regla {#rules}

Cada regla tiene:

- **Dirección** — `ingress` o `egress`
- **Tipo Ether** — `ether`: `IPv4` o `IPv6`
- **Protocolo** — `any`, un nombre como `tcp`, `udp`, `icmp`, `ipv6-icmp` o `sctp`, o `custom` con un número de protocolo (0–255) en `protocol_custom`
- **Rango de puertos** — `port_min` y `port_max`, cada uno entre 0 y 65535. Indica solo `port_min` para un único puerto (`80`), los dos para un rango (de `8000` a `9000`) o ninguno para cualquier puerto
- **Origen / destino** — un bloque CIDR en `remote_cidr` (`0.0.0.0/0`, `10.0.0.0/8`), otro grupo de seguridad en `remote_sec_grp` o un [grupo de direcciones](/docs/api/address-groups) en `remote_addr_grp`

El modo "el origen es otro grupo de seguridad" es el que más vale la pena conocer. Una regla como "permitir el puerto 5432 desde `web-tier-sg`" deja que todas las VMs del grupo `web-tier-sg` lleguen a tu VM de Postgres en el 5432 — sin tener que enumerar IPs, y la regla sigue funcionando a medida que las VMs entran y salen de `web-tier-sg` al escalar.

## Un patrón habitual {#pattern}

Para una aplicación web de 3 capas:

1. **`web-tier-sg`** — entrante: permitir `tcp/80` y `tcp/443` desde `0.0.0.0/0` (público)
2. **`app-tier-sg`** — entrante: permitir `tcp/8080` desde `web-tier-sg` (solo la capa web puede llegar a la capa de aplicación)
3. **`db-tier-sg`** — entrante: permitir `tcp/5432` desde `app-tier-sg` (solo la capa de aplicación puede llegar a la base de datos)

Esto se puede combinar; puedes añadir un cuarto grupo para una VPN de operaciones que permita SSH desde las IPs de tu oficina, y asociarlo junto a `db-tier-sg` en las VMs de la base de datos sin tocar las reglas de la aplicación.

## Próximos pasos {#next-steps}

- [Máquinas virtuales](/docs/api/vms) — a lo que se asocian los grupos de seguridad.
- [Redes](/docs/api/networks) y [Subredes](/docs/api/subnets) — las primitivas de red que protegen los grupos de seguridad.
