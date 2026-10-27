---
title: "Regiões"
description: "Locais geográficos atendidos pela NimbusNexus, com status ativo e de pré-lançamento."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Regiões

Uma região da NimbusNexus é um local geográfico com pelo menos uma zona de disponibilidade. Todo recurso que você cria — VMs, bancos de dados gerenciados, volumes, buckets — fica em exatamente uma região. Operações entre regiões (replicação, failover, tráfego entre recursos) funcionam, mas são explícitas e medidas.

## Regiões atuais {#current}

| Código           | Local               | Status                    |
| ---------------- | --------------- | ---------------------- |
| `us-east-1`      | Virgínia, EUA       | Ativa                     |
| `us-west-1`      | Los Angeles, EUA    | Ativa                     |
| `eu-central-1`   | Frankfurt, Alemanha | Ativa                     |
| `ap-southeast-1` | Singapura           | Pré-lançamento (~2 meses) |

A lista oficial também é servida em `GET /v1/regions`; a tabela acima é ilustrativa. Quando você estiver lendo esta página, a resposta da API é a fonte de verdade.

## Como escolher uma região {#picking}

Três coisas importam:

1. **Latência até seus usuários.** Escolha a região mais próxima de onde vem a maioria das suas requisições. Tempos de ida e volta abaixo de 50 ms dão sensação de agilidade; acima de 200 ms, de lentidão, mesmo com um bom código.

2. **Latência até suas dependências.** Se você chama outros serviços (bancos de dados, APIs de terceiros, sua própria infraestrutura), coloque a VM na região mais próxima deles. As idas e voltas entre computação e armazenamento acontecem em toda requisição; as idas e voltas entre usuário e computação acontecem uma vez por carregamento de página.

3. **Requisitos de residência de dados.** GDPR / DSGVO / leis estaduais de proteção de dados podem determinar onde os dados dos clientes podem ficar armazenados. A região de Frankfurt (`eu-central-1`) é a opção com residência na UE; `us-east-1` e `us-west-1` têm residência nos EUA. Não replicamos dados entre regiões sem uma solicitação explícita sua.

Se seus usuários estão no mundo todo, **implante em várias regiões**. Um padrão comum é `us-east-1` para as Américas + `eu-central-1` para EMEA + `ap-southeast-1` para APAC, com roteamento baseado em DNS (por latência, por geolocalização ou com uma CDN na frente).

## Regiões em pré-lançamento {#preview}

As regiões com `status: 'preview'` aceitam cargas de trabalho antes da disponibilidade geral. Na prática:

- Elas aceitam as mesmas chamadas de API que as regiões ativas.
- Os preços são iguais aos das regiões ativas.
- O SLA **não** se aplica durante o pré-lançamento — incidentes ainda podem causar interrupções enquanto fazemos o burn-in da região.
- A disponibilidade geral costuma chegar ~2 meses depois da abertura do pré-lançamento. Avisaremos os admins da conta por e-mail antes de mudar uma região para `live`.

Singapura (`ap-southeast-1`) é a região em pré-lançamento no momento.

## Próximos passos {#next-steps}

- Veja [Máquinas virtuais](/docs/api/vms) para saber como criar uma VM em uma região específica.
- Veja [Bancos de dados gerenciados](/docs/api/managed-databases) para a disponibilidade de bancos de dados por região (Kafka e OpenSearch chegam ~30 dias depois de VM/Postgres em regiões novas).
- Para arquiteturas multirregião com replicação, veja o guia **Failover entre regiões** (em breve).
