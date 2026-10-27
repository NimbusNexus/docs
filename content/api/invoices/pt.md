---
title: "Faturas"
description: "Faturas mensais — liste, busque, veja o detalhamento."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: invoices
---

# Faturas

As faturas são geradas mensalmente, no dia 1º do mês seguinte, e cobrem todo o uso do mês-calendário anterior. Cada fatura é detalhada por recurso e por dia, para que você possa rastrear qualquer linha até VMs / volumes / buckets / bancos de dados específicos.

Este endpoint dá acesso programático aos mesmos dados que o painel mostra. Casos de uso: alimentar seu próprio sistema de atribuição de custos com as linhas da fatura, arquivar faturas para fins fiscais, conciliar com o seu registro de ordens de compra.

As faturas também estão disponíveis em PDF — o mesmo formato usado para declarar deduções fiscais na maioria das jurisdições. O formato JSON é a fonte oficial; o PDF é gerado a partir do JSON.

## Próximos passos {#next-steps}

- [Métodos de pagamento](/docs/api/payment-methods) — onde as faturas são cobradas.
- [Dados de preços](/docs/api/pricing-data) — os preços por recurso que produzem os totais da fatura.
