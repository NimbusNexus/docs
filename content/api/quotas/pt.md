---
title: "Cotas"
description: "Limites por projeto para VMs, vCPU, RAM, armazenamento, IPs flutuantes e outros recursos."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Cotas

Cotas são limites por projeto que restringem quanto de cada recurso um projeto pode ter. Elas evitam gastos descontrolados causados por loops acidentais e garantem que o uso de um projeto não esgote a capacidade de uma região.

## O que tem cota {#what}

Todo projeto tem uma cota para cada um destes itens:

| Recurso                       | Cota padrão | Observações                                                                    |
| ------------------- | ------------- | --------------------------------------------------------------- |
| VMs                           | 50          | Por região; "VM" conta todos os estados, exceto `terminated`                   |
| vCPU                          | 200         | Total de todas as VMs em execução                                              |
| RAM (GB)                      | 800         | Total de todas as VMs em execução                                              |
| Armazenamento em blocos (GB)  | 5.000       | Soma de todos os volumes (anexados + desanexados)                              |
| Armazenamento de objetos (GB) | ilimitado   | Só um limite flexível: entramos em contato acima de ~50 TB para alinhar expectativas |
| Snapshots                     | 200         | Por região; snapshots excluídos não contam                                     |
| Backups                       | 500         | Por região                                                                     |
| IPs flutuantes                | 20          | Por região                                                                     |
| Redes                         | 10          | Por região                                                                     |
| Grupos de segurança           | 50          | Por região                                                                     |
| Balanceadores de carga        | 10          | Por região                                                                     |
| Zonas DNS                     | 50          | Para o projeto inteiro                                                         |
| Usuários                      | 25          | Para o projeto inteiro                                                         |

Os padrões são conservadores. A maioria dos projetos de produção tem as cotas aumentadas para 5–10× nos eixos mais usados (vCPU, RAM, armazenamento) logo após o lançamento.

## Cota vs. uso {#quota-vs-usage}

Os endpoints expõem os dois:

- `GET /v1/quotas` — os **limites** (50 VMs, 200 vCPU, etc.)
- `GET /v1/quotas/usage` — o **consumo atual** (12 de 50 VMs usadas, 48 de 200 vCPU, etc.)

Sempre verifique o uso antes de criar recursos em massa; uma requisição que faria você ultrapassar a cota retorna 429 com `Retry-After` vazio (como a cota não é limitada no tempo, tentar de novo não ajuda — você precisa excluir algo ou aumentar a cota).

## Aumentar uma cota {#raising}

Os aumentos de cota passam pelo formulário de contato do suporte, não pela API. Três motivos:

1. **Planejamento de capacidade.** Aumentos grandes (10× ou mais) precisam reservar hardware na região de destino.
2. **Conformidade.** Alguns aumentos de cota exigem uma conversa rápida sobre o formato da carga de trabalho.
3. **Prevenção de abuso.** Um endpoint self-service de aumento de cota seria a primeira coisa que uma conta comprometida chamaria.

A maioria dos aumentos é aprovada em menos de um dia útil. Migrações de produção têm resposta no mesmo dia se você as sinalizar na solicitação.

## Cotas nas diferentes regiões {#regions}

A maioria das cotas é **por região** (VMs, snapshots, redes). Algumas valem **para o projeto inteiro** (zonas DNS, usuários). A resposta do endpoint deixa isso explícito — cada entrada de cota traz um campo `scope` (`region: us-east-1` ou `project`).

## Próximos passos {#next-steps}

- [Projetos](/docs/api/projects) — o contêiner ao qual as cotas se aplicam.
- [Autenticação](/docs/authentication) — como chamar estes endpoints.
- O **formulário de contato do suporte**, em [/contact/support]({{BASE_URL}}/contact/support) — por onde passam os aumentos de cota.
