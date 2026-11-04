---
title: "Usuários"
description: "Registros de identidade dentro de um workspace — atribua funções, gere chaves de API."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Usuários

Um usuário é uma identidade dentro de um [workspace](/docs/api/workspaces). Os usuários têm funções nos [projetos](/docs/api/projects) do workspace (que concedem permissões) e podem gerar chaves de API (cada uma pertence ao usuário e tem escopo de um único projeto).

## Usuário ≠ login {#identity-model}

Um "usuário" nesta API é **o registro de identidade**, não o ser humano. Cada usuário pertence a exatamente um workspace, e o nome dele é único ali. Dentro do workspace, o mesmo usuário pode ter funções diferentes em projetos diferentes:

- Uma função em `prod` (o projeto de produção)
- Outra função em `staging`
- Nenhuma função em `dev`

O que um usuário pode fazer em um projeto vem das funções que ele tem ali, concedidas diretamente ou por meio de um [grupo](/docs/api/user-groups). Essa é a fronteira em que se apoiar para conter o raio de impacto: conceda funções em `prod` só aos usuários que precisam delas.

## O que você pode fazer com um usuário {#actions}

- **Criar** — adiciona um usuário ao workspace de quem chama, com um `name` e, opcionalmente, um `password`, uma `description` e a flag `enabled`.
- **Obter** — lê o registro de um usuário pelo ID.
- **Atualizar** — altera o nome, a descrição, a flag enabled ou a senha.
- **Excluir** — remove permanentemente. Todas as atribuições de função e chaves de API do usuário são revogadas de forma atômica.

As quatro exigem a função `admin`. Atualizar e excluir também aceitam a chave de API de um admin. Criar e obter precisam de uma sessão com escopo do próprio workspace, não de um dos projetos dele. Uma chave de API sempre tem escopo de um único projeto, então uma chamada com uma chave a qualquer uma das duas recebe `400`.

Uma senha entra e nunca sai: o registro de um usuário só tem `id`, `name`, `description` e `enabled`.

Não existe "desativar" separado de "excluir". Se você quer uma desativação lógica (manter o histórico de auditoria, impedir o login), defina `enabled: false` com uma atualização — esse é o caminho da desativação lógica. Excluir é exclusão física + revogar tudo.

## O que você não pode fazer {#cant-do}

- **Mover um usuário para outro workspace.** Crie um novo usuário no workspace de destino, conceda ali as funções que quiser e exclua o antigo. Dentro de um workspace não há nada para mover: conceda ao usuário uma função no outro projeto.
- **Obter um usuário de outro workspace.** Obter só encontra usuários do workspace de quem chama. Para qualquer outro, a API retorna `404`.

## Próximos passos {#next-steps}

- [Workspaces](/docs/api/workspaces) — o contêiner em que os usuários ficam.
- [Funções](/docs/api/roles) — o que conceder a um usuário depois que ele existe.
- [Autenticação](/docs/authentication) — como funcionam as chaves de API (emitidas por usuário).
