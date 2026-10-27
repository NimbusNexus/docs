---
title: "IPs flutuantes"
description: "IPs públicos com escopo de região que podem ser desanexados de uma VM e anexados a outra."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# IPs flutuantes

Um IP flutuante é um endereço IP público que **pertence ao seu projeto, não a uma VM específica**. Você aloca um, anexa a uma VM, e ele se torna o IP público dessa VM. Mais tarde, desanexe-o e anexe-o a outra VM — seu tráfego passa a ir para a nova VM, sem que o endereço mude.

## Por que os IPs flutuantes existem {#why}

O IP padrão que uma VM recebe é **efêmero** — destruir a VM devolve o IP ao pool, e uma VM recriada recebe um novo. Isso funciona bem para workers sem estado atrás de um balanceador de carga. É péssimo para:

- Qualquer coisa endereçada por registro DNS A/AAAA (o registro quebra toda vez que a VM é recriada)
- Qualquer coisa na allow-list de IPs de um parceiro (o parceiro precisa incluir o IP na allow-list de novo)
- Deploys blue/green em que você quer mover o tráfego entre duas VMs já aquecidas sem propagação de DNS

Um IP flutuante resolve os três casos. O IP sobrevive a qualquer VM específica; você o move de uma VM para outra em ~2 segundos com uma única chamada de API.

## Escopo de região {#region}

Os IPs flutuantes têm **escopo de região**. Um IP alocado em `us-east-1` só pode ser anexado a VMs em `us-east-1`. O failover entre regiões exige uma destas opções:

- Um IP flutuante por região + um failover no nível do DNS (baseado em latência, com verificação de integridade)
- Um produto de IP anycast, que não oferecemos no momento

Essa não é uma limitação que planejamos remover — IPs flutuantes entre regiões exigiriam rotear anúncios BGP públicos globalmente, o que é um produto totalmente diferente da alocação por região.

## Faturamento {#billing}

- **Anexado** a uma VM em execução: **\$0** — o IP está incluído no custo da VM.
- **Anexado** a uma VM parada: \$2,50/mês — o mesmo valor da linha de IP reservado da VM.
- **Não anexado**: \$2,50/mês — a mesma tarifa. Cobramos por IPs não anexados para desencorajar o acúmulo, que esgotaria o pool regional mais rápido do que conseguimos aumentá-lo.

O padrão comum: aloque o IP quando precisar, anexe-o imediatamente e libere-o quando terminar.

## IPv4 vs. IPv6 {#ipv4-ipv6}

Os IPs flutuantes existem nas duas versões. `version: 'ipv4'` é o padrão (e o que a maioria das pessoas quer). `version: 'ipv6'` é alocado a partir do nosso `/48` em cada região; os dois são públicos e roteáveis.

Uma VM pode ter um IP flutuante IPv4 e um IP flutuante IPv6 anexados ao mesmo tempo. Vários IPv4 por VM não é suportado; se você precisa de vários endereços em uma VM, use endereços privados da VPC com NAT.

## Semântica de anexar / desanexar {#attach}

- **Anexar** é atômico: a VM recebe o endereço em ~2 segundos. As conexões TCP existentes com o IP público anterior da VM (se houver) caem — a tabela de roteamento do kernel simplesmente muda.
- **Desanexar** não libera o IP; só o desvincula da VM. O IP continua sendo cobrado até você chamar DELETE.
- Anexar o mesmo IP a outra VM: esse é exatamente o caminho de failover. Desanexe, anexe ao novo destino, e o DNS não muda.

## Próximos passos {#next-steps}

- [Máquinas virtuais](/docs/api/vms) — o recurso ao qual os IPs flutuantes são anexados.
- [Regiões](/docs/api/regions) — os IPs flutuantes têm escopo de região.
- O guia **Failover entre regiões** (em breve) cobre o padrão no nível do DNS para failover entre regiões quando só os IPs flutuantes não bastam.
