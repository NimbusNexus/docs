---
title: "Backups"
description: "Backups agendados e sob demanda, com deduplicação, políticas de retenção e restauração entre regiões."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Backups

Backups são cópias gerenciadas de VMs, volumes e bancos de dados, mantidas no tier de armazenamento frio com deduplicação e retenção configurável. Os endpoints aceitam tanto backups **sob demanda** (avulsos, você chama POST) quanto backups **agendados** (recorrentes, guiados por uma política anexada ao recurso de origem).

## Backups vs. snapshots {#backups-vs-snapshots}

Os dois são cópias pontuais; a diferença está no formato operacional:

|                               | Snapshot                               | Backup                                                                        |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------------- |
| Criado por                    | Somente chamada direta à API           | Chamada direta OU uma política recorrente                                     |
| Retenção                      | 7 dias por padrão, extensão manual     | Definida por uma política de retenção explícita (tiers diário/semanal/mensal) |
| Preço                         | \$0,04/GB·mês (tier frio, deduplicado) | \$0,04/GB·mês + taxas de recuperação por restauração                          |
| Replicação entre regiões      | Manual, restaurando e depois copiando  | Embutida na política                                                          |
| Restauração como novo recurso | Sim                                    | Sim                                                                           |
| Log de auditoria              | Padrão                                 | Padrão + metadados de atribuição à política                                   |

Use snapshots para cópias avulsas que você mesmo vai consumir. Use backups para o padrão recorrente "sempre temos uma cópia de 7 dias, uma de 30 dias e uma de 365 dias" — esse é o formato orientado por política.

## Backups orientados por política {#policies}

Anexe uma política de backup a uma VM / volume / banco de dados com:

```json
{
  "source_id": "vm_01H...",
  "source_kind": "vm",
  "schedule": "daily",
  "retention": {
    "daily": 7,
    "weekly": 4,
    "monthly": 12,
    "yearly": 5
  }
}
```

Essa política mantém 7 diários + 4 semanais + 12 mensais + 5 anuais = 28 backups ativos em regime estável. Os backups mais antigos expiram automaticamente; você não precisa fazer a limpeza manualmente.

Os endpoints de política ficam em `/v1/backups/policies` (não aparecem na amostra mínima abaixo — a referência completa está na especificação ao vivo).

## Bloqueios de retenção {#retention}

Um backup dentro de um tier de retenção ativo (por exemplo, "diário, reter 7") fica **com bloqueio de retenção** durante esse período. Tentar excluí-lo antes da expiração retorna 409. Essa é a funcionalidade de conformidade: um usuário não consegue excluir um backup que ainda está dentro da janela de retenção, mesmo que tenha direitos de admin.

Para contornar isso, você precisaria desanexar a origem da política (o que deixa o backup órfão, sem bloqueio de retenção) e depois excluí-lo. O log de auditoria registra que o backup ficou órfão.

## Replicação entre regiões {#cross-region}

Uma política pode especificar uma região secundária: todo backup criado pela política é replicado para a secundária em até ~10 minutos após a criação. A cópia replicada é cobrada como armazenamento entre regiões (\$0,005/GB·mês a mais que a primária).

Restaurar a partir da secundária não exige nenhuma cerimônia extra — `POST /v1/backups/{id}/restore` com o id da cópia secundária; a região de destino, por padrão, é a região da secundária. Um exercício de DR comum: restauração mensal a partir da secundária em um projeto sandbox, validação e destruição.

## Próximos passos {#next-steps}

- [Snapshots](/docs/api/snapshots) — o primo avulso.
- [Armazenamento frio](/docs/api/cold-storage) — o tier em que os backups ficam.
- [Máquinas virtuais](/docs/api/vms), [Armazenamento em blocos](/docs/api/block-storage), [Bancos de dados gerenciados](/docs/api/managed-databases) — os três tipos de recurso de origem.
