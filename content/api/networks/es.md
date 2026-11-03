---
title: "Redes"
description: "Dominios de broadcast L2 a los que se conectan las VMs y los balanceadores de carga. La primitiva base de la VPC de un proyecto."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Redes

Una red es un dominio de broadcast L2 virtual dentro de una región. Las VMs y los balanceadores de carga se conectan a una **red** a través de puertos, y la dirección de cada puerto sale de una de las **subredes** de la red.

## Dos variantes {#flavors}

| Variante      | Creada por                                                 | Enrutable a internet                  | Para qué                                                                    |
| ------------- | ---------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| **Externa**   | Se provisiona automáticamente en cada región; compartida   | Sí — directamente o con IPs flotantes | El enlace ascendente por defecto para la mayoría de las cargas de trabajo   |
| **De tenant** | Tú, dentro del proyecto                                    | No directamente — necesita un router  | VPC privada, aplicaciones multicapa, servicios solo internos                |

La red externa de cada región se comparte entre todos los proyectos de esa región. Su id es un UUID como cualquier otro; `GET /api/v1/network/` la lista con `router:external: true`. Las redes de tenant solo son visibles dentro de tu proyecto, salvo que las [compartas](/docs/api/network-sharing).

## Por qué crearías una red de tenant {#why-tenant}

- **Arquitectura multicapa.** VMs de frontend en una subred expuesta al público; VMs de backend / BD en una subred privada. Las dos partes se comunican por la red de tenant sin pasar nunca por internet pública.
- **Varios entornos aislados en una región.** prod / staging / dev en tres redes de tenant separadas; sin comunicación accidental entre ellos.
- **Cumplimiento normativo.** Algunas cargas de trabajo requieren direccionamiento privado para todo salvo una ruta de salida documentada. Una red de tenant + un router te permiten construir esa ruta de forma explícita.

Para configuraciones sencillas de una sola VM, conéctate a la red externa y olvídate por completo de las redes de tenant. El puerto de la VM tiene entonces una dirección pública. Crear una VM en la red externa necesita `bandwidth_mbps` y `subscription.bandwidth`, y el puerto y su ancho de banda se facturan (consulta [Datos de precios](/docs/api/pricing-data)).

## MTU e IPv6 {#mtu-ipv6}

Fija la `mtu` de una red al crearla o actualizarla. El valor por defecto y el máximo permitido son ajustes de la plataforma.

Una red no tiene versión de IP propia; la tienen sus subredes. Cada subred recibe una `ip_version` de 4 o 6, y una misma red puede tener de las dos.

## Próximos pasos {#next-steps}

- [Subredes](/docs/api/subnets) — bloques de direcciones IP obtenidos de una red.
- [Routers](/docs/api/routers) — conectan las redes de tenant al gateway externo.
- [Grupos de seguridad](/docs/api/security-groups) — reglas de firewall aplicadas a las interfaces de una red.
- [Balanceadores de carga](/docs/api/load-balancers) — reparten el tráfico entre las VMs de una red.
