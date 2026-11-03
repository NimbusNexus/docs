---
title: "Imagens de VM"
description: "Imagens de boot do SO — templates públicos e imagens personalizadas do projeto."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Imagens de VM

Uma imagem de VM é o template de SO usado para dar boot no disco raiz de uma nova VM. A NimbusNexus oferece **imagens públicas**, e você pode enviar suas próprias **imagens personalizadas**, criadas com ferramentas como o Packer.

## Imagens públicas {#public-images}

`GET /api/v1/image/` lista as imagens que você pode usar; `visibility=public` restringe a lista às públicas. Uma imagem é identificada pelo `id` dela, um UUID, e é isso que você passa como `image` ao criar uma VM. Os nomes são rótulos, não slugs versionados, então consulte o `id` em vez de fixar um nome no código.

Quando uma VM dá boot, ela recebe a chave SSH que você indicou em `sshs` (veja [Chaves SSH](/docs/api/ssh-keys)) e qualquer `user_data` que você tenha passado; uma imagem com cloud-init os aplica no primeiro boot.

## Imagens personalizadas {#custom-images}

Uma imagem personalizada exige duas chamadas:

1. `POST /api/v1/image/` cria o registro da imagem a partir de um `name` (com pelo menos 5 caracteres), um `disk_format` e um `container_format`, e retorna o `id` dela. Opcionalmente, defina `visibility` (padrão `private`: só o seu projeto) e `subscription`, o plano de faturamento (padrão `Hourly`).
2. `POST /api/v1/image/file` envia o arquivo, como `file` e `image_id` multipart. Ou então `POST /api/v1/image/import` com `{"id": "…", "url": "…"}` busca a imagem a partir de uma URL.

As extensões de arquivo aceitas são `.img`, `.qcow2`, `.vmdk`, `.vhd`, `.vhdx`, `.raw`, `.iso`, `.ami`, `.ari`, `.aki` e `.vdi`; qualquer outra extensão retorna `400`.

As imagens personalizadas são cobradas por GB, arredondado para cima até um GB inteiro, como um produto próprio, no plano definido em `subscription`; veja [Dados de preços](/docs/api/pricing-data).

## Regiões {#regions}

As chamadas de imagem funcionam na região da sua sessão. Não existe uma chamada para copiar uma imagem para outra região.

## Próximos passos {#next-steps}

- [Máquinas virtuais](/docs/api/vms) — provisione uma VM com uma destas imagens.
- [Tamanhos de VM](/docs/api/vm-sizes) — a configuração de computação em que a imagem dá boot.
- [Backups](/docs/api/backups) — snapshots e backups dos volumes de uma VM.
