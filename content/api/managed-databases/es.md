---
title: "Bases de datos gestionadas"
description: "Postgres, MySQL, MongoDB, Redis, Kafka y OpenSearch gestionados — provisiona, haz snapshots y restaura."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Bases de datos gestionadas

NimbusNexus ejecuta seis motores de bases de datos como servicios gestionados. Nos encargamos del trabajo operativo — failover, backups, actualizaciones de versiones menores, parches del SO — y tú obtienes una cadena de conexión y el protocolo nativo del motor al otro lado. **Sin formato de red propietario y sin necesidad de una librería cliente especial**: conéctate con `psql`, `mongo`, el cliente oficial de Kafka, etc.

## Motores {#engines}

| Motor        | Para qué                                                                                                  | Tamaño inicial |
| ------------ | --------------------------------------------------------------------------------------------------------- | -------------- |
| `postgres`   | Cargas de trabajo transaccionales; la opción por defecto segura para "necesito una base de datos".        | `db-1-4`       |
| `mysql`      | Cuando la aplicación o el equipo ya usan MySQL. PostgreSQL es la opción por defecto adecuada para proyectos nuevos. | `db-1-4`       |
| `mongodb`    | Cargas de trabajo de documentos, esquemas dinámicos, semántica de replica set.                            | `db-2-8`       |
| `redis`      | Caché, almacén de sesiones, pub/sub, colas. Sin interfaz SQL.                                             | `db-1-2`       |
| `kafka`      | Streaming de eventos, agregación de logs, pub/sub duradero. Tres brokers como mínimo.                     | `db-2-8` × 3   |
| `opensearch` | Búsqueda de texto completo, analítica de logs.                                                            | `db-4-16`      |

Los códigos de tamaño siguen la misma convención que las VMs (`db-<vCPU>-<RAM_GB>`), con un multiplicador de precio distinto para cada motor — Redis es más barato que Postgres en el mismo hardware porque no hay WAL en disco; MongoDB es más caro por el sobrecoste de licencias del replica set.

## Ciclo de vida {#lifecycle}

Las bases de datos pasan por cinco estados:

- `provisioning` — la instancia o las instancias se están levantando. 60–120 segundos en los motores de un solo nodo (Postgres, MySQL, Redis), 90–180 segundos en los replicados (MongoDB, Kafka, OpenSearch).
- `running` — acepta conexiones en la cadena de conexión publicada.
- `maintenance` — aplicando una actualización menor o un parche. Las conexiones sobreviven; la base de datos deja de estar disponible brevemente durante el cutover (normalmente <5 segundos en Postgres/MySQL, más en Kafka).
- `stopping` → `stopped` — en pausa. Dejas de pagar el cómputo; el almacenamiento se sigue facturando. Puedes volver a arrancarla en cualquier momento.
- `terminated` — destruida.

El estado aparece en cada respuesta GET, en el campo `state`. Las transiciones de larga duración (aprovisionamiento inicial, actualización de versión) informan de su progreso en un objeto `operation` incrustado — consulta [Convenciones](/docs/conventions).

## Backups y snapshots {#backups}

Funcionan en paralelo dos mecanismos de backup:

- **Backup continuo del WAL** (solo Postgres y MySQL). Activado por defecto. Enviamos el write-ahead log al almacenamiento de objetos cada ~5 segundos y podemos restaurar a cualquier momento de los últimos 7 días. **Recuperación a un punto en el tiempo**.
- **Snapshots bajo demanda** (todos los motores). Se lanzan con `POST /v1/databases/{id}/snapshots`. Consistentes (no hace falta detener la E/S), se guardan en el almacenamiento de objetos y se pueden restaurar en una base de datos nueva de la misma región.

Los snapshots son independientes de la base de datos de origen — destruir el origen no borra los snapshots. La retención es de 7 días por defecto; amplíala desde el panel o pasando `retention_days` en la petición del snapshot.

## Conexiones {#connections}

La respuesta GET de cada base de datos incluye un objeto `connection`:

```json
{
  "connection": {
    "host": "{{DB_HOST_DEMO}}",
    "port": 5432,
    "database": "main",
    "username": "nimbus",
    "password_secret": "secret://projects/.../database-passwords/db_01H8FZ...",
    "ssl": "require"
  }
}
```

La contraseña se referencia como una URL de secreto, no va incrustada — obtenla con `GET /v1/secrets/{secret-id}` y guárdala en caché durante la vida útil de la conexión. Así los valores de las contraseñas no acaban en ningún log que capture los registros completos de la base de datos.

Todas las bases de datos exigen TLS en las conexiones de los clientes. No se aceptan certificados autofirmados; publicamos el bundle de la CA en `/v1/databases/ca-bundle.pem`. Los clientes de Postgres / MySQL deben usar `sslmode=verify-full` y apuntar `sslrootcert` a ese bundle.

## Versiones y actualizaciones {#versions}

- **Las versiones menores** se aplican automáticamente durante la ventana de mantenimiento semanal (el domingo de 02:00 a 04:00 en la región de la base de datos, configurable). Sin downtime en Postgres/MySQL con WAL continuo; los motores con replica set sufren un failover breve.
- **Las versiones mayores** requieren una llamada explícita a `POST /v1/databases/{id}/upgrade`. Probamos la actualización con tus datos sobre un snapshot antes de cambiar el primario, así que una actualización fallida supone un rollback, no una corrupción.

Las versiones mayores tienen soporte durante al menos 24 meses desde que el proyecto original las publica. Publicamos los calendarios de fin de vida en el changelog con al menos 90 días de antelación.

## Notas sobre precios {#pricing}

- Cómputo: por segundo, por vCPU equivalente, con un multiplicador por motor (consulta la [página de precios]({{BASE_URL}}/managed-databases)).
- Almacenamiento: \$0.18/GB·mes (NVMe Performance, la opción por defecto).
- Backups: \$0.04/GB·mes en el tier de snapshots.
- Replicación entre regiones (donde se admite): se mide como egress entre regiones estándar (\$0.005/GB).
- Sin cargo por conexión, sin cargo por IOPS y sin cargo por los eventos de failover.

El precio de partida de referencia es \$19/mes por un Postgres `db-1-4` en Virginia — es decir, una instancia de 1 vCPU / 4 GB / 50 GB, el tamaño más pequeño razonable para cargas de trabajo de producción.

## Próximos pasos {#next-steps}

- [Autenticación](/docs/authentication) para el patrón de token bearer que comparten todos los endpoints.
- [Convenciones](/docs/conventions) para saber cómo funcionan las operaciones, la paginación y los errores.
- [Almacenamiento en bloques](/docs/api/block-storage) — si ejecutas tu propia base de datos en una VM, este es el disco en el que vive.
- El artículo **Postgres / MySQL / Mongo / Redis: cuándo usar cada uno** en [Recursos](/resources/postgres-mysql-mongo-redis-when-to-use) — guía para elegir motor.
