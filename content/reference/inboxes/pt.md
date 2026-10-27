---
title: "API de Inboxes"
description: "Todas as operações da API REST de Inboxes, com a requisição em curl, TypeScript, Python ou Go."
publishedAt: 2026-10-19
updatedAt: 2026-10-27
kind: reference
---

# API de Inboxes

A API REST por trás do [Inboxes](/docs/product-inboxes): crie caixas de entrada, os endereços de e-mail descartáveis, e encontre-as pelo endereço; renomeie, desative e exclua caixas de entrada; leia e busque as mensagens que elas recebem, em uma caixa de entrada ou em todas elas, e esvazie-as; e consulte seu plano e seu uso. Cada operação abaixo mostra a requisição na linguagem escolhida no topo da página. O Inboxes ainda não tem SDK, então TypeScript, Python e Go usam o cliente HTTP habitual de cada linguagem.

As chamadas usam uma chave de API de Inboxes, criada no [console da sua conta]({{ACCOUNT_BASE_URL}}/api-keys). Ler mensagens pela API exige um plano pago; o [início rápido](/docs/product-inboxes/quickstart) guia você pela primeira caixa de entrada, e a [visão geral](/docs/product-inboxes#search) explica como buscar mensagens e ler os headers delas.
