---
title: "Resumen de la cuenta"
description: "Metadatos generales de la cuenta — propietario, contacto de facturación, acceso a regiones y plan."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: account-overview
---

# Resumen de la cuenta

Una "cuenta" está por encima de todos los workspaces, proyectos y recursos que tienes en NimbusNexus. Contiene el contacto de facturación, el nombre de la entidad legal que figura en las facturas, el tier del plan (free / starter / production / enterprise), las regiones en cuya lista de permitidos estás y las preferencias de toda la cuenta. Hay exactamente una cuenta por registro.

La mayoría de estos endpoints son de solo lectura para quienes no son propietarios y de lectura y escritura para los propietarios. El trabajo del día a día se hace a nivel de proyecto; las llamadas a nivel de cuenta suelen ser operaciones de una vez por trimestre (cambiar el contacto de facturación, solicitar una región nueva, subir de plan).

## Próximos pasos {#next-steps}

- [Workspaces](/docs/api/workspaces) — la siguiente capa por debajo, dentro de la cuenta.
- [Solicitudes de región](/docs/api/region-requests) — solicita acceso a una región que aún no tienes.
