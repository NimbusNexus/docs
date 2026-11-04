---
title: "Autenticación de dos factores"
description: "Un segundo factor TOTP, de una app de autenticación, además de tu contraseña."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: two-factor-auth
---

# Autenticación de dos factores

La autenticación de dos factores añade un segundo factor (un código TOTP de una aplicación de autenticación) además del inicio de sesión con contraseña. Los endpoints de aquí la activan, informan de su estado y la desactivan:

- `GET /api/v1/2fa/credential` — genera un secreto TOTP y devuelve su código QR como imagen. El secreto en sí llega en la cabecera de respuesta `X-Secret-Key`.
- `POST /api/v1/2fa/totp_passcode_validation` — envía ese secreto como `secretKey`, con un `passcode` actual de seis dígitos de la aplicación. Si el código coincide, la 2FA queda activada.
- `GET /api/v1/2fa/status` — `two_factor_enabled` indica si la 2FA está activada.
- `POST /api/v1/2fa/off` — desactiva la 2FA.

Cada usuario tiene un solo secreto TOTP; repetir el alta lo sustituye.

Para los usuarios del panel, la 2FA se gestiona desde el navegador, en la página de ajustes de la cuenta. A través de la API, cada llamada lee o cambia solo la 2FA propia de quien llama con una sesión iniciada, nunca la de otro usuario. Quienes llaman con una clave de API no necesitan 2FA — las claves ya son en sí un factor de "algo que tienes".

Recomendación firme: activa la 2FA en todas las cuentas de personas con roles concedidos en proyectos de producción. La mayoría de los compromisos de cuentas se deben a la reutilización de contraseñas + no tener segundo factor.

## Próximos pasos {#next-steps}

- [Usuarios](/docs/api/users) — el recurso al que se asocia la 2FA.
- [Autenticación](/docs/authentication) — cómo funcionan las claves de API (la vía sin 2FA).
- [Modelo de seguridad](/docs/security) — el contexto más amplio.
