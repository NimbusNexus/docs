---
title: "Resumen de la cuenta"
description: "Inicio de sesión y sesión — regístrate, inicia y cierra sesión, restablece o cambia una contraseña y cambia de proyecto, workspace o región."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: account-overview
---

# Resumen de la cuenta

Estos endpoints gestionan tu inicio de sesión y la sesión que abre. Al registrarte se crea un [workspace](/docs/api/workspaces) que lleva el nombre de tu email y en el que tú eres el primer usuario. La facturación pertenece a ese workspace; consulta [Facturación](/docs/api/invoices).

Cada llamada actúa sobre el inicio de sesión, la sesión o la contraseña propios de quien llama:

- **Registrarse** — `POST /api/v1/account/registration` envía por email un token de verificación. `POST /api/v1/account/reset_password` con `type: register`, el `token` y una `new_password` (de al menos 8 caracteres, repetida en `confirm_password`) completa el registro.
- **Iniciar y cerrar sesión** — `POST /api/v1/account/login` recibe `email` y `password` y devuelve un `access_token` con su `expires_at`. Un usuario creado dentro de un workspace envía también `domain`, el nombre del workspace. `GET /api/v1/account/logout` cierra la sesión.
- **Contraseñas** — `POST /api/v1/account/forgot_password_request` envía por email un token de restablecimiento de un solo uso, y `POST /api/v1/account/reset_password` con `type: reset` establece la contraseña nueva. `POST /api/v1/account/change_password` recibe la `current_password` y la nueva.
- **Alcance y región** — `GET /api/v1/account/rescope` cambia la sesión a un `project` o a un `domain` (un workspace), y también puede cambiar su `region`. `GET /api/v1/account/get_scope_choices` lista los workspaces, proyectos y regiones a los que puedes cambiar, `GET /api/v1/account/datacenters` lista las regiones con su estado de salud, y `GET /api/v1/account/un_scope` quita el alcance.

## Próximos pasos {#next-steps}

- [Workspaces](/docs/api/workspaces) — lo que crea el registro; los proyectos viven dentro de él.
- [Autenticación](/docs/authentication) — cómo funcionan las claves de API.
- [Solicitudes de región](/docs/api/region-requests) — pide a NimbusNexus que abra una región que todavía no ofrece.
