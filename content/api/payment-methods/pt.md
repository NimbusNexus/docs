---
title: "Métodos de pagamento"
description: "Cartões salvos, contas ACH e configuração do pagamento padrão."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: payment-methods
---

# Métodos de pagamento

Os métodos de pagamento são os cartões bancários, as contas ACH e (no plano enterprise) os perfis de transferência bancária vinculados a uma conta. Um método é definido como padrão — é ele que é cobrado na fatura mensal. Os outros ficam como reserva (tentamos cada um, na ordem, se o padrão falhar).

Os dados do cartão nunca passam diretamente pela NimbusNexus — a criação do método de pagamento passa pelo nosso processador de pagamentos em conformidade com o PCI (hoje, o Stripe), e guardamos apenas a referência tokenizada + os metadados de exibição (bandeira, últimos quatro dígitos, validade). Você não precisa se preocupar com o escopo PCI do seu lado enquanto estiver usando a API; os números completos dos cartões nunca aparecem em nenhuma requisição à NimbusNexus.

## Próximos passos {#next-steps}

- [Faturas](/docs/api/invoices) — pelo que os métodos de pagamento são cobrados.
- [Visão geral da conta](/docs/api/account-overview) — a configuração do contato de faturamento.
