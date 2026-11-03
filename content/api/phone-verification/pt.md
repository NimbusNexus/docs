---
title: "Verificação de telefone"
description: "Adicione um número de telefone ao seu usuário e verifique-o com um código enviado por SMS."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: phone-verification
---

# Verificação de telefone

A verificação de telefone adiciona um número de telefone ao seu usuário e confere se ele chega até você. A verificação é o fluxo padrão "enviamos um código por SMS, você o digita".

`POST /api/v1/phone/` recebe um `phone_code` (o código de discagem do país, só dígitos) e um `phone_number`, e envia por SMS um código de seis dígitos para esse número. O código vale por 10 minutos. `POST /api/v1/phone/phone_passcode_validation` com esse `passcode` marca o número como verificado. `GET /api/v1/phone/` mostra o número verificado, e `DELETE /api/v1/phone/` o remove. Para trocar o número, comece de novo com `POST /api/v1/phone/`.

Um número verificado não é um segundo fator nem um canal de recuperação. A [autenticação de dois fatores](/docs/api/two-factor-auth) usa um código TOTP, e uma senha perdida é redefinida por e-mail (veja [Visão geral da conta](/docs/api/account-overview)).

## Próximos passos {#next-steps}

- [Autenticação de dois fatores](/docs/api/two-factor-auth) — o segundo fator TOTP.
- [Usuários](/docs/api/users) — o recurso ao qual os números de telefone são vinculados.
