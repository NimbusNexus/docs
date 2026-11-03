---
title: "Regiones"
description: "Las regiones en las que opera NimbusNexus y cómo elige una tu sesión."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Regiones

Una región de NimbusNexus es una ubicación geográfica con al menos una zona de disponibilidad. Cada recurso que creas — VMs, volúmenes, buckets — vive exactamente en una región.

## Regiones actuales {#current}

Hoy, producción opera en una sola región, en Fráncfort (Alemania).

`GET /api/v1/account/datacenters` lista las regiones, cada una con su `region_name`, una `label` y un `order` para mostrarla, y un indicador `healthy`; `current` es la región en la que está tu sesión. `GET /api/v1/account/rescope?region=<region_name>` cambia la sesión a otra región. La respuesta de la API es la que manda.

## Cómo elegir una región {#picking}

Importan tres cosas:

1. **Latencia hasta tus usuarios.** Elige la región más cercana al origen de la mayoría de tus peticiones. Los tiempos de ida y vuelta por debajo de 50 ms se notan ágiles; por encima de 200 ms se notan lentos incluso con buen código.

2. **Latencia hasta tus dependencias.** Si llamas a otros servicios (bases de datos, APIs de terceros, tu propia infraestructura), pon la VM en la región más cercana a ellos. Los viajes de ida y vuelta entre cómputo y almacenamiento ocurren en cada petición; los de usuario a cómputo, una vez por carga de página.

3. **Requisitos de residencia de datos.** El RGPD / la DSGVO / las leyes de datos de cada estado pueden fijar dónde pueden residir los datos de los clientes. La única región actual está en Fráncfort (Alemania).

## Próximos pasos {#next-steps}

- [Máquinas virtuales](/docs/api/vms) — una VM se crea en la región actual de tu sesión.
- [Resumen de la cuenta](/docs/api/account-overview) — donde están documentados la lista de regiones y el cambio de región de la sesión.
- [Solicitudes de región](/docs/api/region-requests) — pide una región que todavía no se ofrece.
