---
title: "Confianza entre proyectos"
description: "Delegaciones de corta duración que permiten a NimbusNexus actuar por ti en un proyecto, para trabajos en cola y credenciales del almacenamiento de objetos."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: cross-project-trusts
---

# Confianza entre proyectos

Una relación de confianza es una delegación de corta duración de tu parte al propio usuario de servicio de NimbusNexus, en uno de tus proyectos. NimbusNexus crea una cuando tiene que terminar un trabajo por ti después de que tu llamada responda, como la creación o el borrado de una VM en cola o la creación de un volumen, y cuando generas una credencial del almacenamiento de objetos. El registro de una relación de confianza muestra el `trustor_user_id` (tú), el `trustee_user_id` (NimbusNexus), el `project_id`, los `roles` (`member` en todas las relaciones de confianza que crea NimbusNexus), un `expires_at` y un indicador `impersonation`.

La relación de confianza que creas a propósito es una credencial del almacenamiento de objetos. `POST /api/v1/object_storage/credentials` genera una para tu proyecto actual y devuelve su `trust_id`. Un editor independiente presenta ese id en la cabecera `X-Trust-Id` en las llamadas al almacenamiento de objetos, así llega al almacenamiento del proyecto sin tener tu token completo. `ttl_seconds` es orientativo; el servidor le pone un tope.

`GET /api/v1/trusts/` lista tus relaciones de confianza, y `GET /api/v1/trusts/{trust_id}` lee una. `DELETE /api/v1/trusts/{trust_id}` revoca una, por ejemplo una credencial de almacenamiento que ya no necesitas.

## Próximos pasos {#next-steps}

- [Roles](/docs/api/roles) — lo que delega una relación de confianza.
- [Usuarios](/docs/api/users) y [Proyectos](/docs/api/projects) — los extremos de una relación de confianza.
- [Almacenamiento de objetos](/docs/api/object-storage) — dónde se usa una credencial de almacenamiento.
- [Modelo de seguridad](/docs/security) — el contexto más amplio del diseño de IAM.
