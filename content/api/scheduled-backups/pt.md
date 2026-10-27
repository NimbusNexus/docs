---
title: "Backups agendados"
description: "Agendamentos recorrentes de backup — diários, semanais, personalizados. Separados dos backups sob demanda."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: scheduled-backups
---

# Backups agendados

Os [backups](/docs/api/backups) sob demanda cobrem o caso "quero um snapshot deste volume agora". Os backups agendados cobrem todo o resto: backups noturnos de todos os volumes de produção, backups completos semanais combinados com incrementais diários, snapshots mensais retidos por um ano para conformidade.

Um agendamento é um pequeno documento JSON — escolha um alvo (um volume, uma VM, um banco de dados), uma frequência (no estilo cron), uma política de retenção (manter os N mais recentes ou expirar depois de X dias) e uma política de armazenamento (qual região/classe de armazenamento de backup usar). O agendador roda em segundo plano; as execuções que falham são tentadas de novo com backoff e aparecem no log de execuções do agendamento.

A maioria das contas de produção usa 2–4 agendamentos: diário mantendo 14, semanal mantendo 8, mensal mantendo 12 e, às vezes, um snapshot de fim de ano mantido por 7 anos para o financeiro/jurídico.

## Próximos passos {#next-steps}

- [Backups](/docs/api/backups) — a contraparte sob demanda e o tipo de recurso que os agendamentos produzem.
- [Armazenamento em blocos](/docs/api/block-storage) e [Snapshots](/docs/api/snapshots) — as origens dos backups.
- [Bancos de dados gerenciados](/docs/api/managed-databases) — têm seu próprio modelo de retenção; não usam agendamentos deste endpoint.
