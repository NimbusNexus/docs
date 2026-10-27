---
title: "Grupos de usuários"
description: "Grupos de usuários para atribuir funções em conjunto. Úteis quando os times crescem além das concessões por usuário."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: user-groups
---

# Grupos de usuários

Um grupo de usuários é uma coleção nomeada de usuários que podem receber funções juntos. Em vez de conceder `vms:read` a quinze engenheiros, um por um, você o concede ao grupo `backend-team` e adiciona os novos engenheiros ao grupo.

Os grupos têm escopo de workspace. Um usuário pode pertencer a vários grupos; um grupo pode ter funções em vários projetos dentro do seu workspace. As atribuições de função são aditivas — um usuário recebe a união de todas as funções concedidas diretamente a ele mais todas as funções concedidas a um grupo do qual faz parte.

Para times pequenos (menos de ~10 pessoas), concessões por usuário geralmente bastam. Os grupos passam a ser a resposta certa em algum ponto entre 10 e 50 usuários, quando "auditar quem tem acesso ao projeto X" precisa ser respondido em segundos, e não conferindo 30 entradas de IAM à mão.

## Próximos passos {#next-steps}

- [Usuários](/docs/api/users) — o que os grupos contêm.
- [Funções](/docs/api/roles) — o que é concedido a um grupo.
- [Workspaces](/docs/api/workspaces) — o escopo dos grupos.
