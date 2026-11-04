---
title: "Visão geral da conta"
description: "Login e sessão — cadastre-se, entre e saia, redefina ou troque uma senha e mude de projeto, workspace ou região."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: account-overview
---

# Visão geral da conta

Estes endpoints gerenciam o seu login e a sessão que ele abre. O cadastro cria um [workspace](/docs/api/workspaces) com o nome do seu e-mail, e você é o primeiro usuário dele. O faturamento pertence a esse workspace; veja [Faturamento](/docs/api/invoices).

Cada chamada age sobre o próprio login, a própria sessão ou a própria senha de quem chama:

- **Cadastrar-se** — `POST /api/v1/account/registration` envia um token de verificação por e-mail. `POST /api/v1/account/reset_password` com `type: register`, o `token` e um `new_password` (com pelo menos 8 caracteres, repetido em `confirm_password`) conclui o cadastro.
- **Entrar e sair** — `POST /api/v1/account/login` recebe `email` e `password` e retorna um `access_token` com o `expires_at` dele. Um usuário criado dentro de um workspace também envia `domain`, o nome do workspace. `GET /api/v1/account/logout` encerra a sessão.
- **Senhas** — `POST /api/v1/account/forgot_password_request` envia por e-mail um token de redefinição de uso único, e `POST /api/v1/account/reset_password` com `type: reset` define a nova senha. `POST /api/v1/account/change_password` recebe o `current_password` e a nova senha.
- **Escopo e região** — `GET /api/v1/account/rescope` muda a sessão para um `project` ou um `domain` (um workspace) e também pode mudar a `region` dela. `GET /api/v1/account/get_scope_choices` lista os workspaces, projetos e regiões para os quais você pode mudar, `GET /api/v1/account/datacenters` lista as regiões com o estado de integridade de cada uma, e `GET /api/v1/account/un_scope` remove o escopo.

## Próximos passos {#next-steps}

- [Workspaces](/docs/api/workspaces) — o que o cadastro cria; os projetos ficam dentro dele.
- [Autenticação](/docs/authentication) — como funcionam as chaves de API.
- [Solicitações de região](/docs/api/region-requests) — peça à NimbusNexus que abra uma região que ela ainda não atende.
