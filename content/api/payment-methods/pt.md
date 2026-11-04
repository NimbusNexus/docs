---
title: "Métodos de pagamento"
description: "Cartões salvos e o cartão padrão para recargas."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: payment-methods
---

# Métodos de pagamento

Os métodos de pagamento são os cartões que o seu workspace salvou. Um deles é o padrão para recargas, que adicionam fundos ao saldo pré-pago do workspace.

- `POST /api/v1/payment/payment_methods/setup-intent` começa a salvar um cartão. Ele retorna o `client_secret` de um SetupIntent do Stripe, e o cartão é confirmado com o Stripe, incluindo o 3-D Secure.
- `GET /api/v1/payment/payment_methods/` lista os cartões salvos, com bandeira, últimos quatro dígitos, validade e qual deles é o padrão.
- `POST /api/v1/payment/payment_methods/{payment_method_id}/set_default` torna um cartão o padrão para recargas, e `DELETE /api/v1/payment/payment_methods/{payment_method_id}` remove um.
- `POST /api/v1/payment/payment_methods/{payment_method_id}/add_funds` cobra um cartão para recarregar o saldo. Quando o banco pede uma confirmação, o resultado é `requires_action`, com um `client_secret` para confirmar; depois, `POST /api/v1/payment/payment_methods/topups/{attempt_id}/sync` obtém o desfecho.

Os dados do cartão nunca passam diretamente pela NimbusNexus — a criação do método de pagamento passa pelo nosso processador de pagamentos em conformidade com o PCI (hoje, o Stripe), e guardamos apenas a referência tokenizada + os metadados de exibição (bandeira, últimos quatro dígitos, validade). Você não precisa se preocupar com o escopo PCI do seu lado enquanto estiver usando a API; os números completos dos cartões nunca aparecem em nenhuma requisição à NimbusNexus.

Estas chamadas exigem uma sessão conectada, enviada como `Authorization: Bearer` ou pelo cookie da sessão. Uma chave de API não consegue fazê-las.

## Próximos passos {#next-steps}

- [Faturamento](/docs/api/invoices) — os saldos que esses cartões recarregam e os seus dados de faturamento.
- [Dados de preços](/docs/api/pricing-data) — os preços por recurso por trás das cobranças.
