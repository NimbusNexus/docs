---
title: "Usuários"
description: "Registros de identidade dentro de um projeto — atribua funções, gere chaves de API, assuma relações de confiança."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Usuários

Um usuário é uma identidade dentro de um [projeto](/docs/api/projects). Os usuários têm funções (que concedem permissões), podem gerar chaves de API (com escopo do usuário) e podem assumir relações de confiança para agir em nome de outros projetos.

## Usuário ≠ login {#identity-model}

Um "usuário" nesta API é **o registro de identidade**, não o ser humano. A mesma pessoa pode ser:

- Um usuário em `prod` (o projeto de produção)
- Outro usuário em `staging` (registro de identidade separado, mesmo e-mail)
- Um terceiro usuário em `dev`

Cada usuário é totalmente isolado dos outros — tem suas próprias atribuições de função, suas próprias chaves de API, seu próprio log de auditoria. Essa é a fronteira de isolamento por projeto em que nos apoiamos para conter o raio de impacto: um usuário de `dev` comprometido não consegue tocar recursos de produção porque ele literalmente não existe como identidade lá.

Para organizações que querem uma pessoa → uma identidade em todos os projetos, use federação via SAML/OIDC; a identidade fornecida pelo SSO passa a ser o mesmo usuário em todos os projetos mapeados pelas regras do IdP. Essa é uma funcionalidade enterprise; contas do nível padrão usam o modelo por projeto descrito acima.

## O que você pode fazer com um usuário {#actions}

- **Criar** — provisiona um novo usuário dentro do projeto de quem chama. É preciso ter `iam:write` no projeto.
- **Obter** — lê o registro de um usuário. `iam:read` basta.
- **Atualizar** — altera o nome, a descrição, a flag enabled. Alguns campos (por exemplo, o e-mail) são imutáveis depois da criação; a API retorna 400 se você tentar.
- **Excluir** — remove permanentemente. Todas as atribuições de função e chaves de API do usuário são revogadas de forma atômica.

Não existe "desativar" separado de "excluir". Se você quer uma desativação lógica (manter o histórico de auditoria, impedir o login), defina `enabled: false` com uma atualização — esse é o caminho da desativação lógica. Excluir é exclusão física + revogar tudo.

## O que você não pode fazer {#cant-do}

- **Mover um usuário entre projetos.** Crie um novo usuário no projeto de destino, copie as concessões de função que quiser e exclua o antigo.
- **Definir uma senha pela API.** As senhas passam apenas pelo fluxo de redefinição de senha; a API nunca aceita uma senha em texto puro como entrada. Usuários com SSO dispensam senhas completamente.
- **Listar usuários de um projeto em que você não tem atribuições de função.** O isolamento entre projetos é rígido — não há enumeração entre projetos.

## Próximos passos {#next-steps}

- [Projetos](/docs/api/projects) — o contêiner em que os usuários ficam.
- [Funções](/docs/api/roles) — o que conceder a um usuário depois que ele existe.
- [Autenticação](/docs/authentication) — como funcionam as chaves de API (emitidas por usuário).
