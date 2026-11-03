---
title: "Puertos de red"
description: "Puertos L2/L3 de una red. La primitiva de bajo nivel a la que se vinculan las interfaces de VM y los balanceadores de carga."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: network-ports
---

# Puertos de red

Un puerto de red es el punto de conexión entre una red y algo que la usa — una VM, un balanceador de carga, un router. La mayoría de los usuarios no gestionan los puertos directamente; crean una VM conectada a una red y el puerto se crea por detrás. Esta parte de la API es para los casos en los que sí necesitas control directo: crear un puerto con una IP conocida y conectarlo a una VM en ejecución, asociar un balanceador de carga a una IP concreta ya conocida o migrar la IP de un servicio entre hosts.

Los puertos llevan una dirección MAC, una o más direcciones IP de la subred a la que pertenecen y, opcionalmente, [grupos de seguridad](/docs/api/security-groups) aplicados para filtrar el tráfico entrante y saliente. Un puerto que creas tú mismo sobrevive a la VM a la que está conectado, listo para una VM de reemplazo; los puertos que recibe una VM al crearse en una red se borran con ella. Un puerto en la red externa se factura hasta que lo borras (consulta [Datos de precios](/docs/api/pricing-data)).

Al crear una VM solo se indican redes (`network`), así que un puerto que hayas creado se une a una VM después del lanzamiento: `POST /api/v1/instance/{server_id}/interfaces/` con su `port_id`.

## Próximos pasos {#next-steps}

- [Interfaces de VM](/docs/api/vm-interfaces) — la parte de la API de más alto nivel para "conectar esto a una VM", que crea los puertos por debajo.
- [Redes](/docs/api/networks) y [Subredes](/docs/api/subnets) — dónde viven los puertos.
- [Grupos de seguridad](/docs/api/security-groups) — lo que filtra el tráfico de los puertos.
