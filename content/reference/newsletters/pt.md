---
title: "API de Newsletters"
description: "Todas as operações da API REST de Newsletters, com a requisição em curl, TypeScript, Python ou Go."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: reference
---

# API de Newsletters

A API REST por trás do Newsletters: gerencie listas e seus tópicos, publique formulários de inscrição com double opt-in, gerencie assinantes e o consentimento deles, e escreva, teste e envie edições. Cada operação abaixo mostra a requisição na linguagem escolhida no topo da página. O Newsletters ainda não tem SDK, então TypeScript, Python e Go usam o cliente HTTP habitual de cada linguagem.

As chamadas usam uma chave de API de Newsletters, criada no [console da sua conta]({{ACCOUNT_BASE_URL}}/api-keys). As rotas públicas de assinantes não usam chave: são elas que um formulário de inscrição e os links dos e-mails enviados chamam.
