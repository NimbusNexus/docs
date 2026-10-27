---
title: "Otimizar a fatura mensal"
description: "As cinco ações de maior impacto se sua fatura da NimbusNexus veio maior do que você esperava."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Otimizar a fatura mensal

Se a sua fatura da NimbusNexus veio maior do que o esperado, pela nossa experiência, 90% do gasto excedente vem dos mesmos cinco lugares. Percorrê-los em ordem leva cerca de 30 minutos e normalmente economiza 30–60% da fatura.

A ordem importa — as ações de maior impacto vêm primeiro.

## 1 · VMs paradas que você esqueceu {#stopped-vms}

VMs paradas ainda custam ~10% do custo em execução (você paga pelo disco + IP reservado). Três meses de uma `gp-8-32` parada custam mais ou menos o mesmo que um mês dela em execução.

Encontre-as:

```bash
curl "{{API_BASE_URL}}/v1/vms?state=stopped" \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { id, name, stopped_at, size }'
```

Para cada uma, decida:

- **Parada há < 1 semana e você lembra o motivo** → deixe como está; ela é candidata a rollback.
- **Parada há > 2 semanas e você não lembra o motivo** → faça um snapshot dela (para ter a imagem do disco) e depois um `DELETE`.
- **Parada há > 1 mês** → exclua. O que quer que estivesse nela não é mais candidato a rollback.

```bash
# Snapshot first
curl -X POST {{API_BASE_URL}}/v1/snapshots \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"source_vm_id\": \"$VM_ID\", \"name\": \"archive-$(date +%Y-%m-%d)\" }"

# Then delete the VM
curl -X DELETE {{API_BASE_URL}}/v1/vms/$VM_ID \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

O snapshot é bem mais barato que a VM parada (o armazenamento de snapshots custa $0,04/GB; IPs reservados e disco reservado em uma VM parada custam mais).

## 2 · IPs flutuantes não anexados {#unattached-ips}

IPs flutuantes não anexados custam $2,50/mês cada — o mesmo que um IP anexado a uma VM parada. A linha da fatura é pequena por IP, mas contas que já existem há algum tempo acabam acumulando vários.

```bash
curl "{{API_BASE_URL}}/v1/floating-ips?state=detached" \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { id, ipv4, region, allocated_at }'
```

Libere todos os que você não usa ativamente:

```bash
curl -X DELETE {{API_BASE_URL}}/v1/floating-ips/$IP_ID \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Se talvez você queira o mesmo IPv4 de volta depois (porque algo o incluiu em uma allow-list em outro lugar), anote quais IPs eram seus antes de liberá-los. Não reservamos IPs liberados — eles voltam para o pool regional. Não há como "congelar" um IP sem mantê-lo alocado.

## 3 · VMs superprovisionadas {#over-provisioned}

Uma VM rodando o tempo todo com 5–10% de CPU está pagando 10× o que precisa. Rode o `node_exporter` (ou apenas confira o gráfico por VM no painel) e procure VMs cujo P99 de CPU em 90 dias esteja abaixo de ~30%.

Para cada VM superprovisionada, a decisão certa depende do perfil do tráfego:

- **Tráfego baixo e constante** → reduza o tamanho. `POST /v1/vms/$ID/resize` para um tier menor. Leva ~30 segundos. O redimensionamento ao vivo é suportado dentro da mesma família (`gp-4-16` → `gp-2-8` funciona; `gp-4-16` → `co-4-8` exige parar, redimensionar e iniciar, porque a arquitetura muda).
- **Tráfego em rajadas** → considere os tamanhos otimizados para computação (família `co-`); eles têm uma relação CPU/RAM maior. Saem mais baratos por vCPU para cargas de trabalho limitadas por CPU.
- **VMs com GPU sem nada rodando na GPU** → redimensione para fora da família `gx-` de vez. VMs com GPU são 5–10× mais caras; se você não está usando a GPU, está jogando dinheiro fora.

## 4 · Classe de armazenamento de objetos inadequada {#storage-class}

O armazenamento de objetos tem três classes:

| Classe | Preço de armazenamento | Preço de recuperação | Usar para |
|---|---|---|---|
| Standard | $0,013/GB·mês | Grátis | Dados quentes (lidos com frequência) |
| Infrequent Access (IA) | $0,007/GB·mês | $0,005/GB | Dados mornos (lidos mensalmente) |
| Cold | $0,004/GB·mês | Mais alto, varia por classe (Expedited, Standard, Bulk) | Arquivo (lido raramente) |

