---
title: "Armazenamento em blocos"
description: "Volumes persistentes para VMs — crie, anexe, desanexe, aumente e exclua."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Armazenamento em blocos

Volumes de blocos são discos persistentes que você anexa a VMs. Cada volume fica na região da sua sessão; um volume de dados sobrevive à VM a que está anexado (você pode desanexá-lo + anexá-lo a uma nova VM); os volumes podem crescer; e você pode fazer um snapshot ou um backup de um volume por meio de [Backups](/docs/api/backups).

## Tipos de volume {#tiers}

`GET /api/v1/storage/artifacts` lista o que você pode criar na região da sua sessão: os tipos de volume em `types` e as opções de armazenamento com preço em `volume_options`. `POST /api/v1/storage/` recebe o `size` em GB e o `volume_type`, um dos rótulos de `volume_options`, que define o preço. Os campos opcionais são um `type` de `types`, um `name`, uma `description`, uma `image` a partir da qual criar o volume e `subscription`, o plano de faturamento (padrão `Hourly`).

Um volume mantém o seu tipo para sempre: não existe uma chamada para alterá-lo. Os preços por `volume_type` estão em [Dados de preços](/docs/api/pricing-data).

## Ciclo de vida {#lifecycle}

`POST /api/v1/storage/` coloca o trabalho na fila e responde sem id; o novo volume aparece em `GET /api/v1/storage/`. O `status` dele vem do serviço de armazenamento em blocos. Os que você vai encontrar com mais frequência:

- `available` — criado, mas não anexado. É cobrado da mesma forma que um volume anexado (para o armazenamento, tanto faz).
- `in-use` — vinculado a uma VM. Visível dentro da VM como um dispositivo de blocos (`/dev/vdb`, `/dev/vdc`, …).
- `detaching` → `available` — sendo liberado de uma VM. Desmonte o sistema de arquivos dentro da VM antes de desanexar.

Desanexar é uma chamada separada de excluir. Excluir uma VM exclui o volume de boot criado a partir da imagem dela; os volumes que você anexou, ou passou em `volumes` ao criar a VM, ficam `available`.

`DELETE /api/v1/storage/` destrói os volumes cujos ids você lista em `ids`. Um volume excluído **não pode ser recuperado**, então faça um backup antes se quiser uma cópia recuperável. Com `cascade: true`, os snapshots do volume são excluídos junto com ele.

## Redimensionamento {#resize}

`POST /api/v1/storage/resize` com `{"volume_id": "…", "new_size": 500}` aumenta um volume para 500 GB. `new_size` precisa ser maior que o tamanho atual; qualquer outro valor retorna `400`. O sistema de arquivos dentro da VM precisa de uma chamada separada de `resize2fs` / `xfs_growfs` para ocupar o novo espaço.

Reduzir um volume não é suportado. Para diminuir: crie um novo volume menor, anexe-o, copie os dados e desanexe o antigo.

## Snapshots {#snapshots}

Snapshots e backups de um volume são feitos por meio de [Backups](/docs/api/backups): `POST /api/v1/backup_restore/volume_backups/create_backup` com o `volume_id` e `type: snapshot` (uma cópia pontual guardada junto com o volume) ou `type: backup` (uma cópia completa separada).

O snapshot é consistente na camada de blocos, não na camada da aplicação. Para um banco de dados, pause as gravações antes ou use a ferramenta de backup do próprio banco. Snapshots na camada de blocos são a escolha certa para volumes de sistema de arquivos que não rodam um mecanismo transacional.

Uma restauração coloca a cópia de volta no lugar do volume, com o mesmo tamanho; veja [Backups](/docs/api/backups#restore).

## Semântica de anexação {#attach}

Um volume pode ser anexado a **uma VM por vez**. A anexação múltipla (semântica de disco compartilhado) não é suportada.

`POST /api/v1/storage/attach` recebe o `volume_id`, o `instance_id` e um `mountpoint` opcional; sem ele, o volume recebe o primeiro dispositivo livre a partir de `/dev/vdb`. `POST /api/v1/storage/detach` recebe o `instance_id`, o `volume_id` e o `attachment_id`, que `GET /api/v1/storage/detach_artifacts` lista para uma VM.

Um volume e a VM a que ele é anexado ficam, os dois, na região da sua sessão.

## Observações sobre preços {#pricing}

- Armazenamento: cobrado por GB ao preço do `volume_type` do volume, no plano definido em `subscription`. Os preços estão em [Dados de preços](/docs/api/pricing-data).
- Sem cobrança por IOPS. Sem taxa por anexação. Sem sobretaxa de vazão.

## Próximos passos {#next-steps}

- [Máquinas virtuais](/docs/api/vms) — onde você anexa os volumes.
- [Armazenamento de objetos](/docs/api/object-storage) — para dados não estruturados que não precisam de acesso no nível de blocos (logs, backups, uploads de usuários).
- [Backups](/docs/api/backups) — snapshots e backups de um volume, e como restaurá-los.
