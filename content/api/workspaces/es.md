---
title: "Workspaces"
description: "El nivel de aislamiento por encima de los proyectos. Un workspace contiene proyectos; los proyectos contienen recursos."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: workspaces
---

# Workspaces

Un **workspace** es el nivel de aislamiento superior en el modelo de cuentas de NimbusNexus. Cada proyecto pertenece exactamente a un workspace; cada usuario tiene un acceso con alcance de workspaces (y de proyectos concretos dentro de ellos). La jerarquía es **workspace → proyecto → recurso**.

Para la mayoría de las cuentas, basta con un único workspace. Las organizaciones más grandes usan varios workspaces para separar la facturación, el acceso y los límites de recursos a nivel de unidad organizativa — p. ej. un workspace por unidad de negocio, o uno por entidad legal. El tráfico, el IAM y la facturación entre workspaces están aislados por diseño.

No confundas un workspace con una zona DNS — es la misma palabra en algunos contextos (OpenStack llama "domains" a los workspaces), pero el producto usa "workspace" en todo lo que ve el usuario.

## Próximos pasos {#next-steps}

- [Proyectos](/docs/api/projects) — la siguiente capa por debajo; lo que contienen los workspaces.
- [Usuarios](/docs/api/users) y [Roles](/docs/api/roles) — las concesiones de IAM tienen alcance dentro de un workspace.
- [Confianza entre proyectos](/docs/api/cross-project-trusts) — permisos temporales que cruzan los límites entre proyectos dentro de un workspace.
