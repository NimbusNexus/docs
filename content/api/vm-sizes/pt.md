---
title: "Tamanhos de VM"
description: "Catálogo de configurações de computação nas famílias gp, co, mo e gx."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Tamanhos de VM

Um tamanho de VM é uma configuração de computação com nome — quantidade de vCPUs, RAM, tamanho do disco raiz e família. Toda VM é criada com um código de tamanho (por exemplo, `gp-4-16`); redimensionar uma VM troca o código em tempo de execução.

## As quatro famílias {#families}

| Família                       | Prefixo do código | Para que é otimizada                                                                                                                |
| --------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| **Uso geral**                 | `gp-*`            | CPU + RAM equilibradas. O padrão para a maioria das cargas de trabalho.                                                             |
| **Otimizada para computação** | `co-*`            | 2× a CPU por dólar da `gp`, metade da RAM por dólar. Indicada para serviços limitados por CPU, jobs em lote, codificação de vídeo. |
| **Otimizada para memória**    | `mo-*`            | A troca inversa. Indicada para caches em memória, heaps da JVM, área temporária de análises.                                       |
| **GPU**                       | `gx-*`            | Aceleradores NVIDIA L4 / H100. Inferência de ML, treinamento, transcodificação.                                                     |

## Convenção de nomes {#naming}

Os códigos de tamanho seguem `<family>-<vCPU>-<RAM_GB>`. Assim:

- `gp-1-2` — 1 vCPU, 2 GB de RAM, uso geral (o menor tamanho útil, ~\$0,0145/vCPU·hora)
- `gp-4-16` — 4 vCPU, 16 GB de RAM, uso geral
- `co-16-32` — 16 vCPU, 32 GB de RAM, otimizado para computação
- `mo-8-64` — 8 vCPU, 64 GB de RAM, otimizado para memória
- `gx-4-32-l4` — 4 vCPU, 32 GB de RAM, 1× GPU L4 (os tamanhos de GPU acrescentam o código do acelerador)

O endpoint do catálogo retorna a lista completa com os preços atuais por tamanho. Os preços variam um pouco entre regiões; a resposta inclui uma tabela de preços por região.

## Redimensionamento {#resizing}

Uma VM pode mudar de tamanho sem ser provisionada de novo. O redimensionamento dentro da mesma família é online (sem downtime). O redimensionamento entre famílias exige um ciclo de parar / iniciar. O redimensionamento entre arquiteturas (por exemplo, de `gp` para `gx`) é um destruir / recriar — a API rejeita a chamada direta de redimensionamento para tornar explícita a perda de dados implícita.

## Próximos passos {#next-steps}

- [Máquinas virtuais](/docs/api/vms) — os endpoints que de fato provisionam uma VM em um destes tamanhos.
- [Imagens de VM](/docs/api/vm-images) — os templates de SO com que você dá boot na VM.
- [Chaves SSH](/docs/api/ssh-keys) — chaves públicas injetadas nas VMs no boot.
