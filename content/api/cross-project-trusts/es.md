---
title: "Confianza entre proyectos"
description: "Concesiones de permisos temporales entre proyectos. La primitiva adecuada para la automatización entre proyectos."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: cross-project-trusts
---

# Confianza entre proyectos

Una relación de confianza concede a un usuario de un proyecto permiso temporal para actuar en otro proyecto — sin que ese usuario necesite ser miembro ni una clave de API compartida. La relación de confianza lleva un rol concreto, una caducidad y un alcance de suplantación opcional.

El caso de uso típico: una pipeline de CI/CD que se identifica ante el proyecto `shared-infra` pero necesita desplegar recursos en `acme-prod`. Sin relaciones de confianza, tendrías que dar a la clave de CI permisos de administrador en ambos proyectos (mal radio de impacto) o copiar claves entre proyectos (peor). Con una relación de confianza, `shared-infra` emite una concesión temporal de `vms:write` en `acme-prod`; las llamadas de CI presentan la relación de confianza junto con sus credenciales normales.

Las relaciones de confianza respetan el modelo de seguridad — el usuario que concede solo puede conceder roles que tiene él mismo, y la relación de confianza caduca, como muy tarde, cuando caduca la concesión desde la que delega. No hay ninguna vía de escalada de privilegios.

## Próximos pasos {#next-steps}

- [Roles](/docs/api/roles) — lo que delega una relación de confianza.
- [Usuarios](/docs/api/users) y [Proyectos](/docs/api/projects) — los extremos de una relación de confianza.
- [Modelo de seguridad](/docs/security) — el contexto más amplio del diseño de IAM.
