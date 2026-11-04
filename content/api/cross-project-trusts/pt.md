---
title: "Confiança entre projetos"
description: "Delegações de curta duração que deixam a NimbusNexus agir por você em um projeto, para tarefas em fila e credenciais do armazenamento de objetos."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: cross-project-trusts
---

# Confiança entre projetos

Uma relação de confiança é uma delegação de curta duração de você para o próprio usuário de serviço da NimbusNexus, em um dos seus projetos. A NimbusNexus cria uma quando precisa terminar um trabalho para você depois que a sua chamada retorna, como a criação ou a exclusão de uma VM em fila ou a criação de um volume, e quando você emite uma credencial do armazenamento de objetos. O registro de uma relação de confiança mostra o `trustor_user_id` (você), o `trustee_user_id` (a NimbusNexus), o `project_id`, as `roles` (`member` em toda relação de confiança que a NimbusNexus cria), um `expires_at` e uma flag `impersonation`.

A relação de confiança que você cria de propósito é uma credencial do armazenamento de objetos. `POST /api/v1/object_storage/credentials` emite uma para o seu projeto atual e retorna o `trust_id` dela. Um editor independente apresenta esse id no header `X-Trust-Id` nas chamadas ao armazenamento de objetos e, assim, chega ao armazenamento do projeto sem ter o seu token completo. `ttl_seconds` é uma sugestão; o servidor impõe um teto a ele.

`GET /api/v1/trusts/` lista as suas relações de confiança, e `GET /api/v1/trusts/{trust_id}` lê uma. `DELETE /api/v1/trusts/{trust_id}` revoga uma, por exemplo uma credencial de armazenamento de que você não precisa mais.

## Próximos passos {#next-steps}

- [Funções](/docs/api/roles) — o que uma relação de confiança delega.
- [Usuários](/docs/api/users) e [Projetos](/docs/api/projects) — as pontas de uma relação de confiança.
- [Armazenamento de objetos](/docs/api/object-storage) — onde uma credencial de armazenamento é usada.
- [Modelo de segurança](/docs/security) — o contexto mais amplo para o design de IAM.
