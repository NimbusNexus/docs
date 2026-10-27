---
title: "Projetos"
description: "A unidade de isolamento para recursos, faturamento e controle de acesso."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Projetos

Um projeto é a **unidade de isolamento** na NimbusNexus — para recursos, faturamento e controle de acesso. Todo recurso (VM, volume, bucket, banco de dados, rede, …) pertence a exatamente um projeto; toda chave de API tem escopo de exatamente um projeto; toda linha de fatura corresponde a exatamente um projeto.

## Por que os projetos importam {#why}

Três garantias que a fronteira do projeto dá a você:

1. **Raio de impacto.** Uma chave de API comprometida do projeto `dev` não consegue tocar recursos de `prod`. Eles literalmente não são visíveis de dentro de `dev`.
2. **Atribuição de custos.** Cada projeto recebe sua própria fatura. Se o financeiro quiser cobrar do marketing a fatura de hospedagem do site, o marketing ganha um projeto. Se a engenharia quiser alocar os gastos por time, cada time ganha um projeto.
3. **Cota.** As cotas são por projeto. Um projeto que sai criando VMs sem controle não esgota a margem de outro projeto.

## Hierarquia de projetos {#hierarchy}

Os projetos podem ter um projeto pai (a partir do nível de organização). A hierarquia fica assim:

```text
acme-org (root)
├── acme-prod
├── acme-staging
└── acme-dev
```

Um usuário com a função `admin` em `acme-org` herda automaticamente o admin em todos os filhos. Um usuário com admin apenas em `acme-prod` não consegue ver `acme-staging` nem `acme-dev`. Esse é o mecanismo padrão para "governança centralizada, dia a dia descentralizado".

A hierarquia é opcional. Contas do nível padrão recebem um projeto raiz por conta; contas do nível de organização podem montar árvores de até 5 níveis de profundidade.

## O que fica em um projeto {#contents}

- VMs, volumes, snapshots, backups
- Buckets, arquivos
- Bancos de dados
- Redes, sub-redes, roteadores, grupos de segurança, IPs flutuantes, balanceadores de carga
- Zonas DNS + registros
- Usuários, funções + atribuições, chaves de API
- A conta de faturamento que paga por tudo isso

Os projetos não podem ser mesclados. Para consolidar dois projetos, você teria de exportar e reimportar os recursos e excluir o original — não existe uma operação atômica de mesclagem, de propósito, porque a atribuição resultante de "o que foi mesclado onde" seria impossível de auditar.

## Exclusão {#deletion}

`DELETE /v1/projects/{id}` é **destrutivo e irreversível**. Todo recurso dentro do projeto é destruído: VMs, volumes, snapshots, backups, buckets, bancos de dados, zonas DNS — tudo. Os registros de usuários e as atribuições de função são revogados de forma atômica.

Por segurança, a API exige um header de confirmação (`X-Confirm-Project-Delete: <project-id>`) nessa chamada; sem ele, a requisição retorna 400.

## Próximos passos {#next-steps}

- [Usuários](/docs/api/users) — as identidades dentro de um projeto.
- [Funções](/docs/api/roles) — o que os usuários precisam ter para fazer qualquer coisa.
- [Cotas](/docs/api/quotas) — limites de recursos por projeto.
