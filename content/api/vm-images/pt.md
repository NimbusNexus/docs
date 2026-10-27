---
title: "Imagens de VM"
description: "Imagens de boot do SO — templates públicos e imagens personalizadas do projeto."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Imagens de VM

Uma imagem de VM é o template de SO usado para dar boot no disco raiz de uma nova VM. A NimbusNexus oferece **imagens públicas** para as principais distribuições Linux e para o Windows Server; você também pode enviar suas próprias **imagens personalizadas**, criadas com ferramentas como o Packer ou fazendo um snapshot de uma VM configurada.

## Imagens públicas {#public-images}

O catálogo público é atualizado mensalmente com patches de segurança. Os slugs são estáveis entre patches; usar `ubuntu-24.04` hoje e de novo daqui a 6 meses dá a você 6 meses de patches aplicados à mesma base. Fixe um slug datado (por exemplo, `ubuntu-24.04-20260301`) se precisar de boots reproduzíveis byte a byte.

Slugs publicados atualmente:

- `ubuntu-24.04`, `ubuntu-22.04`, `ubuntu-20.04`
- `debian-12`, `debian-11`
- `fedora-40`, `fedora-39`
- `rocky-9`, `rocky-8`
- `almalinux-9`, `almalinux-8`
- `windows-2022`, `windows-2019`

Toda imagem pública inclui nossa configuração mínima de cloud-init: chaves SSH injetadas a partir das chaves registradas no projeto (veja [Chaves SSH](/docs/api/ssh-keys)), `apt-get update` ou equivalente no primeiro boot e o serviço de metadados fixado em `169.254.169.254`.

## Imagens personalizadas {#custom-images}

Imagens próprias são aceitas como arquivos **raw**, **qcow2** ou **vmdk** de até **128 GB** descompactados. A imagem é convertida para o nosso formato interno no upload (~1–3 minutos por GB) e depois vira uma imagem bootável comum para qualquer VM na mesma região.

As imagens personalizadas são cobradas a \$0,013/GB·mês (tarifa da classe Standard do armazenamento de objetos) pelo armazenamento. Não existe um tier separado de "armazenamento de imagens".

## Regiões {#regions}

As imagens públicas estão disponíveis em todas as regiões ativas. As imagens personalizadas têm escopo de região — enviar para `us-east-1` não torna a imagem bootável em `eu-central-1` sem uma cópia. Use `POST /v1/vm-images/{id}/copy` (fora da referência abaixo — em breve) para replicar.

## Próximos passos {#next-steps}

- [Máquinas virtuais](/docs/api/vms) — provisione uma VM com uma destas imagens.
- [Tamanhos de VM](/docs/api/vm-sizes) — a configuração de computação em que a imagem dá boot.
- [Snapshots](/docs/api/snapshots) — capture uma VM existente como snapshot e depois converta-o em uma imagem personalizada.
