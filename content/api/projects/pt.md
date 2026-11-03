---
title: "Projetos"
description: "A unidade de isolamento para recursos e controle de acesso, dentro de um workspace."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Projetos

Um projeto é a **unidade de isolamento** na NimbusNexus — para recursos e controle de acesso. Todo projeto pertence a um [workspace](/docs/api/workspaces). Todo recurso (VM, volume, bucket, rede, …) pertence a exatamente um projeto, e toda chave de API tem escopo de exatamente um projeto. O faturamento é por workspace: uma única fatura cobre todos os projetos dele.

## Por que os projetos importam {#why}

Duas garantias que a fronteira do projeto dá a você:

1. **Raio de impacto.** Uma chave de API comprometida do projeto `dev` não consegue tocar recursos de `prod`. Eles literalmente não são visíveis de dentro de `dev`.
2. **Cota.** As cotas são por projeto. Um projeto que sai criando VMs sem controle não esgota a margem de outro projeto.

## Criar um projeto {#create}

`POST /api/v1/projects/` recebe o ID do workspace como `domain_id`, um `project_name` e, opcionalmente, uma `project_description` e `enabled`. O nome precisa ser único no workspace; se não for, a API retorna `409`. Um workspace pode ter um limite de projetos; acima dele, criar retorna `403`.

Os projetos ficam lado a lado no workspace. A API não permite aninhar um projeto dentro de outro.

## O que fica em um projeto {#contents}

- VMs, volumes, backups
- Buckets
- Redes, sub-redes, roteadores, grupos de segurança, IPs flutuantes, balanceadores de carga
- Zonas DNS + registros
- Atribuições de função e chaves de API (os usuários a quem elas pertencem ficam no workspace)

Os projetos não podem ser mesclados. Para consolidar dois projetos, você teria de exportar e reimportar os recursos e excluir o original — não existe uma operação atômica de mesclagem, de propósito, porque a atribuição resultante de "o que foi mesclado onde" seria impossível de auditar.

## Exclusão {#deletion}

`DELETE /api/v1/projects/` recebe o `id` do projeto no corpo da requisição, e é **irreversível**. Remove a rede padrão do projeto e depois exclui o projeto e as atribuições de função dele. Não exclui mais nada, então exclua antes as VMs, os volumes, os buckets e os outros recursos do projeto.

## Próximos passos {#next-steps}

- [Workspaces](/docs/api/workspaces) — o contêiner em que os projetos ficam.
- [Funções](/docs/api/roles) — o que os usuários precisam ter para fazer qualquer coisa.
- [Cotas](/docs/api/quotas) — limites de recursos por projeto.
