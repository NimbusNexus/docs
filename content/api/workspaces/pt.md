---
title: "Workspaces"
description: "O nível de isolamento acima dos projetos. Um workspace contém projetos; os projetos contêm recursos."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: workspaces
---

# Workspaces

Um **workspace** é o nível de isolamento mais alto no modelo de contas da NimbusNexus. Todo projeto pertence a exatamente um workspace; todo usuário tem acesso com escopo de workspaces (e de projetos específicos dentro deles). A hierarquia é **workspace → projeto → recurso**.

Para a maioria das contas, um único workspace basta. Organizações maiores usam vários workspaces para separar faturamento, acesso e limites de recursos no nível da unidade organizacional — por exemplo, um workspace por unidade de negócio ou um por entidade jurídica. O faturamento é por workspace, e o acesso só atravessa a fronteira de um workspace quando você a abre: você convida alguém para dentro, ou compartilha uma rede ou uma zona DNS com outro projeto.

Não confunda um workspace com uma zona DNS — é a mesma palavra em alguns contextos (o OpenStack chama os workspaces de "domains"). A API mantém a palavra do OpenStack: os endpoints de workspace ficam em `/api/v1/domains/`, e os campos deles também dizem domain (`domain_id`, `domain_name`, `domain_description`).

## Próximos passos {#next-steps}

- [Projetos](/docs/api/projects) — a próxima camada abaixo; o que os workspaces contêm.
- [Usuários](/docs/api/users) e [Funções](/docs/api/roles) — as concessões de IAM têm escopo dentro de um workspace.
- [Confiança entre projetos](/docs/api/cross-project-trusts) — delegações de curta duração que deixam a NimbusNexus terminar um trabalho para você em um projeto.
