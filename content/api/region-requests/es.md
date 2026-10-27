---
title: "Solicitudes de región"
description: "Solicita acceso a una región que todavía no tienes, o un aumento de cuota en una región a la que ya tienes acceso."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: region-requests
---

# Solicitudes de región

Por defecto, las cuentas nuevas tienen acceso a una región (la que eligieron al registrarse). Para añadir acceso a más regiones hace falta una solicitud de región — un formulario breve que explica la carga de trabajo que necesita la nueva región. La mayoría de las cuentas de producción se aprueban en un día laborable; este control existe para planificar la capacidad y para detectar patrones inusuales (una cuenta recién creada que pide capacidad en cinco regiones el primer día merece una breve conversación).

Este endpoint también gestiona los aumentos de cuota — una solicitud para subir el número de VMs, las vCPU o el límite de almacenamiento en una región a la que ya tienes acceso. El motivo del control es el mismo: las solicitudes grandes requieren planificar la capacidad. Consulta [Cuotas](/docs/api/quotas) para el modelo de cuotas en sí.

Esta parte de la API existe para que un despliegue automatizado pueda enviar la solicitud y olvidarse; la aprobación sigue siendo manual por nuestra parte (es uno de los pocos rincones de la API que, por diseño, no son totalmente de autoservicio).

## Próximos pasos {#next-steps}

- [Regiones](/docs/api/regions) — la lista de regiones disponibles.
- [Cuotas](/docs/api/quotas) — los límites por proyecto que una solicitud de región también puede ajustar.
- [Resumen de la cuenta](/docs/api/account-overview) — el contexto de cuenta del acceso a regiones.
