---
title: "Solicitações de região"
description: "Solicite acesso a uma região à qual você ainda não tem acesso ou um aumento de cota em uma região à qual já tem."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: region-requests
---

# Solicitações de região

Por padrão, as contas novas recebem acesso a uma região (a que escolheram no cadastro). Para adicionar acesso a outras regiões, é preciso uma solicitação de região — um formulário curto que explica a carga de trabalho que precisa da nova região. A maioria das contas de produção é aprovada em até um dia útil; esse controle existe para o planejamento de capacidade e para sinalizar padrões incomuns (uma conta recém-criada pedindo capacidade em cinco regiões no primeiro dia merece uma conversa rápida).

Este endpoint também cuida dos aumentos de cota — uma solicitação para aumentar o limite de quantidade de VMs, de vCPU ou de armazenamento em uma região à qual você já tem acesso. O motivo do controle é o mesmo: solicitações grandes exigem planejamento de capacidade. Veja [Cotas](/docs/api/quotas) para o modelo de cotas em si.

Esta parte da API existe para que um deploy programático possa disparar a solicitação e seguir adiante; a aprovação continua acontecendo manualmente do nosso lado (este é um dos poucos cantos da API que, por design, não são totalmente self-service).

## Próximos passos {#next-steps}

- [Regiões](/docs/api/regions) — a lista de regiões disponíveis.
- [Cotas](/docs/api/quotas) — os limites por projeto que uma solicitação de região também pode ajustar.
- [Visão geral da conta](/docs/api/account-overview) — o contexto da conta para o acesso a regiões.
