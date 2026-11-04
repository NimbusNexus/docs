---
title: "Regiões"
description: "As regiões atendidas pela NimbusNexus e como a sua sessão escolhe uma."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Regiões

Uma região da NimbusNexus é um local geográfico com pelo menos uma zona de disponibilidade. Todo recurso que você cria — VMs, volumes, buckets — fica em exatamente uma região.

## Regiões atuais {#current}

Hoje, a produção atende uma região, em Frankfurt, na Alemanha.

`GET /api/v1/account/datacenters` lista as regiões, cada uma com o seu `region_name`, um `label` e um `order` de exibição e uma flag `healthy`; `current` é a região em que a sua sessão está. `GET /api/v1/account/rescope?region=<region_name>` muda a sessão para outra região. A resposta da API é a fonte de verdade.

## Como escolher uma região {#picking}

Três coisas importam:

1. **Latência até seus usuários.** Escolha a região mais próxima de onde vem a maioria das suas requisições. Tempos de ida e volta abaixo de 50 ms dão sensação de agilidade; acima de 200 ms, de lentidão, mesmo com um bom código.

2. **Latência até suas dependências.** Se você chama outros serviços (bancos de dados, APIs de terceiros, sua própria infraestrutura), coloque a VM na região mais próxima deles. As idas e voltas entre computação e armazenamento acontecem em toda requisição; as idas e voltas entre usuário e computação acontecem uma vez por carregamento de página.

3. **Requisitos de residência de dados.** GDPR / DSGVO / leis estaduais de proteção de dados podem determinar onde os dados dos clientes podem ficar armazenados. A única região de hoje fica em Frankfurt, na Alemanha.

## Próximos passos {#next-steps}

- [Máquinas virtuais](/docs/api/vms) — uma VM é criada na região atual da sua sessão.
- [Visão geral da conta](/docs/api/account-overview) — onde a lista de regiões e a troca de região da sessão estão documentadas.
- [Solicitações de região](/docs/api/region-requests) — peça uma região que ainda não é atendida.
