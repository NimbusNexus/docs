---
title: "API de Webhooks"
description: "Todas as operações da API REST de Webhooks, com a chamada REST, a chamada do SDK em Python, TypeScript ou Go e o comando nn-webhooks."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: reference
---

# API de Webhooks

A API REST por trás do [Webhooks](/docs/product-webhooks): publique eventos, gerencie os endpoints que os recebem e inspecione e reenvie entregas, uma a uma ou em lote. Cada operação abaixo mostra a requisição na linguagem escolhida no topo da página. Quando o [SDK](/docs/product-webhooks/sdks) ou a [CLI](/docs/product-webhooks/cli) tem a operação, você vê essa chamada; caso contrário, vê uma requisição HTTP simples.

As chamadas usam uma chave de API de Webhooks, criada no [console da sua conta]({{ACCOUNT_BASE_URL}}/api-keys). O escopo dela define o que ela pode fazer: `admin` pode fazer tudo, `publish` só pode publicar e `read` só pode ler. Gravações que recebem um projeto se aplicam ao projeto padrão do workspace, a menos que você passe `project_id`.
