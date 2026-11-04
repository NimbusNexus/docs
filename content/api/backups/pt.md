---
title: "Backups"
description: "Snapshots e backups de volumes de blocos, sob demanda ou agendados, restaurados no lugar."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Backups

Um backup é uma cópia pontual de um [volume de blocos](/docs/api/block-storage), de um de dois tipos: um `snapshot`, guardado pelo serviço de armazenamento em blocos junto com o volume, ou um `backup`, uma cópia completa separada. Você os faz **sob demanda**, ou um [agendamento](/docs/api/scheduled-backups) os faz por você.

## Backups vs. snapshots {#backups-vs-snapshots}

Os dois são cópias pontuais; a diferença está no formato operacional:

|                | `type: snapshot`                                              | `type: backup`                                                                   |
| -------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| O que é        | Um snapshot guardado junto com o volume                       | Uma cópia completa separada, que também pode ir para o seu próprio armazenamento |
| Criado por     | Uma chamada direta ou um agendamento                          | Uma chamada direta ou um agendamento                                             |
| Restaurado com | `POST /api/v1/backup_restore/volume_backups/snapshot_restore` | `POST /api/v1/backup_restore/volume_backups/backup_restore`                      |

Um snapshot pertence ao seu volume: excluir o volume com `cascade: true` (`DELETE /api/v1/storage/`) também exclui os snapshots dele.

## Fazer uma cópia {#create}

`POST /api/v1/backup_restore/volume_backups/create_backup` copia um volume na hora. Informe o `volume_id` e o `type`, `snapshot` ou `backup`, além de um `name`, uma `description` e um `permanent` opcionais. Para um `backup`, `storage_ids` também envia a cópia para as conexões de armazenamento externo que você configurou com `POST /api/v1/external/connections/`.

A chamada coloca o trabalho na fila e responde na hora, ou retorna `409` se a cópia não couber na sua cota de backup. `GET /api/v1/backup_restore/volume_backups/` lista as suas cópias, filtradas por `backup_types` e `statuses`, com `limit` (padrão 10) e `offset`. O `status` de uma cópia é `pending`, `in_progress`, `completed` ou `failed`.

## Cópias agendadas {#policies}

Um agendamento faz cópias por você. Crie um com `POST /api/v1/backup_restore/backup_scheduler/`, informando uma `frequency` e uma `backup_quantity`, e depois vincule-o a cada volume com `POST /api/v1/backup_restore/volume_scheduler/`, informando o `volume_id`, o `schedule_id` e o `type`. Os detalhes estão em [Backups agendados](/docs/api/scheduled-backups).

## Retenção {#retention}

Um agendamento mantém as `backup_quantity` cópias mais recentes (padrão 5) de cada volume vinculado a ele e exclui as mais antigas à medida que chegam cópias novas; `outside_backup_quantity` (padrão 1) faz o mesmo com as cópias em cada armazenamento externo. As cópias que você faz sob demanda ficam até você excluí-las.

Para manter uma cópia fora dessa rotação, defina `permanent: true` nela, ao fazê-la ou depois, com `PATCH /api/v1/backup_restore/volume_backups/{volume_backup_id}`.

Exclua uma cópia com `DELETE /api/v1/backup_restore/volume_backups/single/{volume_backup_id}`, ou várias com `DELETE /api/v1/backup_restore/volume_backups/bulk` e os ids delas no parâmetro de query `backup_ids`.

## Restauração {#restore}

Restaure um snapshot com `POST /api/v1/backup_restore/volume_backups/snapshot_restore`, e um backup com `POST /api/v1/backup_restore/volume_backups/backup_restore`. As duas chamadas recebem `{"backup_id": "…"}`, colocam o trabalho na fila e respondem na hora. A cópia precisa estar `completed` e ser do tipo do endpoint; caso contrário, a chamada retorna `409`.

Uma restauração acontece no lugar. Ela cria um novo volume a partir da cópia, com o mesmo tamanho e na mesma zona de disponibilidade do original, e o coloca onde o original estava:

- Um volume de dados é desanexado da VM dele, e o volume restaurado é anexado no lugar.
- No caso do volume de boot de uma VM, a VM é reconstruída sobre o disco restaurado. A nova VM assume as portas e os IPs flutuantes da antiga, e a VM antiga é excluída. A VM recebe um novo `id`; o disco restaurado mantém as chaves SSH que tinha.

As cópias e os vínculos de agendamento do volume original passam para o volume restaurado.

## Próximos passos {#next-steps}

- [Backups agendados](/docs/api/scheduled-backups) — faça cópias em um cronograma.
- [Armazenamento em blocos](/docs/api/block-storage) — os volumes de onde vêm essas cópias.
- [Máquinas virtuais](/docs/api/vms) — o que uma restauração do volume de boot reconstrói.
