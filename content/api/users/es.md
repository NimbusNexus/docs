---
title: "Usuarios"
description: "Registros de identidad dentro de un workspace — asigna roles y genera claves de API."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Usuarios

Un usuario es una identidad dentro de un [workspace](/docs/api/workspaces). Los usuarios tienen roles en los [proyectos](/docs/api/projects) del workspace (que conceden permisos) y pueden generar claves de API (cada una pertenece al usuario y tiene el alcance de un único proyecto).

## Usuario ≠ inicio de sesión {#identity-model}

Un "usuario" en esta API es **el registro de identidad**, no la persona. Cada usuario pertenece a exactamente un workspace, y su nombre es único en él. Dentro del workspace, un mismo usuario puede tener roles distintos en proyectos distintos:

- Un rol en `prod` (el proyecto de producción)
- Otro rol en `staging`
- Ningún rol en `dev`

Lo que un usuario puede hacer en un proyecto depende de los roles que tiene en él, concedidos directamente o a través de un [grupo](/docs/api/user-groups). Ese es el límite en el que apoyarse para contener el radio de impacto: concede roles en `prod` solo a los usuarios que los necesitan.

## Qué puedes hacer con un usuario {#actions}

- **Obtener** — leer el registro de un usuario por su ID.
- **Actualizar** — cambiar el nombre, la descripción, el indicador de activado o la contraseña.
- **Borrar** — eliminar de forma permanente. Todas las asignaciones de rol y las claves de API del usuario se revocan de forma atómica.

Las tres requieren el rol `admin`. Actualizar y borrar también aceptan la clave de API de un administrador. Obtener necesita una sesión con el alcance del propio workspace, no de uno de sus proyectos. Una clave de API siempre tiene el alcance de un único proyecto, así que obtener con una clave responde `400`.

Las personas entran en un workspace y salen de él en **Members**, en la [consola de tu cuenta]({{ACCOUNT_BASE_URL}}/members): invítalas allí y quítalas allí. Esta API lee y actualiza sus registros de usuario.

Actualizar sigue aceptando un `password`, pero ni el panel ni las apps lo piden nunca: inician la sesión de las personas con su cuenta de NimbusNexus. Una contraseña nunca sale: el registro de un usuario solo contiene `id`, `name`, `description` y `enabled`.

No hay un "desactivar" separado de "borrar". Si quieres una desactivación suave (conservar el historial de auditoría, impedir el inicio de sesión), pon `enabled: false` con una actualización — esa es la vía de la desactivación suave. Borrar es un borrado definitivo + revocarlo todo.

## Qué no puedes hacer {#cant-do}

- **Crear un usuario.** `POST /api/v1/users` responde `403 Forbidden`. Un usuario creado con la API no tendría una cuenta de NimbusNexus con la que iniciar sesión, así que invita a las personas en la consola de tu cuenta.
- **Mover un usuario a otro workspace.** Invita a la persona al otro workspace en **Members**, en la consola de tu cuenta, y concédele allí los roles que necesite. Dentro de un mismo workspace no hay nada que mover: concede al usuario un rol en el otro proyecto.
- **Obtener un usuario de otro workspace.** Obtener solo encuentra usuarios del workspace de quien llama. Para cualquier otro responde `404`.

## Próximos pasos {#next-steps}

- [Workspaces](/docs/api/workspaces) — el contenedor en el que viven los usuarios.
- [Roles](/docs/api/roles) — qué conceder a un usuario una vez que existe.
- [Autenticación](/docs/authentication) — cómo funcionan las claves de API (que se emiten por usuario).
