---
title: "IPs flotantes"
description: "IPs públicas de alcance regional que se pueden desasociar de una VM y asociar a otra."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# IPs flotantes

Una IP flotante es una dirección IP pública que **pertenece a tu proyecto, no a una VM concreta**. Reservas una en una red externa, la asignas a un puerto de una VM y se convierte en la IP pública de esa VM. Más adelante, desasóciala y vuelve a asociarla a otra VM — tu tráfico pasa a ir a la VM nueva, sin que cambie la dirección.

## Por qué existen las IPs flotantes {#why}

La IP que recibe una VM por defecto es **efímera** — al destruir la VM, la IP vuelve al pool y una VM recreada recibe una nueva. Eso está bien para workers sin estado detrás de un balanceador de carga. Es terrible para:

- Cualquier cosa a la que se acceda mediante un registro DNS A/AAAA (el registro se rompe cada vez que se recrea la VM)
- Cualquier cosa que esté en la lista de IPs permitidas de un socio (el socio tiene que volver a añadirla a su lista de permitidos)
- Despliegues blue/green en los que quieres mover el tráfico entre dos VMs en caliente sin esperar a la propagación de DNS

Una IP flotante resuelve los tres casos. La IP sobrevive a cualquier VM concreta; la mueves de una VM a otra con una sola llamada a la API.

## Alcance regional {#region}

Las IPs flotantes son **de alcance regional**. Una IP sale de la red externa de una región y solo se asocia a puertos de esa región.

## Facturación {#billing}

Una IP flotante se factura a su propio precio desde que se crea hasta que se borra, esté asociada o no. Asociarla a una VM no hace que pase a formar parte del coste de la VM. En [Datos de precios](/docs/api/pricing-data) está el precio actual.

El patrón estándar: crea la IP cuando la necesites, asóciala de inmediato y bórrala cuando termines.

## IPv4 frente a IPv6 {#ipv4-ipv6}

No hay ningún campo de versión: una dirección sale de la red externa que indicas en `floating_network_id`, y `POST /api/v1/floating_ip/reserve` también puede recibir una `ip_address` concreta. `GET /api/v1/floating_ip/artifacts` lista las redes externas con la `ip_version` de cada subred.

Cada IP flotante se vincula a una IP fija de un puerto (`vm_port_id` y `vm_ip_address`), así que una VM con varias IPs fijas puede llevar una IP flotante en cada una.

## Semántica de asociar / desasociar {#attach}

- **Asociar** es `POST /api/v1/floating_ip/allocate`, con la red externa (`floating_network_id`), el puerto (`vm_port_id`) y su IP fija (`vm_ip_address`). Pasa `floating_ip_id` para asociar una dirección que ya tienes; sin él, allocate crea una nueva. `GET /api/v1/floating_ip/artifacts?resource_id=<id>` lista los puertos de una VM o de un balanceador de carga.
- **Desasociar** es `POST /api/v1/floating_ip/deallocate`. No libera la IP; solo la desvincula de la VM. La IP se sigue facturando hasta que la borras, con `DELETE /api/v1/floating_ip/` (su id en `ids`) o con `deallocate` y `delete: true`.
- Volver a asociar la misma IP a otra VM: este es exactamente el camino del failover. Desasocias, asocias al nuevo destino y el DNS no cambia.

## Próximos pasos {#next-steps}

- [Máquinas virtuales](/docs/api/vms) — el recurso al que se asocian las IPs flotantes.
- [Regiones](/docs/api/regions) — las IPs flotantes son de alcance regional.
