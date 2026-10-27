---
title: "Verificación telefónica"
description: "Verifica un número de teléfono para la 2FA por SMS y la recuperación de la cuenta."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: phone-verification
---

# Verificación telefónica

Un número de teléfono verificado puede servir como segundo factor de respaldo y como canal de recuperación para el caso poco habitual en el que un usuario ha perdido tanto su contraseña como su dispositivo TOTP/WebAuthn. La verificación es el flujo estándar de "te enviamos un código por SMS y lo introduces".

El SMS como factor principal de 2FA es más débil que TOTP o WebAuthn (ataques de SIM swapping, problemas de SS7). NimbusNexus admite la 2FA por SMS, pero usa TOTP por defecto en las altas nuevas; el SMS se ofrece solo como vía de recuperación en las cuentas del plan Production. Las cuentas Enterprise pueden desactivar el SMS por completo si su modelo de amenazas lo excluye.

## Próximos pasos {#next-steps}

- [Autenticación de dos factores](/docs/api/two-factor-auth) — la configuración principal de la 2FA.
- [Usuarios](/docs/api/users) — el recurso al que se asocian los números de teléfono.
