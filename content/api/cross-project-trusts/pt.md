---
title: "Confiança entre projetos"
description: "Concessões temporárias de permissão entre projetos. A primitiva certa para automação entre projetos."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: cross-project-trusts
---

# Confiança entre projetos

Uma relação de confiança concede a um usuário de um projeto permissão temporária para agir em outro projeto — sem que esse usuário precise ser membro dele ou usar uma chave de API compartilhada. A relação de confiança carrega uma função específica, uma expiração e um escopo de personificação opcional.

O caso de uso clássico: um pipeline de CI/CD que está identificado no projeto `shared-infra`, mas precisa implantar recursos em `acme-prod`. Sem relações de confiança, você daria à chave da CI acesso de admin nos dois projetos (raio de impacto ruim) ou copiaria chaves entre projetos (pior ainda). Com uma relação de confiança, `shared-infra` emite uma concessão `vms:write` temporária em `acme-prod`; as chamadas da CI apresentam a relação de confiança junto com as credenciais normais.

As relações de confiança respeitam o modelo de segurança — o usuário que concede só pode conceder funções que ele mesmo tem, e a relação de confiança expira, no máximo, quando expira a concessão que está sendo delegada. Não existe caminho para escalonamento de privilégios.

## Próximos passos {#next-steps}

- [Funções](/docs/api/roles) — o que uma relação de confiança delega.
- [Usuários](/docs/api/users) e [Projetos](/docs/api/projects) — as pontas de uma relação de confiança.
- [Modelo de segurança](/docs/security) — o contexto mais amplo para o design de IAM.
