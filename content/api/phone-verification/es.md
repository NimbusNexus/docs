---
title: "Verificación telefónica"
description: "Añade un número de teléfono a tu usuario y verifícalo con un código enviado por SMS."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: phone-verification
---

# Verificación telefónica

La verificación telefónica añade un número de teléfono a tu usuario y comprueba que puedes recibir mensajes en él. La verificación es el flujo estándar de "te enviamos un código por SMS y lo introduces".

`POST /api/v1/phone/` recibe un `phone_code` (el prefijo telefónico del país, solo dígitos) y un `phone_number`, y envía por SMS un código de seis dígitos a ese número. El código es válido durante 10 minutos. `POST /api/v1/phone/phone_passcode_validation` con ese `passcode` marca el número como verificado. `GET /api/v1/phone/` muestra el número verificado, y `DELETE /api/v1/phone/` lo elimina. Para cambiar el número, empieza de nuevo con `POST /api/v1/phone/`.

Un número verificado no es un segundo factor ni un canal de recuperación. La [autenticación de dos factores](/docs/api/two-factor-auth) usa un código TOTP, y una contraseña perdida se restablece por email (consulta [Resumen de la cuenta](/docs/api/account-overview)).

## Próximos pasos {#next-steps}

- [Autenticación de dos factores](/docs/api/two-factor-auth) — el segundo factor TOTP.
- [Usuarios](/docs/api/users) — el recurso al que se asocian los números de teléfono.
