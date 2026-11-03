---
title: "Cotas"
description: "Limites por projeto para VMs, vCPU, RAM, armazenamento, IPs flutuantes e outros recursos."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Cotas

Cotas são limites por projeto que restringem quanto de cada recurso um projeto pode ter. Elas evitam gastos descontrolados causados por loops acidentais e garantem que o uso de um projeto não esgote a capacidade de uma região.

## O que tem cota {#what}

Os endpoints de cota cobrem quatro serviços. Cada um responde com os seus próprios nomes de cota, por exemplo:

| Serviço    | O que ele limita          | Exemplos de nomes de cota                                             |
| ---------- | ------------------------- | --------------------------------------------------------------------- |
| `nova`     | VMs                       | `instances`, `cores`, `ram` (em MB)                                   |
| `cinder`   | Armazenamento em blocos   | `volumes`, `gigabytes`, `snapshots`, `backups`                        |
| `neutron`  | Rede                      | `network`, `subnet`, `port`, `router`, `floatingip`, `security_group` |
| `projects` | Projetos no seu workspace | `max_projects`                                                        |

Leia os padrões com `GET /api/v1/quota/{service}?defaults=true`. `max_projects` é `-1`, o que significa sem limite, a menos que um limite tenha sido definido para o seu workspace.

## Cota vs. uso {#quota-vs-usage}

Os endpoints expõem os dois:

- `GET /api/v1/quota/{service}` — os **limites**, como um mapa de nome de cota para número.
- `GET /api/v1/quota/{service}/usage` — o **consumo atual**: `used`, `reserved` e `limit` para cada nome de cota.

`{service}` é `nova`, `cinder`, `neutron` ou `projects`.

Sempre verifique o uso antes de criar recursos em massa; uma requisição que faria você ultrapassar a cota falha (como a cota não é limitada no tempo, tentar de novo não ajuda — você precisa excluir algo ou aumentar a cota).

## Aumentar uma cota {#raising}

Peça um aumento com `POST /api/v1/quota-request/`: informe o `service_name`, o `quota_name` e o `new_value`, e diga o motivo em `reason`. A solicitação vale para o seu projeto atual, ou para o seu workspace quando o serviço é `projects`. Ela exige a função `manager` ou `admin`, e cada cota só pode ter uma solicitação aberta por vez.

Um admin da NimbusNexus analisa cada solicitação manualmente. Aprová-la aplica o novo limite; uma solicitação também pode ser rejeitada ou devolvida para você fazer alterações. De qualquer forma, a resposta chega como uma [notificação](/docs/api/notifications). `GET /api/v1/quota-request/list` lista as suas solicitações, e `PATCH` ou `DELETE /api/v1/quota-request/` altera ou retira uma solicitação aberta.

## Cotas nas diferentes regiões {#regions}

Os números de `nova`, `cinder` e `neutron` são da região em que a sua sessão está; mude de região com `GET /api/v1/account/rescope?region=<region_name>`. A cota de `projects` conta os projetos do seu workspace inteiro. As respostas são mapas simples de nomes de cota para números, sem campo de região nem de escopo.

## Próximos passos {#next-steps}

- [Projetos](/docs/api/projects) — o contêiner ao qual as cotas se aplicam.
- [Autenticação](/docs/authentication) — como chamar estes endpoints.
- [Notificações](/docs/api/notifications) — onde chega a resposta a uma solicitação de cota.
