---
title: "Funções"
description: "Funções predefinidas e personalizadas, mais os endpoints de atribuição de função que concedem a um usuário uma função em um projeto."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Funções

Uma função é um pacote de permissões. A **atribuição de função** é o ato de conceder uma função a um usuário ou a um [grupo](/docs/api/user-groups) em um projeto, ou no próprio workspace. O mesmo usuário pode ter funções diferentes em projetos diferentes; um usuário sem nenhuma função em um projeto não consegue nem vê-lo.

## Funções predefinidas {#built-in}

`GET /api/v1/roles/` lista as funções que você pode conceder: as funções globais da plataforma, marcadas com `is_global: true`, e as funções personalizadas que o seu workspace criou. Entre as funções globais estão `reader`, `member`, `manager` e `admin`. `GET /api/v1/roles/{role_id}` lê uma delas.

## Funções personalizadas {#custom}

`POST /api/v1/roles/` cria uma função no seu workspace, com um `name` e uma `description` opcional. `PATCH /api/v1/roles/{role_id}` altera qualquer um dos dois, e `DELETE /api/v1/roles/{role_id}` remove a função. Só as funções do próprio workspace podem ser alteradas ou excluídas; para uma função global, as duas chamadas retornam `404`.

## Conceder e revogar {#grant}

`POST /api/v1/roles/grant` recebe uma lista de atribuições, então uma única chamada pode conceder várias. Cada atribuição indica uma `role`, um `user` ou um `group`, e um `project` ou, para o próprio workspace, um `domain`, tudo por ID. `POST /api/v1/roles/revoke` recebe a mesma lista e remove essas atribuições.

`GET /api/v1/roles/assignments` lista as atribuições do workspace, nos projetos dele e no próprio workspace, incluindo as que vêm por meio de um grupo. Filtre por `role`, `user`, `group`, `project` ou `domain`.

Conceder e revogar também aceitam a chave de API de um admin. As outras chamadas de funções precisam de uma sessão de admin com escopo do próprio workspace: uma chave de API sempre tem escopo de um único projeto, então uma chamada com uma chave a elas recebe `400`.

## Como as atribuições de função se combinam {#compose}

Um usuário pode ter várias atribuições de função em um projeto. O conjunto efetivo de permissões é a **união** — a lista de funções é aditiva, não multiplicativa. Uma função concedida diretamente ao usuário e outra concedida a um dos grupos dele valem as duas.

Revogar uma função não revoga as outras. Para tirar todo o acesso de um usuário, revogue cada atribuição, uma de cada vez, ou exclua o usuário (o que revoga todas as atribuições de forma atômica).

## Próximos passos {#next-steps}

- [Usuários](/docs/api/users) — a quem você concede funções.
- [Projetos](/docs/api/projects) — onde você concede funções.
- [Autenticação](/docs/authentication) — como as chaves de API se relacionam com as funções dos usuários.
