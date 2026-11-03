---
title: "Tamanhos de VM"
description: "Flavors de computação — vCPUs, RAM e swap — e como uma VM recebe um."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Tamanhos de VM

Um tamanho de VM é um flavor: uma quantidade de vCPUs (`vcpus`), a RAM em MB (`ram`) e o swap em MB (`swap`). Você não escolhe um flavor ao criar uma VM: você define `spec.cpu` e `spec.ram`, e a API usa um flavor com exatamente esses números, criando um se não houver nenhum. O disco de boot não faz parte do flavor; ele é um volume separado.

## Arquitetura e classe de VM {#families}

Além de `cpu` e `ram`, o `spec` de uma VM indica uma `architecture` e uma `vm_class`. Juntas, elas escolhem o produto pelo qual a VM é cobrada. As opções oferecidas na região da sua sessão estão em `vm_options`, retornado por `GET /api/v1/instance/artifacts`.

## Convenção de nomes {#naming}

Leia a configuração de um flavor em `vcpus`, `ram` e `swap`, não no nome dele. Um flavor que a API cria para uma VM recebe como nome o próprio `id`, um UUID, e o mesmo vale para um criado com `POST /api/v1/flavor/` sem `name`. `GET /api/v1/flavor/` filtra pela configuração com `min_vcpus`, `max_vcpus`, `min_ram`, `max_ram`, `min_swap` e `max_swap`.

Os preços dependem de `architecture`, `vm_class`, `cpu` e `ram`; veja [Dados de preços](/docs/api/pricing-data).

## Redimensionamento {#resizing}

Uma VM pode mudar de tamanho sem ser provisionada de novo. Envie `POST /api/v1/instance/{instance_id}/resize` com um novo `spec` (`architecture`, `vm_class`, `cpu`, `ram`). A VM reinicia no novo flavor e fica aguardando em `VERIFY_RESIZE`: `POST /api/v1/instance/{instance_id}/confirm_resize` mantém o novo tamanho, e `POST /api/v1/instance/{instance_id}/revert_resize` volta ao antigo. As duas retornam `400` se a VM não estiver em `VERIFY_RESIZE`.

## Próximos passos {#next-steps}

- [Máquinas virtuais](/docs/api/vms) — os endpoints que de fato provisionam uma VM em um destes tamanhos.
- [Imagens de VM](/docs/api/vm-images) — os templates de SO com que você dá boot na VM.
- [Chaves SSH](/docs/api/ssh-keys) — chaves públicas injetadas nas VMs no boot.