A maioria das contas usa Standard para tudo por padrão e nunca revisa isso. Onde está o ganho:

```bash
# What buckets do you have, and what class?
curl {{API_BASE_URL}}/v1/buckets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { name, region, storage_class, size_gb }'
```

Para cada bucket, veja o timestamp do último acesso nos maiores objetos (o "object explorer" do painel mostra isso). Tudo o que não foi lido no último mês deveria estar em IA; tudo o que não foi lido em 6 meses provavelmente deveria estar em Cold.

Você não precisa mover objeto por objeto manualmente — defina uma regra de ciclo de vida:

```bash
curl -X PUT {{API_BASE_URL}}/v1/buckets/$BUCKET/lifecycle \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {
        "id": "tier-warm",
        "filter": { "prefix": "archive/" },
        "transitions": [
          { "after_days": 30,  "storage_class": "infrequent-access" },
          { "after_days": 180, "storage_class": "cold" }
        ]
      }
    ]
  }'
```

Isso muda o tier automaticamente conforme os dados envelhecem. É o mais barato para cargas de trabalho do tipo "produzo estes dados uma vez e raramente os leio de novo" (logs, artefatos de build, relatórios antigos).

## 5 · Snapshots de que você não precisa mais {#stale-snapshots}

Snapshots custam $0,04/GB·mês — bem menos que o disco de uma VM, mas eles se acumulam rápido se você faz um toda noite e nunca exclui nenhum. Um snapshot de 200 GB mantido por um ano custa $96.

```bash
curl "{{API_BASE_URL}}/v1/snapshots?older_than_days=180" \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { id, name, size_gb, created_at, source_vm_id }'
```

Três regras práticas para a retenção de snapshots:

- **Snapshots diários** de uma VM de produção → mantenha 14 e exclua o resto.
- **Snapshots semanais** → mantenha 8 (dois meses).
- **Snapshots mensais** → mantenha 12 (um ano). Além disso, mantenha só os de fim de ano.

Configure uma [política de backup agendado](/docs/api/backups) com essas regras de retenção embutidas para que isso nunca mais cresça sem limite.

## Lembretes sobre o modelo de preços {#reminders}

Algumas coisas que pegam de surpresa quem é cliente pela primeira vez:

- **O tráfego dentro da região entre recursos da NimbusNexus é gratuito.** Duas VMs em `us-east-1` se comunicando não pagam egress. O tráfego entre regiões entre recursos da NimbusNexus também é gratuito (um diferencial deliberado em relação à AWS, onde essa é a linha da fatura que mais surpreende).
- **O tráfego de saída para a internet custa $0,01/GB depois dos primeiros 100 GB/mês.** Em comparação com a AWS (onde custa $0,09/GB), isso faz diferença assim que você serve qualquer conteúdo público não trivial.
- **Faturamento por segundo para VMs.** Uma VM que roda por 90 segundos custa 1,5 minuto. Sem arredondamento para a hora cheia. Isso significa que cargas de trabalho de curta duração (runners de CI, jobs em lote) são realmente baratas — não complique demais para "minimizar execuções" se as execuções forem curtas.
- **O crédito inicial é concedido uma única vez.** Contas novas recebem um crédito; ele não é reposto. Se você está testando bastante, acompanhe o saldo de crédito no painel.

## Analisar a fatura {#invoice}

A página de faturamento do painel detalha as linhas da fatura por recurso e por dia. O filtro "top 10 costs" é o ponto de partida certo se você ainda não sabe o que está caro — quase sempre são uma ou duas linhas desproporcionais, não um padrão de muitos pequenos gastos que se somam.

Se quiser a fatura em JSON:

```bash
curl {{API_BASE_URL}}/v1/billing/invoices/current \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

A resposta traz projeções de custo por recurso para o restante do mês, para que você possa agir sobre o que está caro *agora* em vez de descobrir isso no fim do mês.

## Próximos passos {#next-steps}

- [Máquinas virtuais](/docs/api/vms) — `resize` para o caso de VMs superprovisionadas.
- [Armazenamento de objetos](/docs/api/object-storage) — as regras de ciclo de vida completas.
- [Snapshots](/docs/api/snapshots) e [Backups](/docs/api/backups) — a sintaxe das políticas de retenção.
- [Cotas](/docs/api/quotas) — a tabela de limites por projeto (separada do faturamento, mas relacionada).
