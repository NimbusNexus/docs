---
title: "Máquinas virtuais"
description: "Provisione, inspecione, redimensione e destrua VMs. Referência ao vivo dos endpoints, gerada automaticamente a partir da especificação OpenAPI."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Máquinas virtuais

Uma máquina virtual da NimbusNexus é uma instância de computação com um disco de boot e uma interface de rede para cada rede de que ela participa. Você cria uma com `POST /api/v1/instance/` na região da sua sessão; todo o resto (volumes de blocos, IPs públicos) é anexado a ela como recursos separados.

## Quando usar uma VM {#when-to-use}

As VMs são a primitiva certa quando você precisa de:

- Estado persistente em disco entre requisições (um banco de dados, um cache de build, um worker de fila de longa duração).
- Controle total do SO — instalar pacotes, ajustar parâmetros do kernel, rodar qualquer coisa que precise de acesso ao sistema.
- Uma configuração de instância específica — a quantidade de vCPUs e de RAM de que a sua carga de trabalho precisa.

Se a sua carga de trabalho é **sem estado e orientada a requisições**, plataformas de contêineres (serviços gerenciados de Kubernetes, runtimes serverless) costumam ser uma opção melhor. A linha divisória é mais ou menos esta: se você ficaria triste caso um reinício de processo apagasse os arquivos locais, você quer uma VM.

## Configuração e criação {#sizes}

`POST /api/v1/instance/` recebe um `name` e um `spec` que define a configuração da VM: `architecture` e `vm_class`, `cpu` (vCPUs) e `ram` (MB), e o `volume_type` do disco de boot dela (veja [Armazenamento em blocos](/docs/api/block-storage#tiers)). Ele também precisa de uma `image` (ou de `volumes` bootáveis), de pelo menos uma `network` e de pelo menos um `security_group`. Entre os campos opcionais estão `sshs` (a [chave SSH](/docs/api/ssh-keys) a instalar), `volume_size` (o tamanho do disco de boot em GB quando você faz o boot a partir de `image`; padrão 5), `user_data`, `metadata` e `subscription`. Entrar em uma rede de provedor também exige `bandwidth_mbps` e `subscription.bandwidth`; sem eles, a chamada recebe `400`.

Não existem códigos de tamanho. `GET /api/v1/instance/artifacts` lista em `vm_options` as opções de `architecture` e `vm_class` da região da sua sessão, junto com as imagens, redes, grupos de segurança, chaves SSH, grupos de servidores e volumes que você pode usar. A VM roda em um [flavor](/docs/api/vm-sizes) com exatamente o seu `cpu` e a sua `ram`; a API cria um se não houver nenhum. Os preços estão em [Dados de preços](/docs/api/pricing-data).

## Ciclo de vida {#lifecycle}

Criar uma VM é assíncrono: `POST /api/v1/instance/` coloca o trabalho na fila e responde `{"success": true}`, sem id. Encontre a nova VM em `GET /api/v1/instance/` e acompanhe o `status` dela, o valor do próprio serviço de computação. Os que você vai encontrar com mais frequência:

- `BUILD` — a VM está sendo criada.
- `ACTIVE` — em execução.
- `SHUTOFF` — parada.
- `VERIFY_RESIZE` — redimensionada, esperando que você confirme ou reverta (veja [Tamanhos de VM](/docs/api/vm-sizes#resizing)).
- `ERROR` — algo falhou; `fault` diz o quê.

`POST /api/v1/instance/action` inicia, para ou exclui VMs: liste os ids delas em `servers` e defina `cmd` como `start`, `stop` ou `delete`. Uma VM parada continua sendo cobrada: a cobrança vai da criação até a exclusão, no plano definido em `subscription.vm` (padrão `Monthly`). Excluir uma VM exclui o volume de boot criado a partir da imagem dela; os volumes passados em `volumes`, ou anexados depois, ficam `available`.

## Nomes e ids estáveis {#ids}

Toda VM tem dois identificadores:

- `id` — o UUID da VM. Estável durante toda a vida da VM. Use-o em URLs, chaves estrangeiras, logs de auditoria.
- `name` — legível por humanos, qualquer string não vazia. Altere-o, ou a `description`, com `PATCH /api/v1/instance/{instance_id}`. Não o coloque em nenhum caminho de código que você não queira reescrever no dia em que alguém renomear a VM.

A referência de endpoints abaixo usa `{instance_id}` nos templates de caminho (`{server_id}` nos endpoints de [Interfaces de VM](/docs/api/vm-interfaces)); o valor que você passa é o `id` da VM.
