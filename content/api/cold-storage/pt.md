---
title: "Armazenamento frio"
description: "Armazenamento no tier de arquivo, com a menor tarifa por GB e recuperação medida à parte."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Armazenamento frio

O armazenamento frio é o tier de arquivo — barato para manter, mais lento para recuperar e com a recuperação medida à parte. Escolha-o quando você quase nunca lê os dados: backups de longo prazo, retenção para conformidade, logs brutos para auditorias.

## O que você paga {#pricing}

Três componentes de custo, todos medidos separadamente:

| Item                            | Tarifa                  | Quando você paga                                                     |
| ---------------------- | ----------------------- | ---------------------------------------------- |
| **Armazenamento**               | \$0,004/GB·mês          | Continuamente, enquanto o arquivo existir                            |
| **Recuperação**                 | \$0,02–\$0,05/GB        | Por solicitação de restauração, varia conforme a classe de recuperação |
| **Taxa de exclusão antecipada** | por GB × dias restantes | Se você excluir antes de 90 dias                                     |

Para comparação: a classe Standard do armazenamento de objetos custa \$0,013/GB·mês (3,25× a tarifa) — e ela não tem taxa de recuperação nem duração mínima de armazenamento. A troca é: pague menos para manter, mais para ler.

## Duração mínima de armazenamento {#min-duration}

Todo arquivo gera uma **cobrança mínima de 90 dias de armazenamento**. Exclua um arquivo após 30 dias e você será cobrado pelos 60 dias restantes como parte da exclusão. É o mesmo modelo que o AWS Glacier usa; é isso que permite uma tarifa de armazenamento tão baixa.

Na prática: não fique criando e excluindo objetos no armazenamento frio. O padrão certo é gravar uma vez e manter, ou excluir só depois de 90 dias.

## Classes de recuperação {#retrieval-classes}

| Classe      | Latência    | Custo por GB | Quando usar                                                    |
| ----------- | ----------- | ----------- | ----------------------------------------------------- |
| `expedited` | 1–5 minutos | \$0,05       | Recuperações para conformidade; auditorias avulsas com prazo   |
| `standard`  | 3–5 horas   | \$0,02       | O padrão; econômico para leituras não planejadas               |
| `bulk`      | 5–12 horas  | \$0,005      | Restaurar dezenas de TB ou mais durante a noite                |

Uma recuperação não tira os dados do arquivo de forma permanente — ela cria uma cópia temporária na classe Standard do armazenamento de objetos por 24 horas, acessível por uma URL pré-assinada. O arquivo em si não muda.

## Quando NÃO usar o armazenamento frio {#when-not-to-use}

- Qualquer coisa que você possa ler mais do que ~uma vez por trimestre — as taxas de recuperação superam a economia no armazenamento.
- Qualquer coisa com leitura urgente — até a recuperação `expedited` leva 1–5 minutos, não segundos.
- Dados com um ciclo de vida curto e conhecido — o mínimo de 90 dias torna caro ficar criando e excluindo.

Nos três casos, o [armazenamento de objetos](/docs/api/object-storage) com a classe de armazenamento IA ou Cold é uma opção melhor (taxas de recuperação menores, duração mínima mais curta ou inexistente).

## Próximos passos {#next-steps}

- [Armazenamento de objetos](/docs/api/object-storage) — a mesma família de produtos, para padrões de acesso mais frequentes.
- [Snapshots](/docs/api/snapshots) — os snapshots de VMs e volumes ficam no tier frio por padrão.
