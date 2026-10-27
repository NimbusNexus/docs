---
title: "Snapshots"
description: "Cópias pontuais de VMs, volumes de blocos e bancos de dados gerenciados."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Snapshots

Um snapshot é uma cópia pontual de um recurso de origem — uma VM, um volume de blocos ou um banco de dados gerenciado — gravada no armazenamento de objetos. Os snapshots sobrevivem à origem: excluir uma VM não exclui os snapshots dela. Restaurar um snapshot cria um recurso **novo**; o original nunca é modificado.

## Três tipos de origem {#source-kinds}

| Tipo de origem | O que é capturado                                                                                            | Destino da restauração                                                 |
| ----------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `vm`           | Disco raiz + estado dos volumes anexados em um momento consistente                                           | Uma nova VM de tamanho igual ou maior, em qualquer região              |
| `volume`       | Conteúdo do volume de blocos em um momento consistente                                                       | Um novo volume de blocos de tamanho igual ou maior, em qualquer região |
| `database`     | Snapshot lógico no nível do mecanismo (barreira do WAL no Postgres / MySQL, ponto do oplog no MongoDB, etc.) | Um novo banco de dados com o mesmo mecanismo + versão                  |

O campo `source_kind` do snapshot diz qual é o tipo; o endpoint de restauração direciona para o backend certo com base nesse campo.

## Como um snapshot é consistente {#consistency}

- **Snapshots de volume** suspendem a fila de I/O, tiram um snapshot na camada de blocos (~10 segundos) e continuam copiando em segundo plano. A VM continua rodando; gravações em andamento depois do ponto do snapshot entram no estado posterior ao snapshot.
- **Snapshots de VM** fazem o snapshot do disco raiz + de todos os volumes anexados de forma atômica. Se você configurou hooks pré/pós-snapshot (scripts do cloud-init que fazem o flush dos buffers de uma aplicação), eles rodam como parte do snapshot.
- **Snapshots de banco de dados** usam o método de consistência nativo do mecanismo. Não é preciso suspender o I/O do lado de quem chama; a barreira do log de commits do próprio banco de dados garante que você possa restaurar para um ponto transacionalmente consistente.

Para aplicações que precisam de consistência no nível da aplicação (por exemplo, um banco de dados Postgres hospedado em uma VM, e não nos bancos de dados gerenciados), prefira a API de snapshots do próprio banco de dados a um snapshot de volume.

## Armazenamento + retenção {#storage}

Os snapshots ficam no tier frio (\$0,04/GB·mês, deduplicados em relação aos snapshots anteriores da mesma origem). A retenção padrão é de **7 dias**; passe `retention_days` na criação para estender até 365 dias.

A deduplicação significa que uma série de snapshots diários da mesma VM tem mais ou menos o tamanho da VM original mais a diferença diária — não N× o tamanho da VM. O custo em regime estável de uma política de snapshot diário com retenção de 30 dias em uma VM de 100 GB costuma ficar em 130–160 GB no total, dependendo de quanto muda.

## Semântica da restauração {#restore}

A restauração cria um **novo recurso** a partir do snapshot. O recurso de origem (se ainda existir) não é afetado. As VMs restauradas recebem um novo id, um novo IP e uma nova injeção de chaves SSH a partir das chaves atuais do projeto (o conjunto de chaves original não é preservado — restaurar uma VM antiga depois de uma rotação de chaves gera VMs que as chaves antigas, já removidas, não conseguem acessar).

A restauração entre regiões é suportada. A transferência interna de dados para a cópia do snapshot é medida como egress entre regiões (\$0,005/GB) na primeira vez; as restaurações seguintes na região de destino não repetem a transferência.

## Próximos passos {#next-steps}

- [Máquinas virtuais](/docs/api/vms) — o ciclo de vida das VMs que os snapshots capturam.
- [Armazenamento em blocos](/docs/api/block-storage) — especificamente os snapshots de volume.
- [Bancos de dados gerenciados](/docs/api/managed-databases) — snapshots específicos de banco de dados pelo endpoint do próprio banco.
- [Armazenamento frio](/docs/api/cold-storage) — o tier em que os snapshots ficam.
