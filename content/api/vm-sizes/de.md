---
title: "VM-Größen"
description: "Compute-Flavors — vCPUs, RAM und Swap — und wie eine VM einen bekommt."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# VM-Größen

Eine VM-Größe ist ein Flavor: eine Anzahl an vCPUs (`vcpus`), RAM in MB (`ram`) und Swap in MB (`swap`). Beim Erstellen einer VM wählen Sie keinen Flavor: Sie setzen `spec.cpu` und `spec.ram`, und die API verwendet einen Flavor mit genau diesen Werten und legt einen an, wenn es keinen gibt. Die Boot-Disk gehört nicht zum Flavor; sie ist ein separates Volume.

## Architektur und VM-Klasse {#families}

Neben `cpu` und `ram` nennt die `spec` einer VM eine `architecture` und eine `vm_class`. Zusammen bestimmen sie das Produkt, als das die VM abgerechnet wird. Welche davon in der Region Ihrer Sitzung angeboten werden, steht in `vm_options` von `GET /api/v1/instance/artifacts`.

## Namenskonvention {#naming}

Lesen Sie die Ausstattung eines Flavors aus `vcpus`, `ram` und `swap` ab, nicht aus seinem Namen. Ein Flavor, den die API für eine VM anlegt, ist nach seiner `id` benannt, einer UUID, und ebenso einer, der mit `POST /api/v1/flavor/` ohne `name` erstellt wurde. `GET /api/v1/flavor/` filtert nach der Ausstattung mit `min_vcpus`, `max_vcpus`, `min_ram`, `max_ram`, `min_swap` und `max_swap`.

Die Preise hängen von `architecture`, `vm_class`, `cpu` und `ram` ab; siehe [Preisdaten](/docs/api/pricing-data).

## Größe ändern {#resizing}

Eine VM kann ohne erneute Bereitstellung die Größe wechseln. Senden Sie `POST /api/v1/instance/{instance_id}/resize` mit einer neuen `spec` (`architecture`, `vm_class`, `cpu`, `ram`). Die VM startet auf dem neuen Flavor neu und wartet in `VERIFY_RESIZE`: `POST /api/v1/instance/{instance_id}/confirm_resize` behält die neue Größe, und `POST /api/v1/instance/{instance_id}/revert_resize` kehrt zur alten zurück. Beide antworten mit `400`, wenn die VM nicht in `VERIFY_RESIZE` ist.

## Nächste Schritte {#next-steps}

- [Virtuelle Maschinen](/docs/api/vms) — die Endpoints, die eine VM in einer dieser Größen tatsächlich bereitstellen.
- [VM-Images](/docs/api/vm-images) — die OS-Vorlagen, mit denen Sie die VM booten.
- [SSH-Keys](/docs/api/ssh-keys) — öffentliche Schlüssel, die beim Boot in VMs eingespielt werden.
