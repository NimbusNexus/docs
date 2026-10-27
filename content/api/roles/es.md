---
title: "Roles"
description: "Roles predefinidos y personalizados, y los endpoints de asignación de roles que conceden a un usuario un rol en un proyecto."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Roles

Un rol es un conjunto de permisos. La **asignación de rol** es el acto de conceder un rol a un usuario en un proyecto. Un mismo usuario puede tener roles distintos en proyectos distintos; un usuario sin ningún rol en un proyecto no puede verlo en absoluto.

## Roles predefinidos {#built-in}

Cada proyecto incluye cuatro roles predefinidos que puedes asignar sin definir nada personalizado:

| Rol                 | Qué puede hacer                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **`viewer`**        | Leer todos los recursos. Sin escrituras y sin borrados. Adecuado para herramientas de monitorización y auditores.            |
| **`editor`**        | Crear + actualizar la mayoría de los recursos. No puede gestionar IAM (usuarios, roles, claves). Adecuado para los desarrolladores del día a día. |
| **`admin`**         | Todo lo que puede hacer `editor`, más IAM. Puede crear usuarios, conceder/revocar roles y gestionar claves de API.           |
| **`billing-admin`** | Leer facturas, cambiar el método de pago, ver + aumentar la cuota. Sin acceso a los recursos. Adecuado para finanzas.        |

El rol `admin` **no** incluye `billing-admin`, ni viceversa. Es así por diseño — el ingeniero que gestiona la API no debería ser también quien aprueba la factura.

## Roles granulares {#granular}

Además de los cuatro predefinidos, ofrecemos roles granulares por recurso para los casos en los que `editor` es demasiado:

- `vms:operator` — solo crear / arrancar / detener / destruir VMs, sin red
- `storage:operator` — gestionar volúmenes, buckets, snapshots y backups
- `dns:admin` — gestión completa de zonas DNS + registros; nada más
- `networking:admin` — redes, subredes, grupos de seguridad, IPs flotantes, LBs
- `databases:admin` — bases de datos gestionadas + sus backups

Se asignan igual que los predefinidos, con `POST /v1/role-assignments`.

## Roles personalizados {#custom}

Define los tuyos con `POST /v1/roles` (no aparece en el ejemplo mínimo de abajo) enumerando los permisos que quieres agrupar. Los nombres de los permisos siguen el patrón `<resource>:<action>` — p. ej. `vms:read`, `volumes:create`, `databases:snapshot`. El catálogo completo de permisos está en `GET /v1/permissions`.

Casos de uso de los roles personalizados: "leer todo salvo la facturación" para un auditor de seguridad; "gestionar registros DNS pero no zonas" para un equipo de marketing que es dueño del contenido de los subdominios, pero no de la delegación de la zona.

## Cómo se combinan las asignaciones de rol {#compose}

Un usuario puede tener varias asignaciones de rol en un mismo proyecto. El conjunto efectivo de permisos es la **unión** — la lista de roles es aditiva, no multiplicativa. Conceder `viewer` + `vms:operator` a un mismo usuario le da lectura sobre todo + escritura específicamente sobre las VMs.

Revocar un rol no revoca los demás. Para quitarle todo a un usuario, borra cada asignación una a una, o borra el usuario (lo que revoca de forma atómica todas sus asignaciones).

## Próximos pasos {#next-steps}

- [Usuarios](/docs/api/users) — a quién concedes los roles.
- [Proyectos](/docs/api/projects) — sobre qué concedes los roles.
- [Autenticación](/docs/authentication) — cómo se corresponden las claves de API con los roles de los usuarios.
