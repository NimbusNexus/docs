---
title: "Backups agendados"
description: "Agendamentos recorrentes de backup — diários, semanais ou mensais. Separados dos backups sob demanda."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: scheduled-backups
---

# Backups agendados

Os [backups](/docs/api/backups) sob demanda cobrem o caso "quero um snapshot deste volume agora". Os backups agendados fazem cópias de um volume em um cronograma e mantêm as mais recentes.

Um agendamento tem uma `frequency` e uma `backup_quantity`, o número de cópias a manter (padrão 5). Um agendamento `daily` roda todo dia; `weekly` roda a cada 7 dias e `monthly` a cada 30 dias, contados a partir do dia em que o agendamento foi criado. Crie um com `POST /api/v1/backup_restore/backup_scheduler/`; ele pertence ao seu workspace. Depois, vincule-o a cada volume com `POST /api/v1/backup_restore/volume_scheduler/`, informando o `volume_id`, o `schedule_id` e o `type` de cópia, `snapshot` ou `backup`. A vinculação retorna `409` se as cópias não couberem na sua cota de backup.

Para enviar as cópias `backup` também para um armazenamento externo, defina `use_outside_storage` na vinculação e associe o armazenamento com `POST /api/v1/backup_restore/volume_scheduler/config-storage` (`config_id`, `storage_id`, `priority`). O `outside_backup_quantity` do agendamento (padrão 1) define quantas cópias manter lá.

O agendador roda em segundo plano. Uma execução que falha é tentada de novo, e uma que continua falhando envia uma [notificação](/docs/api/notifications). Para manter uma cópia além da rotação, como uma cópia de fim de ano, defina `permanent: true` nela com `PATCH /api/v1/backup_restore/volume_backups/{volume_backup_id}`.

## Próximos passos {#next-steps}

- [Backups](/docs/api/backups) — a contraparte sob demanda e o tipo de recurso que os agendamentos produzem.
- [Armazenamento em blocos](/docs/api/block-storage) — os volumes que os agendamentos copiam.
