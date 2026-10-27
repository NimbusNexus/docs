---
title: "Redes"
description: "Dominios de broadcast L2 a los que se conectan las VMs y los balanceadores de carga. La primitiva base de la VPC de un proyecto."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Redes

Una red es un dominio de broadcast L2 virtual dentro de una región. Las VMs y los balanceadores de carga no se conectan directamente a internet — se conectan a una **subred**, que vive dentro de una **red**, que es lo que describe este recurso.

## Dos variantes {#flavors}

| Variante      | Creada por                                                 | Enrutable a internet                  | Para qué                                                                    |
| ------------- | ---------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| **Externa**   | Se provisiona automáticamente en cada región; compartida   | Sí (mediante IPs flotantes)           | El enlace ascendente por defecto para la mayoría de las cargas de trabajo   |
| **De tenant** | Tú, dentro del proyecto                                    | No directamente — necesita un router  | VPC privada, aplicaciones multicapa, servicios solo internos                |

La red externa de cada región (patrón de id: `net_external_us_east_1`) se comparte entre todos los proyectos de esa región, pero está aislada a nivel de grupo de seguridad / VLAN. Las redes de tenant son totalmente privadas y solo son visibles dentro de tu proyecto.

## Por qué crearías una red de tenant {#why-tenant}

- **Arquitectura multicapa.** VMs de frontend en una subred expuesta al público; VMs de backend / BD en una subred privada. Las dos partes se comunican por la red de tenant sin pasar nunca por internet pública.
- **Varios entornos aislados en una región.** prod / staging / dev en tres redes de tenant separadas; sin comunicación accidental entre ellos.
- **Cumplimiento normativo.** Algunas cargas de trabajo requieren direccionamiento privado para todo salvo una ruta de salida documentada. Una red de tenant + un router te permiten construir esa ruta de forma explícita.

Para configuraciones sencillas de una sola VM, conéctate a la red externa y olvídate por completo de las redes de tenant.

## MTU e IPv6 {#mtu-ipv6}

Por defecto, las redes tienen una MTU de 1500 (el estándar de Ethernet). Al crear la red, puedes pedir que use jumbo frames (MTU 9000) para cargas de trabajo de VM a VM con mucho throughput dentro de la misma red — ten en cuenta que algunos CDNs / socios externos no negocian bien los jumbo frames.

IPv6 se activa poniendo la versión de IP de la red en `dual` o `ipv6` (por defecto, `ipv4`). Las subredes obtenidas de una red con IPv6 activado pueden ser v4 o v6 (se admite mezclarlas dentro de una misma red).

## Próximos pasos {#next-steps}

- [Subredes](/docs/api/subnets) — bloques de direcciones IP obtenidos de una red.
- [Routers](/docs/api/routers) — conectan las redes de tenant al gateway externo.
- [Grupos de seguridad](/docs/api/security-groups) — reglas de firewall aplicadas a las interfaces de una red.
- [Balanceadores de carga](/docs/api/load-balancers) — reparten el tráfico entre las VMs de una red.
