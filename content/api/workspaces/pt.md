---
title: "Workspaces"
description: "O nível de isolamento acima dos projetos. Um workspace contém projetos; os projetos contêm recursos."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: workspaces
---

# Workspaces

Um **workspace** é o nível de isolamento mais alto no modelo de contas da NimbusNexus. Todo projeto pertence a exatamente um workspace; todo usuário tem acesso com escopo de workspaces (e de projetos específicos dentro deles). A hierarquia é **workspace → projeto → recurso**.

Para a maioria das contas, um único workspace basta. Organizações maiores usam vários workspaces para separar faturamento, acesso e limites de recursos no nível da unidade organizacional — por exemplo, um workspace por unidade de negócio ou um por entidade jurídica. Tráfego, IAM e faturamento entre workspaces são todos isolados por design.

Não confunda um workspace com uma zona DNS — é a mesma palavra em alguns contextos (o OpenStack chama os workspaces de "domains"), mas o produto usa "workspace" em tudo o que é exibido ao usuário.

## Próximos passos {#next-steps}

- [Projetos](/docs/api/projects) — a próxima camada abaixo; o que os workspaces contêm.
- [Usuários](/docs/api/users) e [Funções](/docs/api/roles) — as concessões de IAM têm escopo dentro de um workspace.
- [Confiança entre projetos](/docs/api/cross-project-trusts) — permissão temporária entre as fronteiras de projetos dentro de um workspace.
