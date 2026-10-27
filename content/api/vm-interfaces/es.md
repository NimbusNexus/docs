---
title: "Interfaces de VM"
description: "Conecta y desconecta interfaces de red en una VM en ejecución."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: vm-interfaces
---

# Interfaces de VM

Una interfaz de VM es una conexión de red de una VM — el vínculo entre la VM y uno de sus [puertos de red](/docs/api/network-ports). A la mayoría de las VMs les basta con la interfaz por defecto que se crea al lanzarlas; solo gestionas interfaces directamente cuando necesitas conectar una VM a varias redes (p. ej. servicios con doble conexión, cambios de red blue/green).

Conectar una interfaz se hace en caliente — la VM no se reinicia. El kernel ve la nueva NIC de inmediato; puede que tengas que activarla (`ip link set <name> up`) y configurar el direccionamiento a mano, salvo que se encargue el cloud-init de la imagen.

Desconectarla también se hace en caliente. Los sockets vinculados a la interfaz desconectada se cortan; los sockets de otras interfaces no se ven afectados.

## Próximos pasos {#next-steps}

- [Máquinas virtuales](/docs/api/vms) — el recurso padre al que pertenecen estas interfaces.
- [Redes](/docs/api/networks) y [Subredes](/docs/api/subnets) — a lo que se conecta una interfaz.
- [IPs flotantes](/docs/api/floating-ips) — la capa de IP pública por encima de una interfaz.
