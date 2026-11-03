---
title: "IPs flutuantes"
description: "IPs públicos com escopo de região que podem ser desanexados de uma VM e anexados a outra."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# IPs flutuantes

Um IP flutuante é um endereço IP público que **pertence ao seu projeto, não a uma VM específica**. Você reserva um em uma rede externa, aloca-o a uma porta de uma VM, e ele se torna o IP público dessa VM. Mais tarde, desanexe-o e anexe-o a outra VM — seu tráfego passa a ir para a nova VM, sem que o endereço mude.

## Por que os IPs flutuantes existem {#why}

O IP padrão que uma VM recebe é **efêmero** — destruir a VM devolve o IP ao pool, e uma VM recriada recebe um novo. Isso funciona bem para workers sem estado atrás de um balanceador de carga. É péssimo para:

- Qualquer coisa endereçada por registro DNS A/AAAA (o registro quebra toda vez que a VM é recriada)
- Qualquer coisa na allow-list de IPs de um parceiro (o parceiro precisa incluir o IP na allow-list de novo)
- Deploys blue/green em que você quer mover o tráfego entre duas VMs já aquecidas sem propagação de DNS

Um IP flutuante resolve os três casos. O IP sobrevive a qualquer VM específica; você o move de uma VM para outra com uma única chamada de API.

## Escopo de região {#region}

Os IPs flutuantes têm **escopo de região**. Um IP vem da rede externa de uma região e só é anexado a portas dessa região.

## Faturamento {#billing}

Um IP flutuante é cobrado pelo seu próprio preço desde o momento em que é criado até ser excluído, esteja anexado ou não. Anexá-lo a uma VM não o inclui no custo da VM. O preço atual está em [Dados de preços](/docs/api/pricing-data).

O padrão comum: crie o IP quando precisar, anexe-o imediatamente e exclua-o quando terminar.

## IPv4 vs. IPv6 {#ipv4-ipv6}

Não existe um campo de versão: um endereço vem da rede externa que você indica em `floating_network_id`, e `POST /api/v1/floating_ip/reserve` também pode receber um `ip_address` específico. `GET /api/v1/floating_ip/artifacts` lista as redes externas com o `ip_version` de cada sub-rede.

Cada IP flutuante se vincula a um IP fixo em uma porta (`vm_port_id` e `vm_ip_address`), então uma VM com vários IPs fixos pode ter um IP flutuante em cada um.

## Semântica de anexar / desanexar {#attach}

- **Anexar** é `POST /api/v1/floating_ip/allocate`, com a rede externa (`floating_network_id`), a porta (`vm_port_id`) e o IP fixo dela (`vm_ip_address`). Passe `floating_ip_id` para anexar um endereço que você já tem; sem ele, allocate cria um novo. `GET /api/v1/floating_ip/artifacts?resource_id=<id>` lista as portas de uma VM ou de um balanceador de carga.
- **Desanexar** é `POST /api/v1/floating_ip/deallocate`. Isso não libera o IP; só o desvincula da VM. O IP continua sendo cobrado até você excluí-lo, com `DELETE /api/v1/floating_ip/` (o id dele em `ids`) ou com `deallocate` e `delete: true`.
- Anexar o mesmo IP a outra VM: esse é exatamente o caminho de failover. Desanexe, anexe ao novo destino, e o DNS não muda.

## Próximos passos {#next-steps}

- [Máquinas virtuais](/docs/api/vms) — o recurso ao qual os IPs flutuantes são anexados.
- [Regiões](/docs/api/regions) — os IPs flutuantes têm escopo de região.
