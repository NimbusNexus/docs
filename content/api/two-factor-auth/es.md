---
title: "Autenticación de dos factores"
description: "Segundos factores TOTP y WebAuthn en tu cuenta."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: two-factor-auth
---

# Autenticación de dos factores

La autenticación de dos factores añade un segundo factor (un código TOTP de una aplicación de autenticación o una llave de acceso de WebAuthn) además del inicio de sesión con contraseña. Los endpoints de aquí cubren el alta, el listado de dispositivos, la eliminación de dispositivos y la descarga de códigos de recuperación.

Para los usuarios del panel, la 2FA se gestiona desde el navegador, en la página de ajustes de la cuenta; esta parte de la API es para la automatización (provisionar un nuevo usuario administrador, rotar los códigos de recuperación de forma programática, imponer la 2FA en toda la organización antes de una auditoría de cumplimiento). Quienes llaman con una clave de API no necesitan 2FA — las claves ya son en sí un factor de "algo que tienes"; la 2FA protege la vía de inicio de sesión de las personas en el panel.

Recomendación firme: activa la 2FA en todas las cuentas de personas con roles concedidos en proyectos de producción. La mayoría de los compromisos de cuentas se deben a la reutilización de contraseñas + no tener segundo factor.

## Próximos pasos {#next-steps}

- [Usuarios](/docs/api/users) — el recurso al que se asocia la 2FA.
- [Autenticación](/docs/authentication) — cómo funcionan las claves de API (la vía sin 2FA).
- [Modelo de seguridad](/docs/security) — el contexto más amplio.
