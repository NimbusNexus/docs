---
title: "Verificação de telefone"
description: "Verifique um número de telefone para 2FA por SMS e recuperação de conta."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: phone-verification
---

# Verificação de telefone

Um número de telefone verificado pode funcionar como segundo fator de reserva e como canal de recuperação no caso raro em que um usuário perdeu tanto a senha quanto o dispositivo TOTP/WebAuthn. A verificação é o fluxo padrão "enviamos um código por SMS, você o digita".

SMS como fator principal de 2FA é mais fraco que TOTP ou WebAuthn (ataques de SIM swap, problemas com o SS7). A NimbusNexus suporta 2FA por SMS, mas usa TOTP por padrão nos novos cadastros; o SMS é oferecido como caminho exclusivo de recuperação para contas do nível production. Contas Enterprise podem desativar o SMS completamente se o modelo de ameaças delas o excluir.

## Próximos passos {#next-steps}

- [Autenticação de dois fatores](/docs/api/two-factor-auth) — a configuração principal de 2FA.
- [Usuários](/docs/api/users) — o recurso ao qual os números de telefone são vinculados.
