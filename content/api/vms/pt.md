---
title: "Máquinas virtuais"
description: "Provisione, inspecione, redimensione e destrua VMs. Referência ao vivo dos endpoints, gerada automaticamente a partir da especificação OpenAPI."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Máquinas virtuais

Uma máquina virtual da NimbusNexus é uma instância de computação com uso medido — uma árvore de processos, uma interface de rede, um disco raiz — cobrada por segundo. Você cria uma escolhendo um tamanho e uma região; todo o resto (volumes de blocos, IPs públicos, snapshots) é anexado a ela como recursos separados.

## Quando usar uma VM {#when-to-use}

As VMs são a primitiva certa quando você precisa de:

- Estado persistente em disco entre requisições (um banco de dados, um cache de build, um worker de fila de longa duração).
- Controle total do SO — instalar pacotes, ajustar parâmetros do kernel, rodar qualquer coisa que precise de acesso ao sistema.
- Uma configuração de instância específica — muita memória para uma carga de trabalho de análise, GPU para inferência, otimizada para computação para um serviço limitado por CPU.

Se a sua carga de trabalho é **sem estado e orientada a requisições**, plataformas de contêineres (serviços gerenciados de Kubernetes, runtimes serverless) costumam ser uma opção melhor. A linha divisória é mais ou menos esta: se você ficaria triste caso um reinício de processo apagasse os arquivos locais, você quer uma VM.

## Tamanhos, famílias, nomes {#sizes}

Os tamanhos usam o formato `<family>-<vCPU>-<RAM_GB>`. Três famílias hoje:

- `gp-*` — uso geral. CPU + RAM equilibradas. A maioria das cargas de trabalho começa aqui.
- `co-*` — otimizada para computação. 2× a CPU por dólar da `gp`, metade da RAM por dólar.
- `mo-*` — otimizada para memória. A troca inversa. Indicada para caches em memória, heaps da JVM, área temporária de análises.

Então `gp-4-16` é 4 vCPU, 16 GB de RAM, uso geral. `co-16-32` é 16 vCPU, 32 GB de RAM, otimizado para computação. A lista completa fica em `GET /v1/vms/sizes` (ainda não renderizada automaticamente nesta referência — em breve).

## Ciclo de vida {#lifecycle}

Uma VM passa por estes estados:

- `provisioning` — o disco está sendo preparado e o hipervisor está alocando a instância. ~5–30 segundos com uma imagem em cache, até 90 segundos quando a imagem é baixada pela primeira vez.
- `running` — boot concluído, instância aceitando tráfego. Esse é o estado estável em que você passa a maior parte do tempo.
- `stopping` → `stopped` — desligamento ordenado. A VM continua existindo; você deixa de pagar pela computação, mas continua pagando pelo armazenamento.
- `terminated` — a VM foi destruída. Os volumes de blocos anexados também foram destruídos (o padrão) ou foram desanexados e continuam disponíveis (se `preserve_volumes: true` foi definido na exclusão).

As transições de estado são retornadas no campo `state` em todo `GET`. Transições de longa duração informam o progresso em um objeto `operation` embutido — veja a página [Convenções](/docs/conventions) para o padrão de polling de operações usado aqui e no resto da API.

## Nomes e ids estáveis {#ids}

Toda VM tem dois identificadores:

- `id` — opaco, prefixo `vm_`, sufixo base32 de 26 caracteres. Estável durante toda a vida da VM. Use-o em URLs, chaves estrangeiras, logs de auditoria.
- `name` — legível por humanos, 1–63 caracteres, alfanuméricos + hífens, único dentro de um projeto. Mutável via `PUT /v1/vms/{id}`. Não o coloque em nenhum caminho de código que você não queira reescrever no dia em que alguém renomear a VM.

A referência de endpoints abaixo usa `{id}` nos templates de caminho; o valor que você passa é o id opaco.
