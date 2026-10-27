---
title: "IPs flotantes"
description: "IPs públicas de alcance regional que se pueden desasociar de una VM y asociar a otra."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# IPs flotantes

Una IP flotante es una dirección IP pública que **pertenece a tu proyecto, no a una VM concreta**. Reservas una, la asocias a una VM y se convierte en la IP pública de esa VM. Más adelante, desasóciala y vuelve a asociarla a otra VM — tu tráfico pasa a ir a la VM nueva, sin que cambie la dirección.

## Por qué existen las IPs flotantes {#why}

La IP que recibe una VM por defecto es **efímera** — al destruir la VM, la IP vuelve al pool y una VM recreada recibe una nueva. Eso está bien para workers sin estado detrás de un balanceador de carga. Es terrible para:

- Cualquier cosa a la que se acceda mediante un registro DNS A/AAAA (el registro se rompe cada vez que se recrea la VM)
- Cualquier cosa que esté en la lista de IPs permitidas de un socio (el socio tiene que volver a añadirla a su lista de permitidos)
- Despliegues blue/green en los que quieres mover el tráfico entre dos VMs en caliente sin esperar a la propagación de DNS

Una IP flotante resuelve los tres casos. La IP sobrevive a cualquier VM concreta; la mueves de una VM a otra en ~2 segundos con una sola llamada a la API.

## Alcance regional {#region}

Las IPs flotantes son **de alcance regional**. Una IP reservada en `us-east-1` solo se puede asociar a VMs de `us-east-1`. El failover entre regiones requiere una de estas dos cosas:

- Una IP flotante por región + un failover a nivel de DNS (basado en latencia, con comprobaciones de estado)
- Un producto de IP anycast, que ahora mismo no ofrecemos

No es una limitación que tengamos previsto eliminar — las IPs flotantes entre regiones requerirían enrutar anuncios BGP públicos a nivel global, lo que es un producto totalmente distinto de la reserva por región.

## Facturación {#billing}

- **Asociada** a una VM en ejecución: **\$0** — la IP está incluida en el coste de la VM.
- **Asociada** a una VM detenida: \$2.50/mes — lo mismo que la línea de IP reservada de la VM.
- **Sin asociar**: \$2.50/mes — la misma tarifa. Cobramos las IPs sin asociar para desincentivar el acaparamiento, que agotaría el pool regional más rápido de lo que podemos ampliarlo.

El patrón estándar: reserva la IP cuando la necesites, asóciala de inmediato y libérala cuando termines.

## IPv4 frente a IPv6 {#ipv4-ipv6}

Las IPs flotantes vienen en las dos variantes. `version: 'ipv4'` es la opción por defecto (y la que quiere la mayoría). `version: 'ipv6'` se reserva de nuestro `/48` de cada región; ambas son públicas y enrutables.

Una VM puede tener asociadas a la vez una IP flotante IPv4 y una IP flotante IPv6. No se admiten varias IPv4 por VM; si necesitas varias direcciones en una VM, usa direcciones privadas de la VPC con NAT.

## Semántica de asociar / desasociar {#attach}

- **Asociar** es atómico: la VM obtiene la dirección en ~2 segundos. Las conexiones TCP existentes a la IP pública anterior de la VM (si la había) se cortan — simplemente cambia la tabla de enrutamiento del kernel.
- **Desasociar** no libera la IP; solo la desvincula de la VM. La IP se sigue facturando hasta que llames a DELETE.
- Volver a asociar la misma IP a otra VM: este es exactamente el camino del failover. Desasocias, asocias al nuevo destino y el DNS no cambia.

## Próximos pasos {#next-steps}

- [Máquinas virtuales](/docs/api/vms) — el recurso al que se asocian las IPs flotantes.
- [Regiones](/docs/api/regions) — las IPs flotantes son de alcance regional.
- La guía **Failover multirregión** (próximamente) explica el patrón a nivel de DNS para el failover entre regiones cuando las IPs flotantes por sí solas no bastan.
