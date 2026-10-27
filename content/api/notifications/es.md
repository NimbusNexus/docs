---
title: "Notificaciones"
description: "Preferencias de notificación de la cuenta — de qué te avisamos por email y qué se enruta mediante webhooks."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: notifications
---

# Notificaciones

Las preferencias de notificación controlan qué eventos generan un email a qué contacto, y cuáles generan en su lugar (o además) una entrega de webhook. Las categorías incluyen alertas de facturación, eventos de seguridad, avisos de cuota, anuncios de mantenimiento programado y lanzamientos de funciones.

Los valores por defecto son razonables — la facturación y la seguridad siempre van al contacto de facturación/seguridad, independientemente de las preferencias. Las categorías configurables son las operativas: ventanas de mantenimiento, umbrales de cuota, anuncios de funciones en beta, etc.

En equipos más grandes, el patrón típico es enrutar las notificaciones operativas mediante webhooks hacia tu sistema de gestión de incidentes (PagerDuty, Opsgenie) en lugar de enviarlas por email a un único contacto. La vía de webhooks de aquí usa la misma semántica de entrega que se describe en [Webhooks de la plataforma](/docs/webhooks).

## Próximos pasos {#next-steps}

- [Webhooks de la plataforma](/docs/webhooks) — el canal de entrega para lo que no se envía por email.
- [Resumen de la cuenta](/docs/api/account-overview) — donde están los contactos de facturación y de seguridad.
