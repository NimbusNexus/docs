---
title: "Workspaces"
description: "El nivel de aislamiento por encima de los proyectos. Un workspace contiene proyectos; los proyectos contienen recursos."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: workspaces
---

# Workspaces

Un **workspace** es el nivel de aislamiento superior en el modelo de cuentas de NimbusNexus. Cada proyecto pertenece exactamente a un workspace; cada usuario tiene un acceso con alcance de workspaces (y de proyectos concretos dentro de ellos). La jerarquía es **workspace → proyecto → recurso**.

Para la mayoría de las cuentas, basta con un único workspace. Las organizaciones más grandes usan varios workspaces para separar la facturación, el acceso y los límites de recursos a nivel de unidad organizativa — p. ej. un workspace por unidad de negocio, o uno por entidad legal. La facturación es por workspace, y el acceso solo cruza el límite de un workspace cuando tú lo abres: invitas a alguien a entrar, o compartes una red o una zona DNS con otro proyecto.

No confundas un workspace con una zona DNS — es la misma palabra en algunos contextos (OpenStack llama "domains" a los workspaces). La API conserva la palabra de OpenStack: los endpoints de workspaces están en `/api/v1/domains/`, y sus campos también usan domain (`domain_id`, `domain_name`, `domain_description`).

## Próximos pasos {#next-steps}

- [Proyectos](/docs/api/projects) — la siguiente capa por debajo; lo que contienen los workspaces.
- [Usuarios](/docs/api/users) y [Roles](/docs/api/roles) — las concesiones de IAM tienen alcance dentro de un workspace.
- [Confianza entre proyectos](/docs/api/cross-project-trusts) — delegaciones de corta duración que permiten a NimbusNexus terminar un trabajo por ti en un proyecto.
