---
title: "Routers"
description: "Conecta las subredes de tenant al gateway externo del proyecto."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Routers

Un router es lo que da acceso a internet a una **red de tenant** (y a sus subredes). Las VMs conectadas a una subred de tenant no pueden llegar a internet pública por sí solas — están en un segmento L2 privado. Un router une ese segmento con la red externa de la región, hace NAT para el tráfico saliente y (opcionalmente) aloja IPs flotantes para el entrante.

## Cuándo necesitas un router {#when-needed}

- **VMs expuestas al público en una red de tenant.** Conecta un router y después reserva + asocia una [IP flotante](/docs/api/floating-ips). El tráfico saliente pasa por el NAT del router; el entrante por la IP flotante se enruta de vuelta a la VM.
- **Capas de aplicación mixtas, privadas y públicas.** La capa web está detrás de un router con una IP flotante; las capas de aplicación + BD siguen siendo privadas y llegan a internet (para cosas como las actualizaciones de paquetes) mediante el source-NAT del router.
- **Enrutamiento entre varias subredes.** Un router puede dar servicio a varias subredes a la vez. El tráfico entre dos subredes del mismo router es interno a la VPC, nunca sale de NimbusNexus y no se factura como egress.

Si conectas las VMs directamente a la red externa, no necesitas un router — la red externa ES el gateway.

## SNAT, DNAT e IPs flotantes {#nat}

Un router tiene una conexión de gateway externo (a la red externa de la región) y cero o más conexiones internas (a subredes de tenant).

- **Saliente desde una VM privada** → el router hace source-NAT a su IP externa. Varias VMs privadas comparten esa única IP externa para el tráfico saliente.
- **Entrante hacia una IP flotante** → el router hace destination-NAT a la VM privada a la que está asociada la IP flotante. La VM privada ve la IP de origen original (conservamos la IP del cliente a través del NAT para el tráfico entrante; solo se aplica SNAT al saliente).

No configuras el NAT directamente; el router lo gestiona según qué subredes están conectadas y qué IPs flotantes has creado.

## Rutas estáticas {#static-routes}

Un router lleva una tabla de rutas estáticas que puedes rellenar para destinos que no son el de por defecto — p. ej. enrutar el tráfico de una subred hacia un CIDR concreto a través de otra VM (un dispositivo VPN, un proxy transparente). La mayoría de los usuarios nunca lo tocan; está ahí para las topologías de VPC avanzadas que lo necesitan.

## Próximos pasos {#next-steps}

- [Redes](/docs/api/networks) y [Subredes](/docs/api/subnets) — lo que conectan los routers.
- [IPs flotantes](/docs/api/floating-ips) — direcciones públicas de entrada que van sobre un router.
- [Grupos de seguridad](/docs/api/security-groups) — la capa de firewall que se aplica en la interfaz de la VM (el router en sí no filtra).
