---
title: "Datos de precios"
description: "Acceso programático a la lista de precios oficial. Solo lectura."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: pricing-data
---

# Datos de precios

El endpoint de datos de precios es una fuente de solo lectura con la lista de precios oficial de NimbusNexus — tamaños de VM por familia, clases de almacenamiento en bloques, tiers del almacenamiento de objetos, tarifas de egress, multiplicadores por motor de las bases de datos gestionadas, todo. Los mismos datos alimentan las páginas de precios de la web comercial y las previsiones de coste del panel.

Casos de uso: integrar estimaciones de coste en tiempo real en tu flujo de aprovisionamiento (mostrar "esta VM costará $X/mes" antes de que el usuario haga clic en Launch), crear herramientas internas de imputación de costes o simplemente mantener tu propia hoja de cálculo de "cuánto cobra ahora mismo NimbusNexus por X".

Los precios se expresan en USD y se actualizan cada vez que ajustamos la lista de precios publicada (algo poco frecuente — normalmente una o dos veces al año, y avisamos por email con 30 días de antelación antes de cualquier subida).

## Próximos pasos {#next-steps}

- [Facturas](/docs/api/invoices) — lo que producen los precios en la práctica.
- [Optimiza tu factura mensual](/docs/guides/cost-optimization) — la guía de estrategia para reducir tu factura.
- La [página de precios de la web comercial]({{BASE_URL}}/pricing) — la versión legible por personas de estos datos.
