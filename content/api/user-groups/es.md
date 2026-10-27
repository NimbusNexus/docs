---
title: "Grupos de usuarios"
description: "Grupos de usuarios para asignar roles en común. Útiles cuando los equipos crecen más allá de las concesiones por usuario."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: user-groups
---

# Grupos de usuarios

Un grupo de usuarios es una colección de usuarios con nombre a la que se pueden conceder roles en conjunto. En lugar de conceder `vms:read` a quince ingenieros uno por uno, se lo concedes al grupo `backend-team` y añades a los nuevos ingenieros al grupo.

Los grupos tienen el alcance de un workspace. Un usuario puede pertenecer a varios grupos; un grupo puede tener roles en varios proyectos dentro de su workspace. Las asignaciones de rol son aditivas — un usuario obtiene la unión de todos los roles que se le han concedido directamente más todos los roles concedidos a cualquier grupo al que pertenezca.

En equipos pequeños (menos de ~10 personas), las concesiones por usuario suelen bastar. Los grupos pasan a ser la respuesta adecuada en algún punto entre 10 y 50 usuarios, cuando la pregunta de "auditar quién tiene acceso al proyecto X" tiene que poder responderse en segundos y no revisando a mano 30 entradas de IAM.

## Próximos pasos {#next-steps}

- [Usuarios](/docs/api/users) — lo que contienen los grupos.
- [Roles](/docs/api/roles) — lo que se concede a un grupo.
- [Workspaces](/docs/api/workspaces) — el alcance de los grupos.
