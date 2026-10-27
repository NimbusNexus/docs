---
title: "Armazenamento em blocos"
description: "Volumes NVMe persistentes anexados a VMs. Três tiers, redimensionamento ao vivo, snapshots."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Armazenamento em blocos

Volumes de blocos são discos NVMe persistentes que você anexa a VMs. Cada volume fica em uma única região; sobrevive à VM a que está anexado (você pode desanexá-lo + anexá-lo a uma nova VM); pode ser redimensionado sem downtime; e pode ter um snapshot gravado no armazenamento de objetos sob demanda.

## Tiers {#tiers}

| Tier          | Por GB·mês | Vazão      | IOPS (pico) | Quando usar                                                                                                         |
| ------------- | ------------ | ---------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `standard`    | \$0,11     | 250 MB/s   | 3.000       | Discos raiz, bancos de dados de desenvolvimento, qualquer coisa que você queira manter barata.                      |
| `performance` | \$0,18     | 1.000 MB/s | 16.000      | Discos de bancos de dados de produção, caches de build, dados quentes. **Padrão para bancos de dados gerenciados.** |
| `extreme`     | \$0,30     | 4.000 MB/s | 64.000      | Cargas de trabalho sensíveis à latência — veiculação de anúncios, área temporária de análises, qualquer coisa com gargalo no disco. |

Os três tiers usam o mesmo hardware NVMe; a diferença está no QoS da camada de agendamento, não na camada de mídia. Você pode redimensionar **e** trocar de tier sem downtime — comece no Standard, passe para o Performance quando ultrapassar o orçamento de IOPS e volte se o uso se estabilizar.

## Ciclo de vida {#lifecycle}

Os volumes passam por quatro estados:

- `available` — criado, mas não anexado. É cobrado da mesma forma que um volume anexado (para o armazenamento, tanto faz).
- `attached` — vinculado a uma VM. Visível dentro da VM como um dispositivo de blocos (`/dev/sdb`, `/dev/sdc`, …).
- `detaching` → `available` — sendo liberado de uma VM. A desmontagem acontece no lado do servidor; antes, garanta que o sistema de arquivos tenha feito o flush.
- `deleted` — destruído. **Não pode ser recuperado.** Faça um snapshot antes se quiser um backup recuperável.

Desanexar é uma chamada separada de excluir. De propósito, não excluímos automaticamente um volume quando a VM a que ele está anexado é destruída — perder o disco de um banco de dados porque um colega destruiu a VM errada é exatamente o tipo de desastre que a API deve tornar difícil de cometer por acidente.

## Redimensionamento {#resize}

`POST /v1/volumes/{id}/resize` com `{ "size_gb": 500 }` aumenta um volume. O disco cresce ao vivo; o sistema de arquivos dentro da VM precisa de uma chamada separada de `resize2fs` / `xfs_growfs` para ocupar o novo espaço. Documentamos esse passo nos [guias de VM](/docs/api/vms) de cada SO.

Reduzir um volume online não é suportado. Para diminuir: faça um snapshot, crie um novo volume menor a partir do snapshot, anexe o novo, copie os dados e desanexe o antigo. É fácil de automatizar com um script; não oferecemos isso como funcionalidade nativa porque a armadilha de perda de dados é perigosa demais.

## Snapshots {#snapshots}

Snapshots são cópias pontuais guardadas no armazenamento de objetos (a classe `cold` — barata, recuperada sob demanda quando você restaura).

- Disparados por `POST /v1/volumes/{id}/snapshots`.
- Levam ~10 segundos para o ponto de consistência e depois continuam copiando em segundo plano.
- Armazenados a \$0,04/GB·mês.
- Restauráveis para um novo volume de tamanho **igual ou maior**, em qualquer região (a restauração entre regiões conta como egress entre regiões, a \$0,005/GB).

O snapshot é consistente na camada de blocos, não na camada da aplicação. Para bancos de dados, prefira a API de snapshots do próprio banco (veja [Bancos de dados gerenciados](/docs/api/managed-databases)) — essas APIs suspendem as gravações no nível do mecanismo. Snapshots na camada de blocos são a escolha certa para volumes de sistema de arquivos que não rodam um mecanismo transacional.

## Semântica de anexação {#attach}

Um volume pode ser anexado a **uma VM por vez**. A anexação múltipla (semântica de disco compartilhado) não é suportada — coordenar no nível da aplicação o acesso a um volume NVMe compartilhado é mais difícil do que a superfície da API faz parecer, e preferimos não criar essa armadilha.

A anexação tem escopo de região: um volume em `us-east-1` não pode ser anexado a uma VM em `eu-central-1`. Snapshot + restauração é o padrão certo para mover dados entre regiões.

## Observações sobre preços {#pricing}

- Armazenamento: por GB·mês, cobrado por segundo. A classe de armazenamento (Standard/Performance/Extreme) define a tarifa; o tamanho define o multiplicador.
- Snapshots: \$0,04/GB·mês, cobrados sobre o tamanho do conteúdo do snapshot (deduplicado entre snapshots do mesmo volume).
- Replicação entre regiões: \$0,005/GB·mês pela cópia replicada, mais o egress padrão entre regiões na sincronização inicial.
- Sem cobrança por IOPS. Sem taxa por anexação. Sem sobretaxa de vazão.

## Próximos passos {#next-steps}

- [Máquinas virtuais](/docs/api/vms) — onde você anexa os volumes.
- [Armazenamento de objetos](/docs/api/object-storage) — para dados não estruturados que não precisam de acesso no nível de blocos (logs, backups, uploads de usuários). Mais barato em grande escala.
- [Convenções](/docs/conventions) para polling de operações, idempotência, formatos de erro.
