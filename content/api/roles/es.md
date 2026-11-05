---
title: "Roles"
description: "Roles predefinidos y personalizados, y los endpoints de asignación de roles que conceden a un usuario un rol en un proyecto."
publishedAt: 2026-05-20
updatedAt: 2026-11-05
kind: reference
---

# Roles

Un rol es un conjunto de permisos. La **asignación de rol** es el acto de conceder un rol a un usuario o a un [grupo](/docs/api/user-groups) en un proyecto, o en el propio workspace. Un mismo usuario puede tener roles distintos en proyectos distintos; un usuario sin ningún rol en un proyecto no puede verlo en absoluto.

## Roles predefinidos {#built-in}

`GET /api/v1/roles/` lista los roles globales de la plataforma, marcados con `is_global: true`, y los roles personalizados que haya creado tu workspace; `GET /api/v1/roles/{role_id}` lee uno. De los roles globales, puedes conceder `manager`, `member`, `reader` y `billing`. Los demás, incluido `admin`, no se pueden conceder.

## Roles personalizados {#custom}

`POST /api/v1/roles/` crea un rol en tu workspace, con un `name` y una `description` opcional. `PATCH /api/v1/roles/{role_id}` cambia cualquiera de los dos, y `DELETE /api/v1/roles/{role_id}` borra el rol. Solo se pueden cambiar o borrar los roles propios de tu workspace; para un rol global, ambas llamadas responden `404`.

## Conceder y revocar {#grant}

`POST /api/v1/roles/grant` recibe una lista de asignaciones, así que una sola llamada puede conceder varias. Cada asignación indica un `role`, exactamente un `user` o un `group`, y exactamente un destino: un `project` o, para el propio workspace, un `domain`, todo por ID. Una asignación sin sujeto o sin destino, o con dos, responde `422`. `POST /api/v1/roles/revoke` recibe la misma lista y elimina esas asignaciones.

Conceder y revocar no salen de tu propio workspace. El destino tiene que ser tu workspace o uno de sus proyectos (para una clave de API, el workspace al que pertenece su proyecto), y el rol tiene que ser `manager`, `member`, `reader`, `billing` o uno de los roles propios de tu workspace. La API comprueba todas las asignaciones antes de hacer ninguna: si rechaza una, la llamada responde `403` y no se aplica nada de la lista.

`GET /api/v1/roles/assignments` lista las asignaciones del workspace, en sus proyectos y en el propio workspace, incluidas las que llegan a través de un grupo. Fíltralo por `role`, `user`, `group`, `project` o `domain`.

Conceder y revocar también aceptan la clave de API de un administrador. Las demás llamadas de roles necesitan una sesión de administrador con el alcance del propio workspace: una clave de API siempre tiene el alcance de un único proyecto, así que una llamada con una clave a ellas responde `400`.

## Cómo se combinan las asignaciones de rol {#compose}

Un usuario puede tener varias asignaciones de rol en un mismo proyecto. El conjunto efectivo de permisos es la **unión** — la lista de roles es aditiva, no multiplicativa. Un rol concedido directamente al usuario y otro concedido a uno de sus grupos se aplican los dos.

Revocar un rol no revoca los demás. Para quitarle todo a un usuario, revoca cada asignación una a una, o borra el usuario (lo que revoca de forma atómica todas sus asignaciones).

## Próximos pasos {#next-steps}

- [Usuarios](/docs/api/users) — a quién concedes los roles.
- [Proyectos](/docs/api/projects) — sobre qué concedes los roles.
- [Autenticación](/docs/authentication) — cómo se corresponden las claves de API con los roles de los usuarios.
