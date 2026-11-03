---
title: "Faturamento"
description: "Saldos, cobranças pendentes, crédito promocional e dados de faturamento do seu workspace."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: invoices
---

# Faturamento

O faturamento é por workspace. Estes endpoints leem a situação da conta do workspace e mantêm os dados de faturamento dele:

- `GET /api/v1/billing/public/balances` — as cobranças pós-pagas em aberto, o crédito promocional disponível e o saldo pré-pago em dinheiro, em um único retrato.
- `GET /api/v1/billing/public/accrued_charges` — o total cobrado até agora que ainda não foi quitado.
- `GET /api/v1/billing/public/cash_balance` — o saldo pré-pago em dinheiro, com o momento em que ele mudou pela última vez.
- `GET /api/v1/billing/public/promotion_grants` — o crédito promocional ativo, com o que resta de cada concessão e quando ela expira.
- `GET` e `PATCH /api/v1/billing/public/billing_info` — o endereço de faturamento, o nome da empresa e os endereços de e-mail que recebem extratos e recibos.

As faturas em si não estão disponíveis pela API.

Estas chamadas exigem uma sessão conectada, enviada como `Authorization: Bearer` ou pelo cookie da sessão. Uma chave de API não consegue fazê-las.

## Próximos passos {#next-steps}

- [Métodos de pagamento](/docs/api/payment-methods) — os cartões que recarregam o saldo pré-pago.
- [Dados de preços](/docs/api/pricing-data) — os preços por recurso por trás das cobranças.
