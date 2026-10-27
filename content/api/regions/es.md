---
title: "Regiones"
description: "Las ubicaciones geográficas en las que opera NimbusNexus, con su estado: activa o en prelanzamiento."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Regiones

Una región de NimbusNexus es una ubicación geográfica con al menos una zona de disponibilidad. Cada recurso que creas — VMs, bases de datos gestionadas, volúmenes, buckets — vive exactamente en una región. Las operaciones entre regiones (replicación, failover, tráfico entre recursos) funcionan, pero son explícitas y se miden.

## Regiones actuales {#current}

| Código           | Ubicación            | Estado                    |
| ---------------- | -------------------- | ------------------------- |
| `us-east-1`      | Virginia, EE. UU.    | Activa                    |
| `us-west-1`      | Los Ángeles, EE. UU. | Activa                    |
| `eu-central-1`   | Fráncfort, Alemania  | Activa                    |
| `ap-southeast-1` | Singapur             | Prelanzamiento (~2 meses) |

La lista oficial también se sirve en `GET /v1/regions`; la tabla de arriba es orientativa. Cuando leas esta página, la respuesta de la API es la que manda.

## Cómo elegir una región {#picking}

Importan tres cosas:

1. **Latencia hasta tus usuarios.** Elige la región más cercana al origen de la mayoría de tus peticiones. Los tiempos de ida y vuelta por debajo de 50 ms se notan ágiles; por encima de 200 ms se notan lentos incluso con buen código.

2. **Latencia hasta tus dependencias.** Si llamas a otros servicios (bases de datos, APIs de terceros, tu propia infraestructura), pon la VM en la región más cercana a ellos. Los viajes de ida y vuelta entre cómputo y almacenamiento ocurren en cada petición; los de usuario a cómputo, una vez por carga de página.

3. **Requisitos de residencia de datos.** El RGPD / la DSGVO / las leyes de datos de cada estado pueden fijar dónde pueden residir los datos de los clientes. La región de Fráncfort (`eu-central-1`) es la opción con residencia en la UE; `us-east-1` y `us-west-1` tienen ambas residencia en EE. UU. No replicamos datos entre regiones sin que lo pidas explícitamente.

Si tus usuarios están por todo el mundo, **despliega en varias regiones**. Un patrón habitual es `us-east-1` para América + `eu-central-1` para EMEA + `ap-southeast-1` para APAC, con enrutamiento basado en DNS (por latencia, por geolocalización o con un CDN delante).

## Regiones en prelanzamiento {#preview}

Las regiones con `status: 'preview'` aceptan cargas de trabajo antes de su disponibilidad general. En concreto:

- Aceptan exactamente las mismas llamadas a la API que las regiones activas.
- Los precios coinciden con los de las regiones activas.
- El SLA **no** se aplica durante el prelanzamiento — los incidentes todavía pueden provocar caídas mientras ponemos a punto la región.
- La disponibilidad general suele llegar ~2 meses después de que se abra el prelanzamiento. Avisaremos por email a los administradores de las cuentas antes de pasar una región a `live`.

Singapur (`ap-southeast-1`) es la región actual en prelanzamiento.

## Próximos pasos {#next-steps}

- Consulta [Máquinas virtuales](/docs/api/vms) para ver cómo crear una VM en una región concreta.
- Consulta [Bases de datos gestionadas](/docs/api/managed-databases) para ver la disponibilidad de bases de datos en cada región (en las regiones nuevas, Kafka y OpenSearch llegan ~30 días después que las VMs y Postgres).
- Para arquitecturas multirregión con replicación, consulta la guía **Failover multirregión** (próximamente).
