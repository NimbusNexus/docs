---
title: "Assinaturas"
description: "Nível do plano, ciclo de faturamento e endpoints de upgrade e downgrade."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: subscriptions
---

# Assinaturas

Sua assinatura é o nível do plano + ciclo de faturamento + configuração de pagamento que define tudo o que é cobrável na conta. Os níveis de plano (free, starter, production, enterprise) determinam o SLA de suporte, as cotas padrão, o crédito incluído e o acesso a certas regiões. O ciclo de faturamento (mensal, anual) define a frequência das faturas; o faturamento anual tem desconto em relação ao mensal.

Os upgrades de plano entram em vigor imediatamente; os downgrades entram em vigor no fim do ciclo de faturamento atual, para evitar disputas de cobrança pró-rata no meio do mês. Os planos Enterprise são negociados e provisionados manualmente; a API cobre até o nível production, mas encaminha as solicitações do enterprise para o contato de vendas.

## Próximos passos {#next-steps}

- [Faturas](/docs/api/invoices) — o que as assinaturas produzem.
- [Métodos de pagamento](/docs/api/payment-methods) — o que é cobrado pela assinatura.
- [Visão geral da conta](/docs/api/account-overview) — o contexto mais amplo da conta.
