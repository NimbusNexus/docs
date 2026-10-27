---
title: "Autenticação de dois fatores"
description: "Segundos fatores TOTP e WebAuthn na sua conta."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: two-factor-auth
---

# Autenticação de dois fatores

A autenticação de dois fatores adiciona um segundo fator (um código TOTP de um app autenticador ou uma passkey WebAuthn) além do login com senha. Os endpoints daqui cobrem o cadastro, a listagem de dispositivos, a remoção de dispositivos e o download de códigos de recuperação.

Para usuários do painel, a 2FA é feita pelo navegador, na página de configurações da conta; a API daqui serve para automação (provisionar um novo usuário admin, rotacionar códigos de recuperação programaticamente, exigir 2FA em toda a organização antes de uma auditoria de conformidade). Quem chama com chave de API não precisa de 2FA — as chaves já são, por si só, um fator do tipo "algo que você tem"; a 2FA protege o caminho de login humano no painel.

Recomendação forte: ative a 2FA em toda conta humana com concessões de função em projetos de produção. A maioria das contas comprometidas tem como origem a reutilização de senha + a falta de um segundo fator.

## Próximos passos {#next-steps}

- [Usuários](/docs/api/users) — o recurso ao qual a 2FA está vinculada.
- [Autenticação](/docs/authentication) — como as chaves de API funcionam (o caminho sem 2FA).
- [Modelo de segurança](/docs/security) — o contexto mais amplo.
