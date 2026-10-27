---
title: "VM-Schnittstellen"
description: "Netzwerkschnittstellen an einer laufenden VM anhängen und trennen."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: vm-interfaces
---

# VM-Schnittstellen

Eine VM-Schnittstelle ist eine Netzwerkanbindung an einer VM — die Bindung zwischen der VM und einem ihrer [Netzwerkports](/docs/api/network-ports). Den meisten VMs genügt die Standardschnittstelle, die beim Start erstellt wird; Schnittstellen verwalten Sie nur dann direkt, wenn Sie eine VM an mehrere Netzwerke anbinden müssen (z. B. Dual-Homed-Dienste, Blue-Green-Wechsel zwischen Netzwerken).

Eine Schnittstelle wird im laufenden Betrieb angehängt — die VM startet nicht neu. Der Kernel sieht die neue NIC sofort; möglicherweise müssen Sie sie aktivieren (`ip link set <name> up`) und die Adressierung manuell konfigurieren, sofern cloud-init im Image das nicht übernimmt.

Auch das Trennen geschieht im laufenden Betrieb. Sockets, die an die getrennte Schnittstelle gebunden sind, brechen ab; Sockets an anderen Schnittstellen sind nicht betroffen.

## Nächste Schritte {#next-steps}

- [Virtuelle Maschinen](/docs/api/vms) — die übergeordnete Ressource, zu der diese Schnittstellen gehören.
- [Netzwerke](/docs/api/networks) und [Subnetze](/docs/api/subnets) — woran eine Schnittstelle angebunden wird.
- [Floating-IPs](/docs/api/floating-ips) — die Schicht der öffentlichen IPs über einer Schnittstelle.
