---
title: "Usuarios"
description: "Registros de identidad dentro de un proyecto — asigna roles, genera claves de API y asume relaciones de confianza."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Usuarios

Un usuario es una identidad dentro de un [proyecto](/docs/api/projects). Los usuarios tienen roles (que conceden permisos), pueden generar claves de API (con el alcance del usuario) y pueden asumir relaciones de confianza para actuar en nombre de otros proyectos.

## Usuario ≠ inicio de sesión {#identity-model}

Un "usuario" en esta API es **el registro de identidad**, no la persona. Una misma persona puede ser:

- Un usuario en `prod` (el proyecto de producción)
- Otro usuario en `staging` (otro registro de identidad, el mismo email)
- Un tercer usuario en `dev`

Cada usuario está totalmente aislado de los demás — tiene sus propias asignaciones de rol, sus propias claves de API y su propio registro de auditoría. Ese es el límite de aislamiento entre proyectos en el que nos apoyamos para contener el radio de impacto: un usuario de `dev` comprometido no puede tocar los recursos de producción porque, literalmente, no existe como identidad allí.

Para las organizaciones que quieren una persona → una identidad en todos los proyectos, federa mediante SAML/OIDC; la identidad que proporciona el SSO pasa a ser el mismo usuario en todos los proyectos asignados por las reglas del IdP. Es una función del plan Enterprise; las cuentas del tier por defecto usan el modelo por proyecto descrito arriba.

## Qué puedes hacer con un usuario {#actions}

- **Crear** — provisionar un usuario nuevo dentro del proyecto de quien llama. Requiere `iam:write` en el proyecto.
- **Obtener** — leer el registro de un usuario. Basta con `iam:read`.
- **Actualizar** — cambiar el nombre, la descripción o el indicador de activado. Algunos campos (p. ej. el email) no se pueden cambiar después de crear el usuario; la API devuelve un 400 si lo intentas.
- **Borrar** — eliminar de forma permanente. Todas las asignaciones de rol y las claves de API del usuario se revocan de forma atómica.

No hay un "desactivar" separado de "borrar". Si quieres una desactivación suave (conservar el historial de auditoría, impedir el inicio de sesión), pon `enabled: false` con una actualización — esa es la vía de la desactivación suave. Borrar es un borrado definitivo + revocarlo todo.

## Qué no puedes hacer {#cant-do}

- **Mover un usuario entre proyectos.** Crea un usuario nuevo en el proyecto de destino, copia las concesiones de roles que quieras y borra el antiguo.
- **Establecer una contraseña mediante la API.** Las contraseñas solo pasan por el flujo de restablecimiento de contraseña; la API nunca acepta una contraseña en texto plano como entrada. Los usuarios con SSO no usan contraseñas en absoluto.
- **Listar los usuarios de un proyecto en el que no tienes asignaciones de rol.** El aislamiento entre proyectos es estricto — no se puede enumerar entre proyectos.

## Próximos pasos {#next-steps}

- [Proyectos](/docs/api/projects) — el contenedor en el que viven los usuarios.
- [Roles](/docs/api/roles) — qué conceder a un usuario una vez que existe.
- [Autenticación](/docs/authentication) — cómo funcionan las claves de API (que se emiten por usuario).
