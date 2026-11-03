---
title: "Autenticação de dois fatores"
description: "Um segundo fator TOTP, de um app autenticador, além da sua senha."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: two-factor-auth
---

# Autenticação de dois fatores

A autenticação de dois fatores adiciona um segundo fator (um código TOTP de um app autenticador) além do login com senha. Os endpoints daqui ativam a 2FA, informam o estado dela e a desativam:

- `GET /api/v1/2fa/credential` — gera um segredo TOTP e retorna o QR code dele como imagem. O próprio segredo vem no header de resposta `X-Secret-Key`.
- `POST /api/v1/2fa/totp_passcode_validation` — envie esse segredo como `secretKey`, com um `passcode` atual de seis dígitos do app. Se o código bater, a 2FA fica ativada.
- `GET /api/v1/2fa/status` — `two_factor_enabled` diz se a 2FA está ativada.
- `POST /api/v1/2fa/off` — desativa a 2FA.

Cada usuário tem um segredo TOTP; fazer o cadastro de novo o substitui.

Para usuários do painel, a 2FA é feita pelo navegador, na página de configurações da conta. Pela API, cada chamada lê ou altera só a 2FA do próprio usuário conectado que faz a chamada, nunca a de outro usuário. Quem chama com chave de API não precisa de 2FA — as chaves já são, por si só, um fator do tipo "algo que você tem".

Recomendação forte: ative a 2FA em toda conta humana com concessões de função em projetos de produção. A maioria das contas comprometidas tem como origem a reutilização de senha + a falta de um segundo fator.

## Próximos passos {#next-steps}

- [Usuários](/docs/api/users) — o recurso ao qual a 2FA está vinculada.
- [Autenticação](/docs/authentication) — como as chaves de API funcionam (o caminho sem 2FA).
- [Modelo de segurança](/docs/security) — o contexto mais amplo.
