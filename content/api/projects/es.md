---
title: "Proyectos"
description: "La unidad de aislamiento para recursos, facturación y control de acceso."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Proyectos

Un proyecto es la **unidad de aislamiento** en NimbusNexus — para los recursos, la facturación y el control de acceso. Cada recurso (VM, volumen, bucket, base de datos, red, …) pertenece exactamente a un proyecto; cada clave de API tiene el alcance de exactamente un proyecto; cada línea de factura corresponde exactamente a un proyecto.

## Por qué importan los proyectos {#why}

Tres garantías que te da el límite del proyecto:

1. **Radio de impacto.** Una clave de API comprometida del proyecto `dev` no puede tocar los recursos de `prod`. Literalmente no son visibles desde dentro de `dev`.
2. **Imputación de costes.** Cada proyecto tiene su propia factura. Si finanzas quiere cargar a marketing la factura del hosting de la web, marketing tiene un proyecto. Si ingeniería quiere repartir el gasto por equipo, cada equipo tiene un proyecto.
3. **Cuota.** Las cuotas son por proyecto. Un proyecto que se desboca creando VMs no agota el margen de otro proyecto.

## Jerarquía de proyectos {#hierarchy}

Los proyectos pueden tener un proyecto padre (a partir del tier de organización). La jerarquía tiene este aspecto:

```text
acme-org (root)
├── acme-prod
├── acme-staging
└── acme-dev
```

Un usuario con el rol `admin` en `acme-org` hereda automáticamente el rol de administrador en todos los hijos. Un usuario que solo es administrador en `acme-prod` no puede ver `acme-staging` ni `acme-dev`. Este es el mecanismo estándar para "gobernanza centralizada, día a día descentralizado".

La jerarquía es opcional. Las cuentas del tier por defecto tienen un proyecto raíz por cuenta; las cuentas del tier de organización pueden construir árboles de hasta 5 niveles de profundidad.

## Qué vive en un proyecto {#contents}

- VMs, volúmenes, snapshots, backups
- Buckets, archivos
- Bases de datos
- Redes, subredes, routers, grupos de seguridad, IPs flotantes, balanceadores de carga
- Zonas DNS + registros
- Usuarios, roles + asignaciones, claves de API
- La cuenta de facturación que paga todo lo anterior

Los proyectos no se pueden fusionar. Para consolidar dos proyectos, tendrías que exportar y volver a importar los recursos y borrar el original — no hay una operación atómica de fusión, a propósito, porque la atribución resultante de "qué se ha fusionado dónde" sería imposible de auditar.

## Borrado {#deletion}

`DELETE /v1/projects/{id}` es **destructivo e irreversible**. Se destruyen todos los recursos del proyecto: VMs, volúmenes, snapshots, backups, buckets, bases de datos, zonas DNS — todo. Los registros de usuario y las asignaciones de rol se revocan de forma atómica.

Por seguridad, la API exige una cabecera de confirmación (`X-Confirm-Project-Delete: <project-id>`) en esta llamada; sin ella, la petición devuelve un 400.

## Próximos pasos {#next-steps}

- [Usuarios](/docs/api/users) — las identidades de dentro de un proyecto.
- [Roles](/docs/api/roles) — lo que necesitan tener los usuarios para hacer cualquier cosa.
- [Cuotas](/docs/api/quotas) — límites de recursos por proyecto.
