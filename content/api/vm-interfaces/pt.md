---
title: "Interfaces de VM"
description: "Anexe e desanexe interfaces de rede em uma VM em execução."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: vm-interfaces
---

# Interfaces de VM

Uma interface de VM é uma conexão de rede em uma VM — o vínculo entre a VM e uma das suas [portas de rede](/docs/api/network-ports). Para a maioria das VMs, a interface padrão criada quando a VM sobe basta; você só gerencia interfaces diretamente quando precisa anexar uma VM a várias redes (por exemplo, serviços conectados a duas redes, trocas de rede blue/green).

Anexar uma interface é uma operação a quente — a VM não reinicia. O kernel vê a nova NIC imediatamente; talvez você precise ativá-la (`ip link set <name> up`) e configurar o endereçamento manualmente, a menos que o cloud-init da imagem cuide disso.

Desanexar também é a quente. Os sockets vinculados à interface desanexada caem; os sockets em outras interfaces não são afetados.

## Próximos passos {#next-steps}

- [Máquinas virtuais](/docs/api/vms) — o recurso pai ao qual estas interfaces pertencem.
- [Redes](/docs/api/networks) e [Sub-redes](/docs/api/subnets) — ao que uma interface se conecta.
- [IPs flutuantes](/docs/api/floating-ips) — a camada de IP público sobre uma interface.
